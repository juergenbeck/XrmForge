#!/usr/bin/env python3
"""UserPromptSubmit- und PostToolUse-Hook: warnt an Schwellen, wenn der Kontext voll läuft.

Läuft an beiden Ereignissen, damit auch eine autark arbeitende Sitzung, die keine Nachricht des
Users bekommt, ihre Schwellen erfährt (ADR-2026-11-07-190610 im Repo claudecode). Gemeldet wird
mit dem Ereignisnamen aus der Eingabe; jede Schwelle einmal je Sitzung, gleich an welchem
Ereignis. Im Subagenten (agent_id gesetzt oder Transcript unter subagents/) schweigt er.

Misst die ECHTE Kontextfüllung aus dem jüngsten usage-Eintrag des Transcripts
(input_tokens + cache_read_input_tokens + cache_creation_input_tokens); das ist auch
nach einem Compact korrekt. Familien-Standard seit claudecode-ADR-2026-07-04-0943
(Palas-Vorbild), löst die frühere Byte-Heuristik bytes/3.5 ab, die systematisch
überschätzte: die Transcript-JSONL wächst append-only, verworfene Tool-Outputs und
Vor-Compact-Historie zählten mit.

Das Kontextfenster folgt dem Modell (siehe MODELL_FENSTER), Vorrang hat die
Umgebungsvariable CLAUDE_CONTEXT_WINDOW. Die Meldung nennt immer die absolute
Token-Zahl, die unabhängig vom angenommenen Fenster korrekt ist.

State-File pro Session, damit dieselbe Schwelle nicht mehrfach feuert.
fail-open: jeder Fehler -> Exit 0.

Zusätzlich zu den Prozentschwellen gibt es eine absolute Schwelle für die
Leerlauf-Komprimierung: Ist sie aktiv, komprimiert Claude Code eine Sitzung, die etwa eine
Stunde ruht, sobald ihr Kontext deren Schwelle erreicht (Default 200.000 Token), bei einem
1-Mio-Fenster also lange vor der 50-Prozent-Marke. Der Hook liest dafür die wirksame
Einstellung (idleCompaction, autoCompactEnabled, CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS,
DISABLE_AUTO_COMPACT; ohne Managed Settings und --settings),
statt eine Zahl anzunehmen; ist sie aus, entfällt die Warnung. CLAUDE_KONTEXT_WARN_ABSOLUT
erzwingt eine eigene Schwelle. Sie meldet einmal je Anstieg und wird wieder scharf, sobald
die Füllung darunter fällt (also nach einem Komprimieren). ADR-2026-10-29-094355 und
ADR-2026-10-29-142428 im Repo claudecode.

GENERIERT aus ~/.claude/hook-templates/python/check-kontextlast.py durch
Sync-UmlautTriggers.ps1. Änderungen am Rahmen gehören ins Template, nicht hierher.
AUSGENOMMEN ist die mit KONTEXTLAST-TEXTE markierte Region weiter unten: die ist
repo-spezifisch, wird vom Sync NIE überschrieben und gehört genau hierher
(ADR-2026-08-15-1143 im Repo claudecode).
"""
import json
import os
import sys
import tempfile

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

SCHWELLEN = [50, 60, 70, 85]
DEFAULT_WINDOW = 1000000
# Gelesen wird nur das Ende des Transcripts; der jüngste usage-Eintrag steht dort. Erst wenn
# dieser Ausschnitt keinen trägt, wird die ganze Datei gelesen (ADR-2026-11-07-190610).
LESE_ENDE_BYTES = 4 * 1024 * 1024
# Default-Schwelle und Untergrenze der Leerlauf-Komprimierung laut Doku settings-reference,
# Abschnitt idleCompaction (gelesen am 29.10.2026).
LEERLAUF_DEFAULT = 200000
LEERLAUF_MINIMUM = 100000

