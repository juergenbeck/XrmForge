#!/usr/bin/env python3
"""PreToolUse-Sperre: blockt Write/Edit/MultiEdit auf .md, wenn der Schreibvorgang
ASCII-Ersatz für Umlaute (ae/oe/ue/ss statt ä/ö/ü/ß) in eine Prosa-Zeile bringt.

AUTO-GENERATED aus ~/.claude/hook-templates/python/block-umlaute.py
(ausgerollt von werkzeuge/hook-sync/Sync-UmlautTriggers.ps1 im Repo claudecode).
Nicht von Hand editieren, sondern am Template ändern und neu syncen.
Entscheid: claudecode ADR-2026-10-10-014632.

Grundsatz: Die Sperre blockt genau das, was der Commit-Check (.githooks/pre-commit.py)
an HINZUGEFÜGTEN Zeilen blocken würde, und nichts darüber hinaus. Sie trifft den Fehler
nur früher, in der Sitzung, in der er entsteht. Dafür lädt sie zur Laufzeit die
pre-commit.py des Repos, in dem die Zieldatei liegt, und benutzt deren load_config,
is_excluded, is_blocking_file und get_umlaut_violations. Die Entscheidungslogik gibt es
damit genau einmal; Allowlist (generated, exceptions, file_scope, enforcement,
block_extensions) wirkt hier wie beim Commit.

Geprüft wird der neue Dateistand gegen den alten, nicht das Fragment: bei Edit und
MultiEdit wird der neue Stand aus der Datei plus den Ersetzungen gebildet. Nur so
erkennt die Lib einen umgebenden Code-Fence, und nur so bleibt eine mitgeführte
Altzeile ungeblockt (der Commit-Check meldet seit ADR-028 nur hinzugefügte Zeilen).
Hinzugefügt sind die Zeilen, die difflib gegenüber dem alten Stand als neu ausweist.

Nicht geblockt werden: Fence-Fundstellen (scope != 'prosa', blocken auch beim Commit
nie), andere Endungen als .md (Typografie in .md/.html regelt block-typografie.py,
Code-Dateien nur der Commit), Dateien, für die das Repo nur warnt (is_blocking_file),
gitignorierte Dateien (werden nie committet) und Dateien ohne .githooks/pre-commit.py
in einem übergeordneten Ordner (kein Repo der Kette, Scratchpad).

Fail-open, strikt: jeder Fehler (kein stdin, JSON kaputt, Import scheitert, Datei nicht
lesbar, old_string nicht gefunden, git nicht aufrufbar) endet mit Exit 0 ohne
Entscheidung. Die einzige blockende Ausgabe entsteht erst, wenn die Prüfung vollständig
durchgelaufen ist; ein Deadlock wie in ADR-2026-06-26-1254 befürchtet ist damit nicht
möglich. Der .githooks-Ordner wird vom Pfad der Zieldatei aufwärts gesucht, nicht über
CLAUDE_PROJECT_DIR, damit ein leerer Scratch-Workspace als Projektordner nichts ändert.

Mechanismus: permissionDecision "deny" via JSON-stdout, Exit 0. ensure_ascii=True gegen
die Windows-cp1252-stdout-Falle; stdin binär lesen und als UTF-8 dekodieren.
"""
import difflib
import importlib.util
import json
import os
import subprocess
import sys

PRECOMMIT_NAME = 'pre-commit.py'
LIB_NAME = 'umlaut_check_lib.py'
MAX_TREFFER_IN_MELDUNG = 5


def finde_repo_wurzel(file_path):
    """Ersten übergeordneten Ordner mit .githooks/pre-commit.py und Lib, sonst None."""
    d = os.path.dirname(os.path.abspath(file_path))
    while True:
        gh = os.path.join(d, '.githooks')
        if (os.path.isfile(os.path.join(gh, PRECOMMIT_NAME))
                and os.path.isfile(os.path.join(gh, LIB_NAME))):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


_GELADEN = {}


def lade_precommit(githooks_dir):
    """pre-commit.py als Modul laden (ihr __main__-Block läuft dabei nicht)."""
    if githooks_dir in _GELADEN:
        return _GELADEN[githooks_dir]
    if githooks_dir not in sys.path:
        sys.path.insert(0, githooks_dir)
    spec = importlib.util.spec_from_file_location(
        '_umlaut_precommit_%d' % len(_GELADEN), os.path.join(githooks_dir, PRECOMMIT_NAME))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    _GELADEN[githooks_dir] = mod
    return mod


def lies(path):
    """Dateiinhalt wie der Commit-Check ihn liest (utf-8-sig), Zeilenenden normalisiert."""
    with open(path, encoding='utf-8-sig') as fh:
        return fh.read()


