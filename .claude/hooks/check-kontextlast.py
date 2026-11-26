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

Vor jeder Zahl prüft der Hook, ob das Transcript lebt, und meldet sonst einmal je Ursache
„nicht messbar“ ohne Zahl: interaktive Kindsitzung mit geerbtem CLAUDE_CODE_CHILD_SESSION ohne
CLAUDE_CODE_FORCE_SESSION_PERSISTENCE (schreibt kein Transcript), fehlendes Transcript, oder ein
Transcript, das seit dem Vorlauf nicht gewachsen ist und dessen usage-Eintrag und Datei älter
als ALTER_SCHWELLE_S sind (ADR-2026-11-26-075544 im Repo claudecode).

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
            size = fh.tell()
            if size > LESE_ENDE_BYTES:
                fh.seek(size - LESE_ENDE_BYTES)
                daten = fh.read()
                # Die erste Zeile ist angeschnitten und wird verworfen.
                daten = daten.split(b'\n', 1)[1] if b'\n' in daten else b''
                return daten.decode('utf-8', errors='replace').split('\n')
            fh.seek(0)
        return fh.read().decode('utf-8', errors='replace').split('\n')


def kontext_tokens(transcript_path):
    """Jüngster usage-Eintrag: (Summe der Eingabe-Token, Modell) = aktuelle Kontextfüllung."""
    tokens, modell, _zeit = kontext_stand(transcript_path)
    return tokens, modell


def kontext_stand(transcript_path):
    """Jüngster usage-Eintrag: (Token, Modell, Zeitstempel)."""
    if not transcript_path or not os.path.isfile(transcript_path):
        return None, None, None
    for nur_ende in (True, False):
        try:
            lines = _zeilen(transcript_path, nur_ende)
        except Exception:
            return None, None, None
        ergebnis = _juengster_usage(lines)
        if ergebnis[0]:
            return ergebnis
        if nur_ende and os.path.getsize(transcript_path) <= LESE_ENDE_BYTES:
            break
    return None, None, None


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
            return total, (nachricht.get('model') or obj.get('model')), obj.get('timestamp')
    return None, None, None


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


# --- Nicht messbar (ADR-2026-11-26-075544 im Repo claudecode) ---------------------------------
# Drei Fälle ergeben „nicht messbar“ statt einer Zahl: eine interaktive Kindsitzung, die kein
# Transcript schreibt; ein fehlendes Transcript; ein Transcript, das nicht mehr wächst. Die
# Logik liegt nur hier; werkzeuge/kontextlast/messen.py lädt sie aus diesem Template.
#
# Schwelle für „Transcript steht“: usage-Eintrag UND Datei älter als 900 s. Gemessen am
# 26.11.2026 auf MAIN-PC: 499 echte Selbstmessungen höchstens 47 s alt; Dauer eines
# Modellschritts p99,9 160,9 s (133.746 Schritte). Die Datei zählt mit, weil eine interaktive
# CLI ohne Eager-Flush den laufenden Schritt erst nach dem PostToolUse-Hook schreibt; dann ist
# der usage-Eintrag nach jeder Pause alt, die Datei aber frisch.
ALTER_SCHWELLE_S = 900
ABHILFE_NICHT_MESSBAR = (
    "Abhilfe: die Sitzung neu starten mit CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 beim Start, "
    "etwa PowerShell `$env:CLAUDE_CODE_FORCE_SESSION_PERSISTENCE='1'; wt -w 0 nt -d <repo> claude ...` "
    "oder Bash `CLAUDE_CODE_FORCE_SESSION_PERSISTENCE=1 claude ...`. Eine laufende Sitzung lässt "
    "sich nicht umstellen; ein späteres --resume setzt beim letzten geschriebenen Eintrag auf."
)
_UNBESTIMMT = object()
_CLI_NAMEN = ('claude', 'claude.exe')


