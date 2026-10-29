#!/usr/bin/env python3
"""SessionStart und UserPromptSubmit: eigenen Registereintrag anlegen beziehungsweise auffrischen.

Das Register liegt zentral unter `~/.claude/sessions-aktiv/`, damit auch repo-übergreifende
Kollisionen sichtbar werden (ADR-2026-08-29-1805). Der Eintrag stirbt nicht durch Zeitablauf,
sondern erst, wenn sein Prozess weg ist (ADR-2026-08-29-1812); dieser Hook hält deshalb nur das
Lebenszeichen frisch und meldet nichts.

Bei SessionStart nennt er die eigene Adresse einmal, damit die Sitzung weiß, unter welchem Namen
sie erreichbar ist und wie sie andere adressiert.

Fail-open: jeder Fehler -> Exit 0.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def main():
    try:
        roh = sys.stdin.read()
    except Exception:
        roh = ''
    try:
        daten = json.loads(roh) if roh else {}
    except Exception:
        daten = {}
    ereignis = daten.get('hook_event_name') or ''

    import sitzungsregister_lib as reg
    pfad = reg.herzschlag()
    if pfad is None or ereignis != 'SessionStart':
        return 0

    eintrag = reg.lies_register(entferne_verwaiste=False)
    eigene = [e for e in eintrag if e.get('kennung') == reg.kennung_aus(reg.eigene_session_id())]
    if not eigene:
        return 0
    ich = eigene[0]
    fremde = [e for e in eintrag if e.get('kennung') != ich.get('kennung')]

    zeilen = [
        'SITZUNGSREGISTER (Hook register-sitzung)',
        '',
        'Deine Adresse im Register: %s' % ich.get('adresse'),
    ]
    if ich.get('anschreibname'):
        zeilen.append('Dein Anschreibname: %s (so erreicht dich SendMessage)'
                      % (reg.anschreib_adresse(ich) or ich.get('anschreibname')))
        hinweis = reg.unterscheidungs_hinweis(ich, eintrag)
        if hinweis:
            zeilen.append(hinweis)
    else:
        zeilen += [
            '',
            'PFLICHTSCHRITT, einmal je Sitzung: Die Adresse oben ist NICHT der Name, unter dem '
            'SendMessage dich erreicht, und der Sitzungstitel auch nicht (ADR-2026-08-29-211414).',
            'Ruf einmal ListAgents auf - die erste Zeile nennt deinen Namen - und trage ihn ein.',
            'Der Name allein genügt nicht, wenn ihn eine zweite Sitzung auch trägt: leg die '
            'vollständige Ausgabe in eine Datei und übergib sie, dann trägt das Werkzeug die '
            'unterscheidende Referenz selbst nach (ADR-2026-09-01-195703).',
            '    %s "<name>" --peers <datei>' % reg.werkzeug_aufruf('melde-namen.py'),
            'Ohne das kann dich keine andere Sitzung anschreiben.',
        ]
    if fremde:
        zeilen.append('')
        zeilen.append('Weitere eingetragene Sitzungen (%d):' % len(fremde))
        for e in sorted(fremde, key=lambda x: x.get('alter_sekunden') or 0)[:8]:
            zeilen.append('  %s | %s, Lebenszeichen %s%s' % (
                e.get('adresse'), e.get('zustand'), reg.alter_text(e.get('alter_sekunden')),
                ' | SendMessage: %s' % (reg.anschreib_adresse(e) or e['anschreibname'])
                if e.get('anschreibname') else ''))
        zeilen.append('')
        zeilen.append('Ruhend heißt erreichbar, nicht tot. Bei Überschneidung zuerst dort '
                      'nachfragen, statt die Arbeit doppelt zu machen.')
    zeilen.append('')
    zeilen.append('Sobald der Strang feststeht: Titel setzen als '
                  '"<repo>/<strang> · <rolle> · <kennung>" (Rolle aus bau, abnahme, beobachtung). '
                  'Der Titel beschriftet die Sitzung für Jürgen, er ist nicht die Adresse.')

    print(json.dumps({'hookSpecificOutput': {
        'hookEventName': 'SessionStart',
        'additionalContext': '\n'.join(zeilen)}}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
