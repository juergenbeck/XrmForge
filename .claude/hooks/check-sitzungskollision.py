#!/usr/bin/env python3
"""PreToolUse (Write, Edit): meldet, wenn eine andere Sitzung denselben Pfad beansprucht.

Zwei Aufgaben in einem Hook, weil sie denselben Pfad betreffen:

1. **Melden.** Beansprucht eine andere lebende Sitzung den Zielpfad, wird das mit ihrer Adresse,
   ihrem Zustand und dem Alter ihres Lebenszeichens gemeldet, damit die Kontaktaufnahme ein
   Schritt ist. `ruhend` heißt erreichbar, nicht tot (ADR-2026-08-29-1812) - die Wertung trifft
   die lesende Sitzung, nicht der Hook.
2. **Eigenen Anspruch nachtragen.** Der berührte Pfad wandert in den eigenen Registereintrag.
   Ansprüche entstehen so aus dem tatsächlichen Tun statt aus einer getippten Liste, die
   entweder zu weit oder veraltet wäre.

**Warnt nur, blockt nie** (ADR-2026-08-29-1805): ein Anspruch ist eine Absichtserklärung, keine
Sperre, und ein falsch positiver Anspruch darf keine berechtigte Arbeit aufhalten. Der Hook setzt
deshalb unter keinen Umständen `permissionDecision`.

Die Kontextlast wird hier bewusst NICHT gemessen: das läse bei jedem Schreibvorgang ganze
Transcripts. Wer sie braucht, ruft den Leseweg `werkzeuge/sitzungsregister/` auf.

Fail-open: jeder Fehler -> Exit 0.
"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


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

    ziel = (daten.get('tool_input') or {}).get('file_path')
    if not ziel:
        return 0

    import sitzungsregister_lib as reg

    # schwach=True: der warnende Melder sieht auch die aus einem Bash-Befehlstext
    # gelesenen Ansprueche; der blockende Riegel ruft ohne diesen Schalter auf
    # (ADR-2026-09-01-204433).
    treffer = reg.fremde_ansprueche(ziel, schwach=True)
    # Der eigene Anspruch wird auch dann nachgetragen, wenn gemeldet wurde: die Absicht besteht.
    reg.trage_anspruch_nach(ziel)

    if not treffer:
        return 0

    zeilen = ['FREMDER ANSPRUCH auf diese Datei (Hook check-sitzungskollision)', '',
              'Datei: %s' % str(ziel).replace('\\', '/'), '']
    for eintrag, anspruch in treffer:
        zeilen.append('  %s' % eintrag.get('adresse'))
        zeilen.append('    Zustand: %s, Lebenszeichen %s' % (
            eintrag.get('zustand'), reg.alter_text(eintrag.get('alter_sekunden'))))
        # Das Alter des ANSPRUCHS, nicht der Sitzung: bei einer Kollision behält der ältere
        # Anspruch das Feld, und bis zum 01.09.2026 war das mit den vorhandenen Daten gar nicht
        # entscheidbar (ADR-2026-09-01-204329). Fehlt der Zeitpunkt, wird das gesagt.
        seit = reg.anspruch_seit(eintrag, anspruch)
        zeilen.append('    Anspruch: %s (%s)' % (
            anspruch,
            'seit %s' % reg.alter_text(max(0.0, time.time() - seit)) if seit is not None
            else 'Zeitpunkt unbekannt'))
        # Ein aus einem Bash-Befehlstext gelesener Anspruch ist SCHWACH, und das gehört an die
        # Meldung: der Commit-Riegel blockt auf ihm nicht, und wer sein Schweigen ohne diesen
        # Hinweis erlebt, schließt daraus, es gebe gar keinen Anspruch (ADR-2026-09-01-204433).
        # Seit ADR-2026-09-02-234714 gibt es zwei schwache Herkünfte, und die Meldung nennt die
        # richtige: Eine Werkzeugmeldung unter der Beschriftung „aus Bash-Befehlstext" wäre falsch.
        herkunft = reg.anspruch_herkunft(eintrag, anspruch)
        if herkunft in ('werkzeug', 'bash'):
            zeilen.append('    Dieser Anspruch ist SCHWACH (%s): sein Schweigen beim Commit heißt '
                          'also nicht, dass die Datei frei wäre.' % reg.herkunft_text(herkunft))
        if eintrag.get('repo_name'):
            zeilen.append('    Repo: %s' % eintrag.get('repo_name'))
        # Der Anschreibname ist der EINZIGE Name, den SendMessage annimmt. Adresse und Titel sind
        # es nicht (ADR-2026-08-29-211414); fehlt er, wird das gesagt statt eine Erreichbarkeit
        # behauptet, die nicht besteht.
        if eintrag.get('anschreibname'):
            # Die Referenz gehört zur Adresse, wo der Name mehrdeutig ist; ohne sie landete die
            # Nachricht bei der falschen Sitzung (ADR-2026-09-01-195703).
            zeilen.append('    Erreichbar per SendMessage({to: "%s"})'
                          % (reg.anschreib_adresse(eintrag) or eintrag.get('anschreibname')))
            hinweis = reg.unterscheidungs_hinweis(eintrag)
            if hinweis:
                zeilen.append('    %s' % hinweis)
        else:
            zeilen.append('    Kein Anschreibname gemeldet: diese Sitzung ist nicht per Namen '
                          'erreichbar, in ListAgents suchen.')
    zeilen += [
        '',
        'Ruhend heißt erreichbar, nicht tot: Jürgen lässt Sitzungen stundenlang liegen und '
        'archiviert, was für ihn erledigt ist.',
        'Zuständigkeit selbst klären, nicht an Jürgen melden. Bei Streit behält der ältere '
        'Anspruch das Feld.',
        'Die Kontextlast zählt hier NICHT: sie verteilt Arbeit, sie löst keine Kollision.',
        '',
        'Nur eine Warnung, das Schreiben ist nicht blockiert. Konvention: '
        'ADR-2026-08-29-1805-sitzungsregister-und-kollisionsmelder.',
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
