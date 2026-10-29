#!/usr/bin/env python3
"""Sitzungsriegel: kein fremder Anspruch im eigenen Commit.

AUTO-GENERATED aus werkzeuge/hook-sync/templates/python/sitzungsriegel.py im Repo claudecode
(ausgerollt von Sync-UmlautTriggers.ps1). Nicht von Hand editieren.

Vom Wrapper `.githooks/pre-commit` nach dem zentralen `pre-commit.py` und vor dem repo-eigenen
`pre-commit-local.py` aufgerufen. Bis zum Familien-Rollout lag dieser Riegel als
`pre-commit-local.py` nur in claudecode (ADR-2026-08-29-192830); seit ADR-2026-10-28-202822 ist
er eine gesynchte Datei, damit `pre-commit-local.py` dem Repo bleibt.

**Betriebsart je Repo.** Die Datei `.githooks/sitzungsriegel.modus` neben dieser Datei trägt
`blockend` oder `protokollierend`; der Sync schreibt sie aus dem Feld `sitzungsriegel` der
`umlaute-triggers.json`. Fehlt sie oder steht etwas anderes darin, gilt `protokollierend`: Ein
neues Repo bringt neue Anspruchsdaten, und ein falscher Anspruch am blockenden Riegel ist nur mit
fremder Hilfe aufzulösen (AGENTS.md, „eine neue Anspruchsquelle läuft erst warnend").
Protokollierend heißt: Er prüft genauso, schreibt dieselbe Protokollzeile mit `geblockt: false`,
nennt den Treffer und lässt den Commit durch.

**Das Problem.** Alle Sitzungen dieses Rechners teilen sich einen Arbeitsbaum und damit denselben
git-Index. Was eine fremde Sitzung dort per `git add` abgelegt hat, wandert in den nächsten
Commit, gleich wer ihn absetzt. Am 29.08.2026 nahm ein Commit so 87 fremde Zeilen mit, obwohl er
nur zwei eigene Pfade benannt hatte.

**Die Prüfung.** Was tatsächlich committet würde (`git diff --cached --name-only`, bei einem
Commit mit Pfadangabe also nur die genannten Pfade), wird gegen die Ansprüche lebender fremder
Sitzungen aus dem Sitzungsregister gehalten. Ein Treffer bricht ab.

**Warum abbrechen und nicht warnen**, anders als der Kollisionsmelder: Eine Warnung beim Commit
käme zu spät, der Commit wäre dann schon geschrieben. Die Korrektur ist trivial und steht in der
Meldung.

**Fail-open bei jedem technischen Fehler**: fehlt das Register oder lässt sich die Lib nicht
laden, läuft der Commit durch. Geblockt wird ausschließlich der belegte Fall, und nur in der
Betriebsart `blockend`.
"""
from __future__ import annotations

import os
import subprocess
import time
import sys
from pathlib import Path

# Die Lib liegt neben dieser Datei im selben Repo; das GEPRÜFTE Repo ist dagegen das, in dem
# git gerade committet. Beides auseinanderzuhalten macht den Riegel testbar und ist auch
# fachlich richtig: ein Hook urteilt über den laufenden Commit, nicht über seinen Fundort.
EIGENES_REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(EIGENES_REPO / '.claude' / 'hooks'))


def geprueftes_repo() -> Path:
    lauf = subprocess.run(['git', 'rev-parse', '--show-toplevel'],
                          capture_output=True, text=True, encoding='utf-8', errors='replace')
    if lauf.returncode == 0 and (lauf.stdout or '').strip():
        return Path(lauf.stdout.strip())
    return Path.cwd()

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


MODI = ('blockend', 'protokollierend')


def betriebsart() -> str:
    """Betriebsart aus `.githooks/sitzungsriegel.modus` neben dieser Datei, sonst protokollierend.

    Gelesen wird neben der Datei und nicht im geprüften Repo, aus demselben Grund wie die Lib:
    Ein Hook urteilt mit der Konfiguration seines Fundorts. Im echten Betrieb ist beides dasselbe.
    """
    try:
        wert = (Path(__file__).resolve().parent / 'sitzungsriegel.modus').read_text(
            encoding='utf-8').strip().lower()
    except Exception:
        return 'protokollierend'
    return wert if wert in MODI else 'protokollierend'