def _vorfahren_windows():
    """Liste (Name, Kommandozeile) der Vorfahren dieses Prozesses, nächster zuerst."""
    import ctypes
    from ctypes import wintypes

    class _Eintrag(ctypes.Structure):
        _fields_ = [('dwSize', wintypes.DWORD), ('cntUsage', wintypes.DWORD),
                    ('th32ProcessID', wintypes.DWORD), ('th32DefaultHeapID', ctypes.c_void_p),
                    ('th32ModuleID', wintypes.DWORD), ('cntThreads', wintypes.DWORD),
                    ('th32ParentProcessID', wintypes.DWORD), ('pcPriClassBase', ctypes.c_long),
                    ('dwFlags', wintypes.DWORD), ('szExeFile', ctypes.c_wchar * 260)]

    class _UString(ctypes.Structure):
        _fields_ = [('Length', wintypes.USHORT), ('MaximumLength', wintypes.USHORT),
                    ('Buffer', ctypes.c_void_p)]

    k32 = ctypes.WinDLL('kernel32', use_last_error=True)
    ntdll = ctypes.WinDLL('ntdll')
    k32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    k32.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    k32.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.c_void_p]
    k32.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.c_void_p]
    k32.OpenProcess.restype = wintypes.HANDLE
    k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    k32.CloseHandle.argtypes = [wintypes.HANDLE]
    ntdll.NtQueryInformationProcess.restype = ctypes.c_long
    ntdll.NtQueryInformationProcess.argtypes = [wintypes.HANDLE, wintypes.ULONG, ctypes.c_void_p,
                                                wintypes.ULONG, ctypes.POINTER(wintypes.ULONG)]

    eltern, namen = {}, {}
    snap = k32.CreateToolhelp32Snapshot(0x2, 0)
    if not snap or snap == wintypes.HANDLE(-1).value:
        return []
    try:
        eintrag = _Eintrag()
        eintrag.dwSize = ctypes.sizeof(_Eintrag)
        ok = k32.Process32FirstW(snap, ctypes.byref(eintrag))
        while ok:
            eltern[eintrag.th32ProcessID] = eintrag.th32ParentProcessID
            namen[eintrag.th32ProcessID] = eintrag.szExeFile
            ok = k32.Process32NextW(snap, ctypes.byref(eintrag))
    finally:
        k32.CloseHandle(snap)

    shell32 = ctypes.WinDLL('shell32')
    shell32.CommandLineToArgvW.restype = ctypes.POINTER(wintypes.LPWSTR)
    shell32.CommandLineToArgvW.argtypes = [wintypes.LPCWSTR, ctypes.POINTER(ctypes.c_int)]
    k32.LocalFree.argtypes = [ctypes.c_void_p]

    def argumente(zeile):
        """Argumentliste nach den Windows-Regeln (CommandLineToArgvW), wie der Prozess sie sah."""
        if not zeile:
            return []
        anzahl = ctypes.c_int(0)
        feld = shell32.CommandLineToArgvW(zeile, ctypes.byref(anzahl))
        if not feld:
            return None
        try:
            return [feld[i] for i in range(anzahl.value)]
        finally:
            k32.LocalFree(feld)

    def kommandozeile(pid):
        h = k32.OpenProcess(0x1000, False, pid)   # PROCESS_QUERY_LIMITED_INFORMATION
        if not h:
            return None
        try:
            laenge = wintypes.ULONG(0)
            ntdll.NtQueryInformationProcess(h, 60, None, 0, ctypes.byref(laenge))
            puffer = ctypes.create_string_buffer(max(laenge.value, 64))
            if ntdll.NtQueryInformationProcess(h, 60, puffer, len(puffer), ctypes.byref(laenge)) != 0:
                return None
            us = _UString.from_buffer(puffer)
            return ctypes.wstring_at(us.Buffer, us.Length // 2) if us.Buffer else ''
        finally:
            k32.CloseHandle(h)

    kette, pid, gesehen = [], eltern.get(os.getpid()), set()
    while pid and pid not in gesehen and len(kette) < 16 and pid in namen:
        gesehen.add(pid)
        kette.append((namen[pid], argumente(kommandozeile(pid))))
        pid = eltern.get(pid)
    return kette


def _vorfahren_posix():
    import subprocess
    kette, pid, gesehen = [], os.getppid(), set()
    while pid and pid > 1 and pid not in gesehen and len(kette) < 16:
        gesehen.add(pid)
        try:
            with open('/proc/%d/cmdline' % pid, 'rb') as fh:
                argv = [a.decode('utf-8', 'replace') for a in fh.read().split(b'\0')]
            while argv and argv[-1] == '':
                argv.pop()
            with open('/proc/%d/stat' % pid) as fh:
                eltern = int(fh.read().rsplit(')', 1)[1].split()[1])
        except Exception:
            # macOS ohne /proc: ps liefert nur den zusammengefügten Text. Grenze: ein Prompt, der
            # durch Leerzeichen getrennt genau „-p“ oder „--output-format stream-json“ enthält,
            # gilt dort als nicht interaktiv; die Prüfung schlägt dann nicht an (nie fälschlich).
            try:
                aus = subprocess.run(['ps', '-ww', '-o', 'ppid=', '-o', 'args=', '-p', str(pid)],
                                     capture_output=True, text=True, timeout=3).stdout.strip()
                eltern_text, _, zeile = aus.partition(' ')
                eltern = int(eltern_text)
                argv = zeile.strip().split()
            except Exception:
                break
        erstes = argv[0] if argv else ''
        kette.append((os.path.basename(erstes), argv))
        pid = eltern
    return kette


def claude_kommandozeile():
    """Argumentliste des nächsten claude-Vorfahren (CLI oder node mit @anthropic-ai), sonst None."""
    try:
        kette = _vorfahren_windows() if os.name == 'nt' else _vorfahren_posix()
    except Exception:
        return None
    for name, argv in kette:
        name = (name or '').lower()
        if argv is None:
            continue
        if name in _CLI_NAMEN:
            return argv
        if name in ('node', 'node.exe') and any('@anthropic-ai' in a for a in argv):
            return argv
    return None


def sitzungsart(argv):
    """'print' (claude -p), 'host' (Desktop/SDK über stream-json), 'interaktiv' oder None.

    Gemessen am 26.11.2026: Die Umgebung (auch CLAUDE_CODE_ENTRYPOINT) wird geerbt und trennt
    die drei nicht; die Argumente des claude-Prozesses tun es. Verglichen wird je ganzem Argument,
    damit ein Startprompt, der diese Wörter enthält, nichts auslöst."""
    if not argv:
        return None
    if isinstance(argv, str):
        argv = argv.split()
    teile = list(argv[1:])
    if '-p' in teile or '--print' in teile or any(t.startswith('--print=') for t in teile):
        return 'print'
    for i, t in enumerate(teile):
        if t in ('--input-format=stream-json', '--output-format=stream-json'):
            return 'host'
        if t in ('--input-format', '--output-format') and i + 1 < len(teile) and teile[i + 1] == 'stream-json':
            return 'host'
    return 'interaktiv'


def marker_ohne_persistenz(umgebung=None):
    """CLAUDE_CODE_CHILD_SESSION gesetzt und CLAUDE_CODE_FORCE_SESSION_PERSISTENCE nicht."""
    env = os.environ if umgebung is None else umgebung
    return (_ist_gesetzt(env.get('CLAUDE_CODE_CHILD_SESSION', ''))
            and not _ist_gesetzt(env.get('CLAUDE_CODE_FORCE_SESSION_PERSISTENCE', '')))


def _alter(zeitstempel, jetzt):
    if not zeitstempel:
        return None
    try:
        from datetime import datetime
        return jetzt - datetime.fromisoformat(str(zeitstempel).replace('Z', '+00:00')).timestamp()
    except Exception:
        return None


def nicht_messbar_grund(transcript_path, ereignis=None, dauer_s=0.0, vorher_groesse=None,
                        vorher_laeufe=None, eigen=True, umgebung=None,
                        kommandozeile=_UNBESTIMMT, art=_UNBESTIMMT, jetzt=None):
    """(Grund, Einzelheiten). Grund ist None, 'kindsitzung', 'transcript_fehlt' oder 'transcript_steht'.

    vorher_laeufe None heißt Aufruf ohne Hook-Verlauf (messen.py); dann zählt die Existenz immer
    und „steht“ ohne Wachstumsvergleich. Im Hook (vorher_laeufe gesetzt) zählt ein Fehlen erst an
    PostToolUse oder ab dem zweiten Lauf, „steht“ nur bei unveränderter Größe seit dem Vorlauf."""
    import time
    jetzt = time.time() if jetzt is None else jetzt
    env = os.environ if umgebung is None else umgebung
    details = {'marker_ohne_persistenz': marker_ohne_persistenz(env), 'eigen': eigen}
    if eigen and details['marker_ohne_persistenz']:
        if art is _UNBESTIMMT:
            art = sitzungsart(claude_kommandozeile() if kommandozeile is _UNBESTIMMT else kommandozeile)
        details['sitzungsart'] = art
        if details['sitzungsart'] == 'interaktiv':
            return 'kindsitzung', details
    hook = vorher_laeufe is not None
    if not transcript_path or not os.path.isfile(transcript_path):
        details['transcript'] = transcript_path
        if not hook or ereignis == 'PostToolUse' or vorher_laeufe > 0:
            return 'transcript_fehlt', details
        return None, details
    try:
        groesse = os.path.getsize(transcript_path)
        datei_alter = jetzt - os.path.getmtime(transcript_path)
    except Exception:
        return None, details
    details.update(groesse=groesse, datei_alter=datei_alter)
    if not eigen:
        return None, details
    tokens, modell, zeit = kontext_stand(transcript_path)
    usage_alter = _alter(zeit, jetzt)
    details.update(usage_alter=usage_alter, tokens=tokens, modell=modell)
    if usage_alter is None:
        return None, details
    if hook and (vorher_groesse is None or groesse != vorher_groesse):
        return None, details
    if usage_alter > ALTER_SCHWELLE_S and datei_alter - (dauer_s or 0.0) > ALTER_SCHWELLE_S:
        return 'transcript_steht', details
    return None, details


def meldung_nicht_messbar_standard(grund, details):
    """Meldung ohne Zahl. Ein Repo kann sie mit meldung_nicht_messbar(grund, details) ersetzen."""
    if grund == 'kindsitzung':
        ursache = ("Diese interaktive Claude-Code-Sitzung hat CLAUDE_CODE_CHILD_SESSION geerbt "
                   "(sie wurde aus einer anderen Claude-Sitzung heraus gestartet), und "
                   "CLAUDE_CODE_FORCE_SESSION_PERSISTENCE ist nicht gesetzt. Claude Code schreibt "
                   "dann kein Transcript; jede Zahl daraus fehlt oder ist alt.")
    elif grund == 'transcript_fehlt':
        ursache = "Die Transcript-Datei %s existiert nicht." % (details.get('transcript') or '(kein Pfad)')
    else:
        ursache = ("Das Transcript wächst nicht mehr: jüngster usage-Eintrag vor %d s, Datei "
                   "zuletzt geschrieben vor %d s (Schwelle %d s)."
                   % (round(details.get('usage_alter') or 0), round(details.get('datei_alter') or 0),
                      ALTER_SCHWELLE_S))
    if (grund != 'kindsitzung' and details.get('marker_ohne_persistenz') and details.get('eigen', True)
            and details.get('sitzungsart') not in ('host', 'print')):
        ursache += (" CLAUDE_CODE_CHILD_SESSION ist gesetzt, CLAUDE_CODE_FORCE_SESSION_PERSISTENCE "
                    "nicht; das ist die wahrscheinliche Ursache.")
    return (
        "KONTEXTFÜLLUNG NICHT MESSBAR (Hook check-kontextlast)\n\n"
        "Ursache: %s\n\n%s\n\n"
        "Folge: keine Zahl zur Kontextfüllung nennen, auch keine geschätzte. Die 60-%%-Regel "
        "(Verdichten oder Übergabe) kann ohne Messwert nicht auslösen; den Stand dem User als "
        "nicht messbar melden, er entscheidet über die Übergabe. Hintergrund: Repo claudecode, "
        "system-notizen/kontextfuellung-selbst-messen.md." % (ursache, ABHILFE_NICHT_MESSBAR)
    )


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
        "60 % committet ist. Ab 60 % verdichtet die Sitzung, wenn ihr Strang weiterläuft, "
        "sonst übergibt sie automatisch.",
    60: "60-%-Schwelle, ohne Rückfrage handeln (globale CLAUDE.md, Abschnitt „Automatische "
        "Sessionübergabe ab 60 % Kontext“, ADR-2026-11-15-070648). VERDICHTEN, wenn der Strang "
        "in dieser Sitzung weiterläuft (offene grüne oder gelbe Punkte, kein Strangwechsel, kein "
        "Sessionende) und das Werkzeug mcp__kontext-wache__verdichten verfügbar ist: erst den "
        "vollständigen Checkpoint („alles gut“, Schritte 0 bis 5: Wissen wegschreiben, lebender "
        "Stand, Journal, Commit und Push), dann das Werkzeug mit Strang, Stand-Dateien und "
        "nächstem Schritt aufrufen und den Turn sofort beenden, ohne im Schlusssatz einen "
        "nächsten Schritt anzukündigen; lehnt es ab, den genannten Grund beheben und erneut "
        "aufrufen. SONST die vollständige Sessionübergabe nach der Konvention dieses Repos: "
        "den laufenden Mikro-Schritt beenden oder als Zwischenstand committen; laufende "
        "Hintergrundläufe und Absprachen mit anderen Sitzungen gehören in den Handover; die "
        "Folgesitzung starten, sofern der Kickoff offene oder rote Punkte führt. Danach hält sich "
        "diese Sitzung aus dem Strang heraus: keine Fragen, keine Entscheidungen mehr vorlegen; "
        "die Schlussmeldung nennt nur, dass übergeben ist, wo Kickoff und Handover liegen und "
        "welche Folgesitzung läuft.",
    70: "Deutliche Schwelle: Verdichtung oder Übergabe ab 60 % ist überfällig. Ist keins von "
        "beiden geschehen, jetzt ohne Rückfrage nachholen, nach derselben Regel wie bei 60 % "
        "(verdichten, wenn der Strang weiterläuft und mcp__kontext-wache__verdichten verfügbar "
        "ist, sonst vollständige Sessionübergabe), und keinen neuen Arbeitsblock beginnen. Ist "
        "übergeben, im Strang nichts mehr tun.",
    85: "Kritische Schwelle: keine neuen Nachlade-Reads. Ist weder verdichtet noch übergeben, "
        "sofort ohne Rückfrage nachholen, nach derselben Regel wie bei 60 % (verdichten über "
        "mcp__kontext-wache__verdichten, wenn der Strang weiterläuft und das Werkzeug verfügbar "
        "ist, sonst vollständige Sessionübergabe), bevor Auto-Compact die scharfen Details "
        "verdichtet. Ist übergeben, im Strang nichts mehr tun.",
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
        "60 % committet ist. Ab 60 % verdichtet die Sitzung, wenn ihr Strang weiterläuft, "
        "sonst übergibt sie automatisch.",
    60: "60-%-Schwelle, ohne Rückfrage handeln (globale CLAUDE.md, Abschnitt „Automatische "
        "Sessionübergabe ab 60 % Kontext“, ADR-2026-11-15-070648). VERDICHTEN, wenn der Strang "
        "in dieser Sitzung weiterläuft (offene grüne oder gelbe Punkte, kein Strangwechsel, kein "
        "Sessionende) und das Werkzeug mcp__kontext-wache__verdichten verfügbar ist: erst den "
        "vollständigen Checkpoint („alles gut“, Schritte 0 bis 5: Wissen wegschreiben, lebender "
        "Stand, Journal, Commit und Push), dann das Werkzeug mit Strang, Stand-Dateien und "
        "nächstem Schritt aufrufen und den Turn sofort beenden, ohne im Schlusssatz einen "
        "nächsten Schritt anzukündigen; lehnt es ab, den genannten Grund beheben und erneut "
        "aufrufen. SONST die vollständige Sessionübergabe nach der Konvention dieses Repos: "
        "den laufenden Mikro-Schritt beenden oder als Zwischenstand committen; laufende "
        "Hintergrundläufe und Absprachen mit anderen Sitzungen gehören in den Handover; die "
        "Folgesitzung starten, sofern der Kickoff offene oder rote Punkte führt. Danach hält sich "
        "diese Sitzung aus dem Strang heraus: keine Fragen, keine Entscheidungen mehr vorlegen; "
        "die Schlussmeldung nennt nur, dass übergeben ist, wo Kickoff und Handover liegen und "
        "welche Folgesitzung läuft.",
    70: "Deutliche Schwelle: Verdichtung oder Übergabe ab 60 % ist überfällig. Ist keins von "
        "beiden geschehen, jetzt ohne Rückfrage nachholen, nach derselben Regel wie bei 60 % "
        "(verdichten, wenn der Strang weiterläuft und mcp__kontext-wache__verdichten verfügbar "
        "ist, sonst vollständige Sessionübergabe), und keinen neuen Arbeitsblock beginnen. Ist "
        "übergeben, im Strang nichts mehr tun.",
    85: "Kritische Schwelle: keine neuen Nachlade-Reads. Ist weder verdichtet noch übergeben, "
        "sofort ohne Rückfrage nachholen, nach derselben Regel wie bei 60 % (verdichten über "
        "mcp__kontext-wache__verdichten, wenn der Strang weiterläuft und das Werkzeug verfügbar "
        "ist, sonst vollständige Sessionübergabe), bevor Auto-Compact die scharfen Details "
        "verdichtet. Ist übergeben, im Strang nichts mehr tun.",
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

    # höchste bereits gemeldete Schwelle aus dem State-File
    # Ohne nutzbares Temp-Verzeichnis läuft der Hook ohne State weiter: eine sicher erkennbare
    # Ursache (Kindsitzung, fehlendes Transcript an PostToolUse) wird trotzdem gemeldet.
    try:
        state_dir = os.path.join(tempfile.gettempdir(), 'claude-kontextlast')
        os.makedirs(state_dir, exist_ok=True)
        state_file = os.path.join(state_dir, 'session-' + str(session_id) + '.json')
    except Exception:
        state_file = None
    st = {}
    try:
        with open(state_file, encoding='utf-8') as fh:
            st = json.load(fh)
        if not isinstance(st, dict):
            st = {}
    except Exception:
        st = {}
    try:
        # lastSchwelle: Altbestand aus Innoform, damit ein laufender State nicht neu feuert.
        last_level = int(st.get('lastLevel', st.get('lastSchwelle', 0)) or 0)
    except Exception:
        last_level = 0
    absolut_gemeldet = bool(st.get('absolutGemeldet', False))

    def state_schreiben():
        if not state_file:
            return
        try:
            with open(state_file, 'w', encoding='utf-8') as fh:
                json.dump(st, fh)
        except Exception:
            pass

    # Nicht messbar (ADR-2026-11-26-075544): vor jeder Zahl prüfen, ob das Transcript lebt.
    try:
        dauer_s = float(data.get('duration_ms') or 0) / 1000.0
    except Exception:
        dauer_s = 0.0
    # Die Sitzungsart wird bei jedem Lauf neu bestimmt (rund 40 ms, nur mit Marker ohne FORCE):
    # nach --resume läuft dieselbe Sitzungs-ID in einem anderen Prozess.
    art = sitzungsart(claude_kommandozeile()) if marker_ohne_persistenz() else _UNBESTIMMT
    st.pop('sitzungsart', None)
    try:
        vorher_laeufe = int(st.get('laeufe', 0) or 0)
    except Exception:
        vorher_laeufe = 0
    grund, details = nicht_messbar_grund(
        transcript_path, ereignis=ereignis, dauer_s=dauer_s, vorher_groesse=st.get('groesse'),
        vorher_laeufe=vorher_laeufe, art=art)
    st['laeufe'] = vorher_laeufe + 1
    st['groesse'] = details.get('groesse')
    if grund:
        if st.get('nichtMessbar') == grund:
            state_schreiben()
            return 0
        st['nichtMessbar'] = grund
        state_schreiben()
        try:
            text = (globals().get('meldung_nicht_messbar') or meldung_nicht_messbar_standard)(grund, details)
        except Exception:
            text = meldung_nicht_messbar_standard(grund, details)
        print(json.dumps({'hookSpecificOutput': {'hookEventName': ereignis,
                                                 'additionalContext': text}}, ensure_ascii=False))
        return 0
    st['nichtMessbar'] = None

    if 'tokens' in details:
        tokens, modell = details['tokens'], details['modell']
    else:
        tokens, modell = kontext_tokens(transcript_path)
    if not tokens:
        state_schreiben()
        return 0

    window, herkunft = fenster_ableiten(modell)
    pct = tokens * 100 // window

    # Nach einer Verdichtung liegt die Füllung unter der gemeldeten Schwelle. Dann zählt nur,
    # was die heutige Füllung schon erreicht hat, sonst bliebe der nächste Anstieg auf 60 %
    # stumm (ADR-2026-11-15-070648).
    if pct < last_level:
        last_level = max([s for s in SCHWELLEN if s <= pct] or [0])

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

    st['lastLevel'] = last_level
    st['absolutGemeldet'] = absolut_gemeldet
    st.pop('lastSchwelle', None)
    state_schreiben()

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
