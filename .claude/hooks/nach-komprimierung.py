#!/usr/bin/env python3
"""SessionStart-Hook (source "compact"): Nachlese-Auftrag direkt nach einer Komprimierung.

Nach dem Komprimieren sieht die Sitzung nur noch eine Zusammenfassung. Sie schlägt im
Transcript nur nach, wenn ihr eine Lücke auffällt, und was die Zusammenfassung still
auslässt, fällt nicht auf. Dieser Hook gibt ihr deshalb ausdrücklich den Auftrag, die
Zusammenfassung gegen das Transcript zu prüfen und Ungesichertes jetzt wegzuschreiben.
Er nennt den Transcript-Pfad und den Ordner, in dem sichere-komprimierung.py die
Zusammenfassung ablegt. Eine Datei nennt er bewusst nicht: SessionStart(compact) läuft rund
eine Sekunde VOR PostCompact, die Sicherung dieser Komprimierung gibt es also noch nicht, und
eine ältere derselben Sitzung wäre die falsche (gemessen am 29.10.2026, ADR-2026-10-29-165621).

Entscheid: ADR-2026-10-29-094355 im Repo claudecode. fail-open: jeder Fehler -> Exit 0.

GENERIERT aus ~/.claude/hook-templates/python/nach-komprimierung.py durch Sync-UmlautTriggers.ps1
(Kern-Sub-Hook seit ADR-2026-10-29-095541 im Repo claudecode). Änderungen gehören ins
Template, nicht hierher; der nächste Sync überschreibt diese Datei.
"""
import json
import os
import sys
import time

# Eine Markierung des Mods kontext-wache gilt nur für eine Verdichtung, die gerade eben ausgelöst
# wurde. Ältere stammt aus einem abgebrochenen Versuch und darf eine spätere Nachlese nicht abschalten.
MARKIERUNG_HOECHSTENS_S = 30 * 60

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def sicherungsordner(data):
    basis = os.environ.get('CLAUDE_PROJECT_DIR') or data.get('cwd') or os.getcwd()
    return os.path.join(basis, '.claude', 'komprimierungen')


def main():
    try:
        raw = sys.stdin.buffer.read().decode('utf-8', errors='replace')
        data = json.loads(raw) if raw.strip() else None
    except Exception:
        return 0
    if not isinstance(data, dict) or data.get('source') != 'compact':
        return 0

    session_id = str(data.get('session_id') or '')
    transcript = data.get('transcript_path') or 'unbekannt'

    # Gewollte Verdichtung (ADR-2026-11-15-070648): Der Mod kontext-wache legt vor dem Verdichten
    # eine Markierung dieser Sitzung ab, nachdem die Stand-Dateien committet und gepusht sind. Dann
    # ist die Nachlese gegen das Transcript überflüssig; der Mod stellt danach selbst den
    # Wiedereinstieg mit den zu lesenden Dateien ein. Eine fremde oder alte Markierung zählt nicht.
    if session_id:
        markierung = os.path.join(sicherungsordner(data), 'gewollt-%s.json' % session_id)
        try:
            alter = time.time() - os.path.getmtime(markierung)
            with open(markierung, encoding='utf-8') as f:
                inhalt = json.load(f)
        except (OSError, ValueError):
            alter, inhalt = None, None
        # Der Mod kann keine Datei löschen; einen abgebrochenen Versuch markiert er mit "verworfen".
        gueltig = (isinstance(inhalt, dict) and inhalt.get('session_id') == session_id
                   and not inhalt.get('verworfen'))
        if gueltig and alter is not None and 0 <= alter <= MARKIERUNG_HOECHSTENS_S:
            try:
                os.remove(markierung)
            except OSError:
                pass
            text = '\n'.join([
                'NACH DER KOMPRIMIERUNG (Hook nach-komprimierung, ADR-2026-11-15-070648)',
                '',
                'Das war eine gewollte Verdichtung nach einem Checkpoint (Mod kontext-wache). Die '
                'Stand-Dateien waren vorher committet und gepusht, eine Nachlese gegen das Transcript '
                'entfällt. Gleich folgt ein Wiedereinstiegs-Prompt mit den Dateien, die du lesen sollst; '
                'arbeite danach im Strang weiter.',
            ])
            print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart',
                                                     'additionalContext': text}},
                             ensure_ascii=False))
            return 0

    zeilen = [
        'NACH DER KOMPRIMIERUNG (Hook nach-komprimierung, ADR-2026-10-29-094355)',
        '',
        'Der Kontext wurde eben komprimiert. Was du jetzt siehst, ist eine Auswahl; das vollständige '
        'Transcript liegt unter:',
        '    %s' % transcript,
    ]
    if session_id:
        zeilen += [
            'Die Zusammenfassung dieser Komprimierung legt sichere-komprimierung.py unmittelbar nach '
            'diesem Hinweis im Wortlaut ab, als jüngste Datei mit dem Muster *-%s.md im Ordner:'
            % session_id[:8],
            '    %s' % sicherungsordner(data),
            'Ältere Dateien desselben Musters gehören zu früheren Komprimierungen dieser Sitzung.',
        ]
    zeilen += [
        '',
        'Bevor du weiterarbeitest, prüf im Transcript den Abschnitt vor der Komprimierung auf '
        'Information, die die Zusammenfassung auslässt und die noch in keiner Datei steht:',
        '- exakte Messwerte, Zahlen, Fehlermeldungen,',
        '- Entscheidungen und verworfene Wege samt Grund,',
        '- Vorgaben, Einschränkungen oder Ablehnungen des Users,',
        '- Ergebnisse von Subagenten,',
        '- Schritte, die erledigt wirken, es aber nicht sind.',
        'Was davon gilt, schreibst du jetzt read-orientiert weg (lebender Stand, Journal, ADR, '
        'System-Notiz oder Memory, nach den Ablageregeln in CLAUDE.md und AGENTS.md des Repos) und committest es. Findest du '
        'nichts, arbeite weiter. Lies das Transcript gezielt (Suche nach Stichworten, Ende des '
        'Abschnitts), nicht vollständig.',
        'Sag dem User in einem Satz, dass komprimiert wurde und was du nachgetragen hast.',
    ]
    print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart',
                                             'additionalContext': '\n'.join(zeilen)}},
                     ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