def zu_committende_dateien() -> list[str]:
    lauf = subprocess.run(['git', 'diff', '--cached', '--name-only'],
                          capture_output=True, text=True, encoding='utf-8', errors='replace')
    if lauf.returncode != 0:
        return []
    return [z.strip() for z in (lauf.stdout or '').splitlines() if z.strip()]


def protokoll_pfad() -> Path:
    """Wo mitgeschrieben wird. Bewusst NEBEN dem Register und nicht im Repo.

    Im Repo wäre die Datei selbst ein Gegenstand des geteilten Index, den sie beobachten soll:
    jede Blockade erzeugte eine committable Änderung, die mit paralleler Arbeit kollidiert.
    """
    eigen = os.environ.get('SITZUNGSREGISTER_PROTOKOLL')
    if eigen:
        return Path(eigen)
    return Path.home() / '.claude' / 'sitzungsregister-riegel.jsonl'


def protokolliere(repo: Path, dateien: list[str], treffer: list, modus: str = 'blockend') -> None:
    """Eine Zeile je Lauf, auch ohne Treffer - sonst entsteht ein Zähler ohne Nenner.

    Wirft nie: ein Fehler beim Mitschreiben darf das Urteil des Riegels nicht verändern
    (ADR-2026-08-31-153317). Der Aufrufer klammert zusätzlich.
    """
    import json
    import time

    eintrag = {
        'zeit': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'repo': str(repo).replace('\\', '/'),
        'repo_name': repo.name,
        'sitzung': os.environ.get('CLAUDE_CODE_SESSION_ID') or '',
        'dateien_im_commit': len(dateien),
        # `blockiert` bleibt der echten Abweisung vorbehalten, damit die Auswertung der Messphase
        # (auswerte_messphase.py zählt `blockiert`) nicht durchgelassene Treffer als Blockade
        # zählt. Ein Treffer im protokollierenden Betrieb heißt `durchgelassen`.
        'ergebnis': ('blockiert' if modus == 'blockend' else 'durchgelassen') if treffer else 'frei',
        'modus': modus,
        'geblockt': bool(treffer) and modus == 'blockend',
    }
    if treffer:
        # `begonnen` und `lebenszeichen` der haltenden Sitzung sind KEIN Entstehungszeitpunkt
        # des Anspruchs - den führt das Register nicht (gemessen 31.08.2026 über 17 Einträge).
        # Sie sind die beste vorhandene Näherung, und die Auswertung sagt das ausdrücklich.
        eintrag['treffer'] = [{
            'datei': datei,
            'anspruch': anspruch,
            'halter_adresse': halter.get('adresse'),
            'halter_anschreibname': halter.get('anschreibname'),
            'halter_kennung': halter.get('kennung'),
            'halter_zustand': halter.get('zustand'),
            'halter_lebenszeichen_alter_s': halter.get('alter_sekunden'),
            'halter_begonnen': halter.get('begonnen'),
        } for datei, halter, anspruch in treffer]

    ziel = protokoll_pfad()
    ziel.parent.mkdir(parents=True, exist_ok=True)
    zeile = json.dumps(eintrag, ensure_ascii=False, sort_keys=True)
    # Ein einziger Schreibvorgang je Zeile. Mehrere Sitzungen schreiben gleichzeitig; kurze
    # Anhänge im a-Modus verschränken sich in der Praxis nicht, garantiert ist es nicht.
    with open(ziel, 'a', encoding='utf-8') as datei:
        datei.write(zeile + '\n')