# Kontextfenster je Modell. Quelle: Skill `claude-api` (Modelltabelle, Stand 2026-06-24),
# gegengeprüft am 15.08.2026 an den real erreichten Maxima von 1153 Transcripten: kein
# gemessener Wert überschreitet sein dokumentiertes Fenster.
#
# Ohne diese Tabelle würde eine Haiku-Session (200k Fenster) mit dem 1M-Default bei
# echten 85 Prozent als 17 Prozent gemeldet und die Warnung bliebe aus - derselbe
# Fehler wie eine geschätzte Zahl, nur in die andere Richtung und ohne Korrektiv.
MODELL_FENSTER = {
    'claude-opus-5': 1000000,
    'claude-fable-5': 1000000,
    'claude-mythos-5': 1000000,
    'claude-opus-4-8': 1000000,
    'claude-opus-4-7': 1000000,
    'claude-opus-4-6': 1000000,
    'claude-sonnet-5': 1000000,
    'claude-sonnet-4-6': 1000000,
    'claude-haiku-4-5': 200000,
}


def fenster_aus_modell(modell):
    """Fenster zum Modell, auch bei angehängtem Datums-Suffix."""
    if not modell:
        return None
    if modell in MODELL_FENSTER:
        return MODELL_FENSTER[modell]
    for basis, fenster in MODELL_FENSTER.items():
        if modell.startswith(basis):
            return fenster
    return None


def _zeilen(transcript_path, nur_ende):
    """Zeilen des Transcripts; bei nur_ende nur die der letzten LESE_ENDE_BYTES."""
    with open(transcript_path, 'rb') as fh:
        if nur_ende:
            fh.seek(0, os.SEEK_END)
            groesse = fh.tell()
            if groesse > LESE_ENDE_BYTES:
                fh.seek(groesse - LESE_ENDE_BYTES)
                daten = fh.read()
                # Die erste Zeile ist angeschnitten und wird verworfen.
                daten = daten.split(b'\n', 1)[1] if b'\n' in daten else b''
                return daten.decode('utf-8', errors='replace').split('\n')
            fh.seek(0)
        return fh.read().decode('utf-8', errors='replace').split('\n')


def kontext_tokens(transcript_path):
    """Jüngster usage-Eintrag: (Summe der Eingabe-Token, Modell) = aktuelle Kontextfüllung."""
    if not transcript_path or not os.path.isfile(transcript_path):
        return None, None
    for nur_ende in (True, False):
        try:
            lines = _zeilen(transcript_path, nur_ende)
        except Exception:
            return None, None
        ergebnis = _juengster_usage(lines)
        if ergebnis[0]:
            return ergebnis
        if nur_ende and os.path.getsize(transcript_path) <= LESE_ENDE_BYTES:
            break
    return None, None


def _juengster_usage(lines):
    for line in reversed(lines):
        line = line.strip()
        if not line or '"usage"' not in line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        # Subagenten laufen in eigenen Fenstern; ihre Last gehört nicht in diese Zahl.
        if obj.get('isSidechain') is True:
            continue
        usage = None
        if isinstance(obj.get('usage'), dict):
            usage = obj['usage']
        elif isinstance(obj.get('message'), dict) and isinstance(obj['message'].get('usage'), dict):
            usage = obj['message']['usage']
        if not usage:
            continue
        total = 0
        for key in ('input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'):
            val = usage.get(key)
            if isinstance(val, (int, float)):
                total += int(val)
        if total > 0:
            nachricht = obj.get('message') if isinstance(obj.get('message'), dict) else {}
            return total, (nachricht.get('model') or obj.get('model'))
    return None, None


def fenster_ableiten(modell):
    """(Fenster, Herkunft). Vorrang: Umgebungsvariable, dann Modell, dann Default."""
    if os.environ.get('CLAUDE_CONTEXT_WINDOW'):
        try:
            window = int(os.environ['CLAUDE_CONTEXT_WINDOW'])
            herkunft = 'CLAUDE_CONTEXT_WINDOW'
        except Exception:
            window, herkunft = DEFAULT_WINDOW, 'Default (CLAUDE_CONTEXT_WINDOW unlesbar)'
    else:
        aus_modell = fenster_aus_modell(modell)
        if aus_modell:
            window, herkunft = aus_modell, 'Modell ' + str(modell)
        else:
            window = DEFAULT_WINDOW
            herkunft = 'Default (Modell %s unbekannt)' % (modell or 'nicht ermittelt')
    if window <= 0:
        window, herkunft = DEFAULT_WINDOW, 'Default (ungültiger Wert)'
    return window, herkunft


def _ist_gesetzt(wert):
    return str(wert).strip().lower() not in ('', '0', 'false', 'no', 'off')