def staende(tool, ti, file_path):
    """(alter Stand, neuer Stand) als Text, oder None, wenn nicht bildbar."""
    vorhanden = os.path.isfile(file_path)
    alt = lies(file_path) if vorhanden else ''
    if tool == 'Write':
        neu = ti.get('content')
        if not isinstance(neu, str):
            return None
        return alt, neu.replace('\r\n', '\n')
    if tool == 'Edit':
        edits = [ti]
    elif tool == 'MultiEdit':
        edits = ti.get('edits')
        if not isinstance(edits, list):
            return None
    else:
        return None
    neu = alt
    for e in edits:
        if not isinstance(e, dict):
            return None
        o = e.get('old_string')
        n = e.get('new_string')
        if not isinstance(o, str) or not isinstance(n, str):
            return None
        o = o.replace('\r\n', '\n')
        n = n.replace('\r\n', '\n')
        if o == '':
            if neu != '':
                return None
            neu = n
            continue
        anzahl = neu.count(o)
        if anzahl == 0:
            return None
        if e.get('replace_all'):
            neu = neu.replace(o, n)
        else:
            if anzahl > 1:
                return None
            neu = neu.replace(o, n, 1)
    return alt, neu


def hinzugefuegte_zeilen(alt_lines, neu_lines):
    """1-basierte Zeilennummern im neuen Stand, die gegenüber dem alten neu sind."""
    if not alt_lines or alt_lines == ['']:
        return set(range(1, len(neu_lines) + 1))
    sm = difflib.SequenceMatcher(None, alt_lines, neu_lines, autojunk=False)
    added = set()
    for tag, _i1, _i2, j1, j2 in sm.get_opcodes():
        if tag in ('replace', 'insert'):
            added.update(range(j1 + 1, j2 + 1))
    return added


def ist_gitignoriert(repo_root, rel):
    """True nur bei sicherer Auskunft von git; jeder Fehler gilt als ignoriert (fail-open)."""
    try:
        r = subprocess.run(['git', '-C', repo_root, 'check-ignore', '-q', '--', rel],
                           capture_output=True, timeout=5)
    except Exception:
        return True
    if r.returncode == 0:
        return True
    if r.returncode == 1:
        return False
    return True


def pruefe(tool, ti):
    """Liste der blockenden Fundstellen (dicts der Lib) für diesen Aufruf, oder []."""
    file_path = str(ti.get('file_path') or '')
    if not file_path.lower().endswith('.md'):
        return []
    file_path = os.path.abspath(file_path)
    root = finde_repo_wurzel(file_path)
    if root is None:
        return []
    st = staende(tool, ti, file_path)
    if st is None:
        return []
    alt, neu = st
    return bewerte(file_path, root, alt, neu)


def bewerte(file_path, root, alt, neu):
    """Blockende Fundstellen für den Übergang alt -> neu einer .md im Repo root.
    Eigene Funktion, damit Messwerkzeuge denselben Weg mit rekonstruiertem Vorstand
    gehen können, statt ihn nachzubauen."""
    githooks_dir = os.path.join(root, '.githooks')
    pc = lade_precommit(githooks_dir)
    cfg = pc.load_config(githooks_dir)
    rel = os.path.relpath(file_path, root).replace('\\', '/')
    if rel.startswith('../'):
        return []
    if pc.is_excluded(rel, cfg['file_scope'], cfg['generated'], cfg['exceptions']):
        return []
    if not pc.is_blocking_file(rel, cfg):
        return []
    neu_lines = neu.split('\n')
    treffer = [h for h in pc.get_umlaut_violations(neu_lines, cfg['fence_scope'])
               if h.get('scope', 'prosa') == 'prosa']
    if not treffer:
        return []
    added = hinzugefuegte_zeilen(alt.split('\n'), neu_lines)
    treffer = [h for h in treffer if h['line'] in added]
    if not treffer:
        return []
    if ist_gitignoriert(root, rel):
        return []
    return treffer


def main():
    try:
        raw = sys.stdin.buffer.read().decode('utf-8', errors='replace')
        if not raw:
            return 0
        data = json.loads(raw)
    except Exception:
        return 0
    tool = str(data.get('tool_name') or '')
    ti = data.get('tool_input')
    if tool not in ('Write', 'Edit', 'MultiEdit') or not isinstance(ti, dict):
        return 0
    try:
        treffer = pruefe(tool, ti)
    except Exception:
        return 0
    if not treffer:
        return 0
    beispiele = '; '.join("Z.%d '%s'" % (h['line'], h['match'])
                          for h in treffer[:MAX_TREFFER_IN_MELDUNG])
    reason = (
        "Umlaut-Sperre (.md): ASCII-Ersatz statt echter Umlaute in neu geschriebenen "
        "Zeilen von " + os.path.basename(str(ti.get('file_path'))) + " ("
        + str(len(treffer)) + "): " + beispiele
        + ". Echte Umlaute (ä ö ü ß) schreiben und erneut versuchen. Ist die Stelle "
          "kein Fehler, sondern ein Eigenname, ein Tabellen-, Feld- oder Ordnername "
          "oder das Wort selbst als Gegenstand, gehört sie in Inline-Code; ein "
          "mehrzeiliges wörtliches Fremdzitat gehört in einen Code-Fence; eine Datei "
          "mit Fremddaten wird in .githooks/umlaut-allowlist.json als exceptions-"
          "Eintrag geführt. Die Sperre blockt nur, was auch der Commit-Check dieses "
          "Repos blocken würde (Skill umlaute, Hook block-umlaute)."
    )
    out = {"hookSpecificOutput": {"hookEventName": "PreToolUse",
                                  "permissionDecision": "deny",
                                  "permissionDecisionReason": reason}}
    sys.stdout.write(json.dumps(out, ensure_ascii=True))
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.exit(0)