def main() -> int:
    dateien = zu_committende_dateien()
    if not dateien:
        return 0

    import sitzungsregister_lib as reg

    repo = geprueftes_repo()
    modus = betriebsart()
    treffer = []
    for datei in dateien:
        for eintrag, anspruch in reg.fremde_ansprueche(datei, repo=str(repo)):
            treffer.append((datei, eintrag, anspruch))

    try:
        protokolliere(repo, dateien, treffer, modus)
    except Exception as fehler:  # noqa: BLE001
        # Fail-open in BEIDE Richtungen: das Urteil unten läuft unverändert weiter, ob hier
        # etwas schiefging oder nicht. Ein Protokoll, das Commits verhindern kann, wäre
        # schlechter als gar keins.
        print('Hinweis: Riegel-Protokoll nicht geschrieben (%s)' % fehler)

    if not treffer:
        return 0

    blockend = modus == 'blockend'
    print('=' * 65)
    if blockend:
        print(' FREMDER ANSPRUCH im Commit (Hook sitzungsriegel)')
    else:
        print(' FREMDER ANSPRUCH im Commit (Hook sitzungsriegel, nur protokolliert)')
    print('=' * 65)
    print()
    print(' Diese Dateien würden mitcommittet, obwohl eine andere Sitzung sie')
    print(' beansprucht. Der Index ist geteilt: ein fremdes `git add` landet in')
    print(' DEINEM Commit, auch wenn du nur eigene Pfade benannt hast.')
    if not blockend:
        print()
        print(' Der Riegel läuft in diesem Repo protokollierend (ADR-2026-10-28-202822):')
        print(' Der Commit geht durch. Prüf danach mit `git show --stat HEAD`, ob')
        print(' fremde Arbeit mitgegangen ist, und sag es der Sitzung unten.')
    print()
    for datei, eintrag, anspruch in treffer:
        print('   %s' % datei)
        print('     beansprucht von: %s' % eintrag.get('adresse'))
        print('     Zustand: %s, Lebenszeichen %s' % (
            eintrag.get('zustand'), reg.alter_text(eintrag.get('alter_sekunden'))))
        # Alter des ANSPRUCHS, nicht der Sitzung (ADR-2026-09-01-204329); fehlt es, wird das
        # gesagt statt eine Reihenfolge behauptet.
        seit = reg.anspruch_seit(eintrag, anspruch)
        print('     Anspruch: %s (%s)' % (
            anspruch,
            'seit %s' % reg.alter_text(max(0.0, time.time() - seit)) if seit is not None
            else 'Zeitpunkt unbekannt'))
        if eintrag.get('anschreibname'):
            # Mit Referenz, wo der Name mehrdeutig ist - sonst löst der Riegel eine Blockade auf,
            # indem er an die falsche Sitzung verweist (ADR-2026-09-01-195703).
            print('     Anschreiben: SendMessage({to: "%s"})'
                  % (reg.anschreib_adresse(eintrag) or eintrag.get('anschreibname')))
            hinweis = reg.unterscheidungs_hinweis(eintrag)
            if hinweis:
                print('     %s' % hinweis)
    print()
    if not blockend:
        return 0
    print(' So geht es weiter:')
    print()
    print('   git commit -m "..." -- <nur deine pfade>')
    print()
    print(' Die Pfadangabe umgeht den geteilten Index; fremde Dateien bleiben')
    print(' unberührt gestaged.')
    print()
    print(' Gehört die Datei wirklich zu deiner Arbeit, sprich die haltende Sitzung')
    print(' an (Adresse oben, sonst Name aus ListAgents) und bitte sie, den Anspruch')
    print(' freizugeben. Sie tut das mit einem Aufruf:')
    print()
    print('   %s <pfad>' % reg.werkzeug_aufruf('melde-freigabe.py', str(repo)))
    print()
    print(' Ist die Sitzung nicht erreichbar, kann sie den Pfad auch mitcommitten.')
    print(' `--no-verify` ist der letzte Ausweg und schaltet die GANZE Hook-Kette ab,')
    print(' nicht nur diesen Riegel: Umlaut-, Typografie- und Inhaltsprüfung fallen')
    print(' mit weg. Wer ihn nimmt, prüft von Hand nach und schreibt den Grund in die')
    print(' Commit-Nachricht (ADR-2026-08-30-222543).')
    print()
    return 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as fehler:  # noqa: BLE001
        # Fail-open: ein Fehler dieser Prüfung darf niemals einen Commit verhindern.
        print('Hinweis: Anspruchsprüfung übersprungen (%s)' % fehler)
        sys.exit(0)