def leerlauf_schwelle(projekt):
    """Schwelle der Leerlauf-Komprimierung für diese Sitzung, oder None, wenn sie aus ist.

    Reihenfolge wie bei Claude Code: lokale Projekt-Settings, Projekt-Settings, User-Settings;
    je Schlüssel gilt der erste gesetzte Wert. Aus ist sie bei idleCompaction false, bei
    autoCompactEnabled false (laut Doku schaltet das die Leerlauf-Komprimierung mit ab) und bei
    DISABLE_AUTO_COMPACT. Managed Settings und das Flag --settings liest der Hook nicht."""
    if _ist_gesetzt(os.environ.get('DISABLE_AUTO_COMPACT', '')):
        return None
    pfade = []
    if projekt:
        pfade += [os.path.join(projekt, '.claude', 'settings.local.json'),
                  os.path.join(projekt, '.claude', 'settings.json')]
    pfade.append(os.path.join(os.path.expanduser('~'), '.claude', 'settings.json'))
    werte = {}
    for pfad in pfade:
        try:
            with open(pfad, encoding='utf-8') as fh:
                daten = json.load(fh)
        except Exception:
            continue
        for name in ('idleCompaction', 'autoCompactEnabled'):
            if name not in werte and isinstance(daten.get(name), bool):
                werte[name] = daten[name]
    if werte.get('idleCompaction') is False or werte.get('autoCompactEnabled') is False:
        return None
    try:
        schwelle = int(os.environ.get('CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS') or LEERLAUF_DEFAULT)
    except Exception:
        schwelle = LEERLAUF_DEFAULT
    return max(schwelle, LEERLAUF_MINIMUM)


def schwelle_absolut(projekt):
    """Absolute Warnschwelle in Token oder None. Vorrang: CLAUDE_KONTEXT_WARN_ABSOLUT, sonst die
    Schwelle der Leerlauf-Komprimierung, falls sie aktiv ist."""
    try:
        erzwungen = int(os.environ.get('CLAUDE_KONTEXT_WARN_ABSOLUT') or 0)
    except Exception:
        erzwungen = 0
    if erzwungen > 0:
        return erzwungen
    return leerlauf_schwelle(projekt)


def meldung_absolut_standard(tokens, schwelle):
    """Meldung der absoluten Schwelle. Ein Repo kann sie mit meldung_absolut(tokens, schwelle)
    in seiner Textregion ersetzen."""
    return (
        "KOMPRIMIERUNG IN SICHT (Hook check-kontextlast)\n\n"
        "Kontextfüllung ~%dk Token, Schwelle %dk erreicht. Ab hier komprimiert Claude Code diese "
        "Sitzung, sobald sie etwa eine Stunde ruht (Leerlauf-Komprimierung; abschaltbar mit "
        "\"idleCompaction\": false in settings.json, Schwelle per CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS), "
        "und ersetzt den Verlauf durch eine Zusammenfassung von wenigen tausend Zeichen.\n\n"
        "Was in dieser Sitzung an Messwerten, Entscheidungen, verworfenen Wegen und Vorgaben "
        "des Users bisher nur im Chat steht, jetzt read-orientiert wegschreiben und committen. "
        "Den Stand dem User sichtbar nennen (absolute Token-Zahl)."
        % (round(tokens / 1000), round(schwelle / 1000))
    )


