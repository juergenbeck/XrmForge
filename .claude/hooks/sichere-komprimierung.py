#!/usr/bin/env python3
"""PostCompact-Hook: sichert die Zusammenfassung einer Komprimierung als lokale Datei.

Claude Code verdichtet beim Komprimieren den Kontext um rund 95 bis 97 Prozent; die
Zusammenfassung ersetzt danach alles Vorherige im Blick der Sitzung. Dieser Hook legt sie
mit Transcript-Pfad unter .claude/komprimierungen/ ab (gitignoriert), damit nachvollziehbar
bleibt, was die Sitzung nach dem Komprimieren noch wusste. Der Schwester-Hook
nach-komprimierung.py nennt die Datei der Folgesitzung.

Eingabe laut Hook-Doku: trigger, compact_summary, session_id, transcript_path, cwd.
Entscheid: ADR-2026-10-29-094355 im Repo claudecode. fail-open: jeder Fehler -> Exit 0.

GENERIERT aus ~/.claude/hook-templates/python/sichere-komprimierung.py durch Sync-UmlautTriggers.ps1
(Kern-Sub-Hook seit ADR-2026-10-29-095541 im Repo claudecode). Änderungen gehören ins
Template, nicht hierher; der nächste Sync überschreibt diese Datei.
"""
import datetime
import json
import os
import sys


def zielordner(data):
    basis = os.environ.get('CLAUDE_PROJECT_DIR') or data.get('cwd') or os.getcwd()
    return os.path.join(basis, '.claude', 'komprimierungen')


def main():
    try:
        raw = sys.stdin.buffer.read().decode('utf-8', errors='replace')
        data = json.loads(raw) if raw.strip() else None
    except Exception:
        return 0
    if not isinstance(data, dict):
        return 0

    zusammenfassung = data.get('compact_summary')
    if not isinstance(zusammenfassung, str) or not zusammenfassung.strip():
        return 0

    session_id = str(data.get('session_id') or 'unbekannt')
    jetzt = datetime.datetime.now()
    ordner = zielordner(data)
    os.makedirs(ordner, exist_ok=True)
    pfad = os.path.join(ordner, '%s-%s.md' % (jetzt.strftime('%Y-%m-%d-%H%M%S'), session_id[:8]))

    kopf = [
        '# Komprimierung %s' % jetzt.strftime('%d.%m.%Y %H:%M:%S'),
        '',
        '- Auslöser: %s' % (data.get('trigger') or 'unbekannt'),
        '- Sitzung: %s' % session_id,
        '- Transcript: %s' % (data.get('transcript_path') or 'unbekannt'),
        '',
        '## Zusammenfassung (Wortlaut)',
        '',
    ]
    # In eine Nachbardatei schreiben und dann ersetzen, damit nie eine halbe Datei liegt.
    tmp = pfad + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(kopf) + zusammenfassung.rstrip('\n') + '\n')
    os.replace(tmp, pfad)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
