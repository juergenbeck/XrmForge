#!/usr/bin/env python3
"""PreToolUse (Bash): liest Schreibziele aus dem Befehlstext und beansprucht sie schwach.

**Das Problem.** Ein Anspruch entsteht nur aus `Write` und `Edit`. Wer über die Shell, ein Skript
oder einen Generator schreibt, taucht im Register nicht auf: Die Datei wird für andere Sitzungen
nicht sichtbar beansprucht, und der Commit-Riegel schweigt - was aussieht wie „alles frei".

**Warum aus dem Befehlstext und nicht aus der Wirkung.** Der Versuch vom 31.08.2026 fragte, welche
Dateien sich im Zeitfenster eines Aufrufs geändert haben. In einem Baum mit zwanzig gleichzeitigen
Sitzungen kann ein Zeitfenster nicht unterscheiden, wessen Schreibvorgang es sieht; nach 33 Minuten
hatten sechs Sitzungen Fremdzuschreibungen gemeldet und der Hook wurde stillgelegt
(ADR-2026-08-31-141421). Hier wird nichts zugeordnet: Was **dieser** Befehl als Ziel nennt, ist der
eigene Satz dieser Sitzung. Was ein aufgerufenes Skript intern schreibt, bleibt unsichtbar - lieber
eine benannte Lücke als ein Falschanspruch (ADR-2026-09-01-204433).

**Der Anspruch ist schwach.** Er steht im Feld `schwache_ansprueche`, nicht in `ansprueche`. Der
warnende Melder und der Leseweg sehen ihn, der **blockende Riegel nicht** - so verlangt es der
Kanon für jede neue Anspruchsquelle, und der Grund ist der Auflösungsweg: Eine Freigabe wirkt nur
im eigenen Eintrag, wer an einem falschen Anspruch hängt, braucht eine fremde Sitzung, die
antwortet, oder `--no-verify`.

Fail-open: jeder Fehler -> Exit 0, und niemals `permissionDecision`.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

_UMLEITUNG = re.compile(r'(?<![0-9<>])>{1,2}\s*([^\s;|&<>()]+)')
_TEE = re.compile(r'\btee\s+(?:-a\s+)?([^\s;|&<>()]+)')
_HEREDOC = re.compile(r'<<-?\s*[\'"]?([A-Za-z_][A-Za-z0-9_]*)[\'"]?')
_NICHTZIEL = ('/dev/null', '/dev/stderr', '/dev/stdout', '&1', '&2')
_PFAD = re.compile(r'^[A-Za-z0-9_./~$-][A-Za-z0-9_./~+-]*$')


def ohne_heredoc(befehl):
    """Entfernt jeden Heredoc-Körper: sein Inhalt sind Nutzdaten, keine Befehle.

    Ohne diesen Schritt liest der Erkenner Markdown-Zitatzeichen als Umleitung. Am eigenen
    Bestand von 15.723 echten Bash-Aufrufen gemessen (02.09.2026, `messung/miss_praezision.py`):
    1.007 statt 912 Nennungen. Die frühere Angabe „1.658 statt 830" stammte aus dem Prototyp
    `messung/schreibziel_erkenner.py`, also aus einer Kopie dieser Erkennung, und aus einem
    kleineren Bestand; gemessen wird seit dem 02.09.2026 dieser Hook selbst.
    """
    raus, marke = [], None
    for zeile in befehl.splitlines():
        if marke is not None:
            if zeile.strip() == marke:
                marke = None
            continue
        raus.append(zeile)
        treffer = _HEREDOC.search(zeile)
        if treffer:
            marke = treffer.group(1)
    return '\n'.join(raus)


def ist_pfad(ziel):
    """Ein Ziel muss wie ein Pfad aussehen und einen Punkt oder Schrägstrich tragen.

    Die zweite Bedingung steht als `hat_pfadtrenner_oder_punkt` getrennt und entfernt am
    Bestand von 15.744 Aufrufen 60 verschiedene „Ziele" mit 127 Nennungen (gemessen am
    02.09.2026 an diesem Hook); alle 60 wurden gelesen, es sind ausnahmslos Zahlen und
    deutsche Wörter (`0`, `Exit`, `muss`), kein einziger echter Pfad. Sie kostet also nichts
    (ADR-2026-09-01-204433). Die früheren Angaben 44/75 und 61/159 waren beide zu hoch: die
    erste stammte aus einer Prototyp-Kopie der Erkennung, die zweite aus einer Messung, deren
    Neutralisierung zu weit griff und `/dev/null` mitzählte (Abnahmebefunde 02.09.2026).
    """
    if not ziel or ziel in _NICHTZIEL or ziel.startswith('$'):
        return False
    if not _PFAD.match(ziel):
        return False
    if not hat_pfadtrenner_oder_punkt(ziel):
        return False
    return any(z.isalnum() for z in ziel)


def hat_pfadtrenner_oder_punkt(ziel):
    """Die Verschärfung als eigene benannte Bedingung, damit die Messung sie aussetzen kann.

    Sie steht getrennt, weil `messung/miss_praezision.py` ihre Kosten misst und dafür genau diese
    eine Regel neutralisieren muss. Bis zum 02.09.2026 tat die Messung das über ein angehängtes
    `.x` und hob damit still auch `_NICHTZIEL` und die Leerprüfung mit auf: `/dev/null` allein
    stand danach mit 419 Nennungen in der weiten Menge, und die daraus veröffentlichten Zahlen
    waren zu hoch (Abnahmebefund vom 02.09.2026, Runde 2).
    """
    return '/' in ziel or '.' in ziel


def schreibziele(befehl):
    text = ohne_heredoc(befehl or '')
    ziele = []
    for muster in (_UMLEITUNG, _TEE):
        for treffer in muster.finditer(text):
            ziel = treffer.group(1).strip('"\'')
            if ist_pfad(ziel):
                ziele.append(ziel)
    # `sed -i` per Wortzerlegung: ein Regex dafür lief in katastrophales Backtracking (gemessen:
    # über zwei Minuten für 14.312 Aufrufe).
    worte = text.split()
    for i, wort in enumerate(worte):
        if wort != 'sed' and not wort.endswith('/sed'):
            continue
        rest = worte[i + 1:]
        if not any(w.startswith('-i') for w in rest):
            continue
        kandidat = None
        for w in rest:
            if w.startswith('-') or w.startswith('$'):
                continue
            kandidat = w.strip('"\'')
        if kandidat and ist_pfad(kandidat):
            ziele.append(kandidat)
    gesehen, raus = set(), []
    for z in ziele:
        if z not in gesehen:
            gesehen.add(z)
            raus.append(z)
    return raus


def main():
    try:
        roh = sys.stdin.read()
    except Exception:
        return 0
    if not roh:
        return 0
    try:
        daten = json.loads(roh)
    except Exception:
        return 0

    befehl = (daten.get('tool_input') or {}).get('command')
    if not befehl:
        return 0
    ziele = schreibziele(befehl)
    if not ziele:
        return 0

    import sitzungsregister_lib as reg

    fremd = []
    for ziel in ziele:
        # schwach=True: dieser Hook WARNT nur, er darf deshalb auch die schwachen
        # Ansprueche anderer Sitzungen sehen. Der blockende Riegel ruft ohne den
        # Schalter auf und sieht sie weiterhin nicht (ADR-2026-09-01-204433).
        for eintrag, anspruch in reg.fremde_ansprueche(ziel, schwach=True):
            fremd.append((ziel, eintrag, anspruch))
    reg.trage_schwache_ansprueche(ziele)

    if not fremd:
        return 0

    zeilen = ['FREMDER ANSPRUCH auf ein Ziel dieses Befehls (Hook check-bash-anspruch)', '']
    for ziel, eintrag, anspruch in fremd:
        zeilen.append('  %s' % ziel)
        zeilen.append('    beansprucht von: %s' % eintrag.get('adresse'))
        zeilen.append('    Zustand: %s, Lebenszeichen %s' % (
            eintrag.get('zustand'), reg.alter_text(eintrag.get('alter_sekunden'))))
        if eintrag.get('anschreibname'):
            zeilen.append('    Erreichbar per SendMessage({to: "%s"})'
                          % (reg.anschreib_adresse(eintrag) or eintrag.get('anschreibname')))
            hinweis = reg.unterscheidungs_hinweis(eintrag)
            if hinweis:
                zeilen.append('    %s' % hinweis)
        else:
            zeilen.append('    Kein Anschreibname gemeldet: in ListAgents suchen.')
    zeilen += [
        '',
        'Gelesen wurde der Befehlstext, nicht die Wirkung: diese Ziele nennt der Aufruf selbst.',
        'Was ein aufgerufenes Skript intern schreibt, sieht dieser Hook NICHT - dort gilt weiter,',
        'dass man sich bei einer geteilten Datei selbst meldet.',
        '',
        'Nur eine Warnung. Der eigene Anspruch daraus ist SCHWACH: der Commit-Riegel blockt auf ihm',
        'nicht (ADR-2026-09-01-204433).',
    ]
    print(json.dumps({'hookSpecificOutput': {
        'hookEventName': 'PreToolUse',
        'additionalContext': '\n'.join(zeilen)}}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