# Standard-Reaktionen des Rahmens. Sie greifen, wenn die regionseigene meldung() wirft, etwa
# weil ihr REAKTION-Dict eine Schwelle nicht kennt. Inhalt: globale CLAUDE.md, Abschnitt
# „Automatische Sessionübergabe ab 60 % Kontext“ (ADR-2026-11-07-122259 im Repo claudecode).
STANDARD_REAKTION = {
    50: "Leise Schwelle: den Stand dem User sichtbar nennen (absolute Token-Zahl, Prozent, "
        "Schwelle). Noch keine Übergabe; den laufenden Mikro-Auftrag so schneiden, dass er vor "
        "60 % committet ist. Ab 60 % übergibt die Sitzung automatisch.",
    60: "Übergabe-Schwelle: jetzt ohne Rückfrage die vollständige Sessionübergabe nach der "
        "Konvention dieses Repos durchführen (globale CLAUDE.md, Abschnitt „Automatische "
        "Sessionübergabe ab 60 % Kontext“). Den laufenden Mikro-Schritt beenden oder als "
        "Zwischenstand committen; laufende Hintergrundläufe und Absprachen mit anderen Sitzungen "
        "gehören in den Handover; die Folgesitzung starten, sofern der Kickoff offene oder rote "
        "Punkte führt. Danach hält sich diese Sitzung aus dem Strang heraus: keine Fragen, keine "
        "Entscheidungen mehr vorlegen; die Schlussmeldung nennt nur, dass übergeben ist, wo "
        "Kickoff und Handover liegen und welche Folgesitzung läuft.",
    70: "Deutliche Schwelle: die Übergabe ab 60 % ist überfällig. Ist sie noch nicht geschehen, "
        "jetzt ohne Rückfrage übergeben und keinen neuen Arbeitsblock beginnen. Ist sie "
        "geschehen, im Strang nichts mehr tun.",
    85: "Kritische Schwelle: keine neuen Nachlade-Reads. Ist die Übergabe noch nicht geschehen, "
        "sofort ohne Rückfrage übergeben, bevor Auto-Compact die scharfen Details verdichtet. "
        "Ist sie geschehen, im Strang nichts mehr tun.",
}


def meldung_standard(pct, tokens, window, reached, herkunft):
    """Rückfall-Meldung des Rahmens, falls die regionseigene meldung() wirft."""
    return (
        "KONTEXTLAST ~%d%% (Hook check-kontextlast, Standardtext des Rahmens)\n\n"
        "Echte Kontextfüllung: ~%dk von ~%dk Token (jüngster usage-Eintrag des Transcripts; "
        "Schwelle %d%% erreicht; Fenster aus: %s, justierbar via CLAUDE_CONTEXT_WINDOW).\n\n"
        "%s"
        % (pct, round(tokens / 1000), round(window / 1000), reached, herkunft,
           STANDARD_REAKTION[reached])
    )


# === KONTEXTLAST-TEXTE ANFANG (repo-spezifisch, vom Sync nicht angetastet) ===
# Alles zwischen diesen beiden Markern gehört diesem Repo. Der Sync rendert den
# Rahmen darum herum neu und lässt diese Region unverändert stehen. Pflicht ist
# genau eine Funktion:
#
#     meldung(pct, tokens, window, reached, herkunft) -> str
#
# pct = Prozent (int), tokens/window = absolute Token (int), reached = erreichte
# Schwelle (int), herkunft = woher das Fenster stammt (str). Konstanten, die nur
# der Meldungstext braucht, gehören ebenfalls hierher.

REAKTION = {
    50: "Leise Schwelle: den Stand dem User sichtbar nennen (absolute Token-Zahl, Prozent, "
        "Schwelle). Noch keine Übergabe; den laufenden Mikro-Auftrag so schneiden, dass er vor "
        "60 % committet ist. Ab 60 % übergibt die Sitzung automatisch.",
    60: "Übergabe-Schwelle: jetzt ohne Rückfrage die vollständige Sessionübergabe nach der "
        "Konvention dieses Repos durchführen (globale CLAUDE.md, Abschnitt „Automatische "
        "Sessionübergabe ab 60 % Kontext“). Den laufenden Mikro-Schritt beenden oder als "
        "Zwischenstand committen; laufende Hintergrundläufe und Absprachen mit anderen Sitzungen "
        "gehören in den Handover; die Folgesitzung starten, sofern der Kickoff offene oder rote "
        "Punkte führt. Danach hält sich diese Sitzung aus dem Strang heraus: keine Fragen, keine "
        "Entscheidungen mehr vorlegen; die Schlussmeldung nennt nur, dass übergeben ist, wo "
        "Kickoff und Handover liegen und welche Folgesitzung läuft.",
    70: "Deutliche Schwelle: die Übergabe ab 60 % ist überfällig. Ist sie noch nicht geschehen, "
        "jetzt ohne Rückfrage übergeben und keinen neuen Arbeitsblock beginnen. Ist sie "
        "geschehen, im Strang nichts mehr tun.",
    85: "Kritische Schwelle: keine neuen Nachlade-Reads. Ist die Übergabe noch nicht geschehen, "
        "sofort ohne Rückfrage übergeben, bevor Auto-Compact die scharfen Details verdichtet. "
        "Ist sie geschehen, im Strang nichts mehr tun.",
}

