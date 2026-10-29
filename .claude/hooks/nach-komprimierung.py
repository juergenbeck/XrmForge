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