UEBERGABE_HINWEIS = (
    "Bei Übergabe: ordentliche Übergabe nach der Konvention des XrmForge-Workspace-Repos "
    "(dort liegen Session-State und Arbeitsregeln); dieses Produkt-Repo hat kein eigenes "
    "Session-System."
)


def meldung(pct, tokens, window, reached, herkunft):
    """Der an Claude gemeldete Text. Repo-spezifisch, aus der Vorgängerfassung übernommen."""
    tk = round(tokens / 1000)
    wk = round(window / 1000)
    return (
            "KONTEXTLAST ~%d%% (Hook check-kontextlast)\n\n"
            "Echte Kontextfüllung: ~%dk von ~%dk Token (jüngster usage-Eintrag des Transcripts; "
            "Schwelle %d%% erreicht; Fenster aus: %s, justierbar via CLAUDE_CONTEXT_WINDOW).\n\n"
            "%s\n\n"
            "%s"
            % (pct, tk, wk, reached, herkunft, REAKTION[reached], UEBERGABE_HINWEIS)
        )


# === KONTEXTLAST-TEXTE ENDE ===


def main():
    raw = ''
    try:
        raw = sys.stdin.read()
    except Exception:
        pass
    try:
        data = json.loads(raw) if raw else {}
    except Exception:
        return 0

    transcript_path = data.get('transcript_path', '')
    session_id = data.get('session_id', 'unknown')
    ereignis = data.get('hook_event_name') or 'UserPromptSubmit'

    # Im Subagenten schweigen und den State nicht anfassen: sonst markierte ein voller Subagent
    # die Schwelle der Hauptsitzung als gemeldet (ADR-2026-11-07-190610).
    teile_pfad = transcript_path.replace('\\', '/').split('/')
    if data.get('agent_id') or 'subagents' in teile_pfad:
        return 0

    tokens, modell = kontext_tokens(transcript_path)
    if not tokens:
        return 0

    window, herkunft = fenster_ableiten(modell)
    pct = tokens * 100 // window

    # höchste bereits gemeldete Schwelle aus dem State-File
    state_dir = os.path.join(tempfile.gettempdir(), 'claude-kontextlast')
    try:
        os.makedirs(state_dir, exist_ok=True)
    except Exception:
        pass
    state_file = os.path.join(state_dir, 'session-' + str(session_id) + '.json')
    last_level = 0
    absolut_gemeldet = False
    try:
        with open(state_file, encoding='utf-8') as fh:
            st = json.load(fh)
            # lastSchwelle: Altbestand aus Innoform, damit ein laufender State nicht neu feuert.
            last_level = int(st.get('lastLevel', st.get('lastSchwelle', 0)) or 0)
            absolut_gemeldet = bool(st.get('absolutGemeldet', False))
    except Exception:
        last_level = 0

    teile = []

    due = [s for s in SCHWELLEN if pct >= s and s > last_level]
    if due:
        reached = max(due)
        last_level = reached
        try:
            teile.append(meldung(pct, tokens, window, reached, herkunft))
        except Exception:
            # Die Region kennt die Schwelle nicht (oder ist defekt): Rahmen meldet selbst,
            # damit die Übergabe-Anweisung nicht still entfällt (ADR-2026-11-07-122259).
            try:
                teile.append(meldung_standard(pct, tokens, window, reached, herkunft))
            except Exception:
                pass

    # Absolute Schwelle: einmal je Anstieg, nach dem Unterschreiten (Komprimieren) wieder scharf.
    schwelle = schwelle_absolut(os.environ.get('CLAUDE_PROJECT_DIR') or data.get('cwd') or '')
    if schwelle is None or tokens < schwelle:
        absolut_gemeldet = False
    elif not absolut_gemeldet:
        absolut_gemeldet = True
        try:
            text_absolut = globals().get('meldung_absolut') or meldung_absolut_standard
            teile.append(text_absolut(tokens, schwelle))
        except Exception:
            pass

    try:
        with open(state_file, 'w', encoding='utf-8') as fh:
            json.dump({'lastLevel': last_level, 'absolutGemeldet': absolut_gemeldet}, fh)
    except Exception:
        pass

    if not teile:
        return 0
    msg = '\n\n'.join(teile)

    print(json.dumps({'hookSpecificOutput': {'hookEventName': ereignis,
                                             'additionalContext': msg}}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
