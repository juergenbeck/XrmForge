#!/usr/bin/env python3
"""SessionStart-Hook: meldet, wenn eine Regeldatei im Arbeitsbaum auf einen alten Stand zurückgefallen ist.

Anlass (TOOL-0035, 02.09.2026): Die CLAUDE.md im Arbeitsbaum war byte-identisch mit dem
committeten Stand vom 14.04.2026, also viereinhalb Monate alt, und zwar uncommittet. Sie
nannte 15 Pflicht-Skills statt des Drei-Klassen-Modells, `.github/skills` statt
`.claude/skills` und net472 statt net462. Aufgefallen ist es nur zufällig, weil die Datei
während einer laufenden Sitzung neu geladen wurde.

Der Schaden ist still und groß: jede Session, die so startet, arbeitet nach überholten
Regeln, ohne dass irgendetwas warnt. Und weil die Änderung uncommittet ist, schreibt sie
der nächste Commit mit weitem Pathspec versehentlich fest.

Der Hook unterscheidet deshalb genau zwei Fälle, statt jede Abweichung zu melden:

  1. Rückfall: die Arbeitskopie ist byte-identisch mit einem älteren committeten Stand
     derselben Datei. Das ist kein Editieren, sondern ein zurückgeholter Stand. Wird immer
     gemeldet, samt Commit und Datum. Sonderfall (seit dem Reifetest 08.10.2026): entspricht
     die Arbeitskopie genau dem Stand vor der letzten Änderung, meldet der Hook „Rücknahme
     oder veraltet“ und legt sich nicht auf Zurücksetzen fest.
  2. Großer Verlust: die Arbeitskopie weicht ab, entspricht keinem alten Stand, ist aber
     deutlich kürzer als HEAD (Schwelle LOSS_LINES). Wird gemeldet, weil ein abgeschnittener
     oder halb überschriebener Stand denselben Schaden anrichtet.

Eine gewöhnliche Bearbeitung (Datei geändert, kein alter Stand, kein großer Verlust) bleibt
still. Sonst meldete der Hook bei jeder Regelpflege, und genau daran stirbt eine Warnung:
sie wird weggelesen.

Der Hook misst nur und greift nicht ein. Ein Rückfall kann im Einzelfall gewollt sein
(bewusstes Zurücknehmen einer Regel), und ein Hook, der die Datei selbst zurückschreibt,
würde genau die Arbeit verwerfen, die jemand gerade begonnen hat.

Zentral gepflegt im Repo claudecode unter werkzeuge/hook-sync/templates/python/ und von
Sync-UmlautTriggers.ps1 in jedes kit-Repo ausgerollt (ADR-2026-10-11-165331). Im Einzel-Repo
nicht ändern, der nächste Sync überschreibt es. Die Dateiliste RULE_FILES kommt aus dem
Feld `regeldateien` des Repo-Eintrags in umlaute-triggers.json; ohne Feld gilt der Default.
Dieselbe Datei rufen auch die Codex-SessionStart-Hooks auf.
"""

import json
import os
import subprocess
import sys

# Windows-cp1252-stdout-Falle: ohne das schreibt print() die Meldung in der
# Konsolenkodierung, und der Leser bekommt kaputte Umlaute oder gar nichts.
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

# Regeldateien, deren stiller Rückfall teuer ist. Pfade repo-relativ.
# === REGELDATEIEN ANFANG (vom Sync aus umlaute-triggers.json gerendert) ===
RULE_FILES = ['CLAUDE.md', 'AGENTS.md', '.claude/settings.json']
# === REGELDATEIEN ENDE ===

# So viele Commits der jeweiligen Datei werden rückwärts verglichen.
HISTORY_DEPTH = 300

# Ab so vielen fehlenden Zeilen gegenüber HEAD gilt eine Abweichung als großer Verlust.
LOSS_LINES = 50


def git(repo, *args):
    result = subprocess.run(['git', '-C', repo] + list(args),
                            capture_output=True, text=True, encoding='utf-8',
                            errors='replace', timeout=30)
    if result.returncode != 0:
        return None
    return result.stdout


def repo_root():
    here = os.path.dirname(os.path.abspath(__file__))
    out = git(here, 'rev-parse', '--show-toplevel')
    return out.strip() if out else None


def worktree_blob(repo, path):
    if not os.path.exists(os.path.join(repo, path)):
        return None
    out = git(repo, 'hash-object', '--', path)
    return out.strip() if out else None


def historic_blobs(repo, path):
    """Liefert [(commit, blob)] der letzten HISTORY_DEPTH Commits dieser Datei, neueste zuerst."""
    log = git(repo, 'log', '--format=%H', '-n', str(HISTORY_DEPTH), '--', path)
    if not log:
        return []
    commits = [c for c in log.split() if c]
    if not commits:
        return []
    # Ein einziger Aufruf statt einer je Commit, sonst kostet der Hook Sekunden.
    stdin = ''.join('%s:%s\n' % (c, path) for c in commits)
    result = subprocess.run(['git', '-C', repo, 'cat-file', '--batch-check'],
                            input=stdin, capture_output=True, text=True,
                            encoding='utf-8', errors='replace', timeout=30)
    if result.returncode != 0:
        return []
    pairs = []
    for commit, line in zip(commits, result.stdout.splitlines()):
        parts = line.split()
        if parts and len(parts[0]) == 40:
            pairs.append((commit, parts[0]))
    return pairs


def line_count(text):
    return len(text.splitlines()) if text else 0


def check_file(repo, path):
    """Gibt einen Befundtext zurück oder None."""
    current = worktree_blob(repo, path)
    if not current:
        return None

    head = git(repo, 'rev-parse', 'HEAD:%s' % path)
    if not head:
        return None  # nicht getrackt
    head_blob = head.strip()
    if current == head_blob:
        return None  # identisch mit HEAD, alles gut

    history = historic_blobs(repo, path)
    # Der Stand direkt vor der letzten inhaltlichen Änderung: der erste Blob der Historie,
    # der vom HEAD-Blob abweicht (nicht die Listenposition, denn ein Commit ohne
    # Inhaltsänderung an der Datei kann dazwischen stehen).
    previous = None
    last = history[0][0] if history else None  # die Änderung, die previous ablöste
    for commit_, blob_ in history:
        if blob_ != head_blob:
            previous = blob_
            break
        last = commit_
    for commit, blob in history:
        if blob == current and blob != head_blob:
            info = git(repo, 'log', '-1', '--format=%h|%ad|%s',
                       '--date=format:%d.%m.%Y', commit)
            short, date, subject = (info.strip().split('|', 2) if info
                                    else (commit[:9], 'unbekannt', ''))
            if blob == previous:
                # Stand direkt vor der letzten Änderung: entweder deren bewusstes
                # Zurücknehmen oder ein um genau eine Änderung veralteter Stand (etwa aus
                # einem Klon, dem nur der letzte Commit fehlt). Beides ist möglich, die
                # Meldung legt sich deshalb nicht fest. Belegt am 18.08.2026: d2cf60a58
                # stellte .claude/settings.json byte-identisch auf 53ccb1c94 zurück, als
                # ein Hook wieder entfernt wurde.
                linfo = git(repo, 'log', '-1', '--format=%h|%s', last)
                lshort, lsubject = (linfo.strip().split('|', 1) if linfo
                                    else (last[:9], ''))
                return ('RÜCKNAHME ODER VERALTET: %s im Arbeitsbaum entspricht dem Stand vor\n'
                        '  der letzten Änderung dieser Datei (Commit %s, "%s").\n'
                        '  Entweder wird diese Änderung bewusst zurückgenommen, oder der Stand\n'
                        '  stammt aus einer Kopie, der genau diese Änderung fehlt. Prüfen, welcher\n'
                        '  Fall vorliegt; im zweiten zurücksetzen: git restore -- %s'
                        % (path, lshort, lsubject.strip(), path))
            return ('RÜCKFALL: %s im Arbeitsbaum ist byte-identisch mit dem committeten\n'
                    '  Stand vom %s (Commit %s, "%s") und weicht damit von HEAD ab.\n'
                    '  Das ist keine Bearbeitung, sondern ein zurückgeholter alter Stand.\n'
                    '  Prüfen und in aller Regel zurücksetzen: git restore -- %s'
                    % (path, date, short, subject.strip(), path))

    head_text = git(repo, 'show', 'HEAD:%s' % path)
    try:
        with open(os.path.join(repo, path), encoding='utf-8', errors='replace') as handle:
            now_text = handle.read()
    except OSError:
        return None
    missing = line_count(head_text) - line_count(now_text)
    if missing >= LOSS_LINES:
        return ('GROSSER VERLUST: %s ist uncommittet um %d Zeilen kürzer als der committete\n'
                '  Stand (%d statt %d). Kein alter Stand aus der Historie, also entweder eine\n'
                '  bewusste Kürzung oder ein abgeschnittener Stand. Vor dem nächsten Commit\n'
                '  ansehen: git diff -- %s'
                % (path, missing, line_count(now_text), line_count(head_text), path))
    return None


def main():
    try:
        repo = repo_root()
        if not repo:
            return 0
        findings = [f for f in (check_file(repo, p) for p in RULE_FILES) if f]
        if not findings:
            return 0
        message = ('REGELDATEI-WÄCHTER (Hook `check-regeldatei-rueckfall.py`)\n\n'
                   '%s\n\n'
                   'Der Hook misst nur, er ändert nichts. Er meldet einen Rückfall auf einen alten\n'
                   'committeten Stand und einen großen Zeilenverlust; gewöhnliches Bearbeiten bleibt\n'
                   'still. Anlass: Markant TOOL-0035; Entscheid: claudecode ADR-2026-10-11-165331.\n'
                   'Diesen Befund aktiv an den Nutzer weitergeben, er sieht ihn sonst nicht.'
                   % '\n\n'.join(findings))
        print(json.dumps({'hookSpecificOutput': {'hookEventName': 'SessionStart',
                                                 'additionalContext': message}},
                         ensure_ascii=False))
    except Exception:
        return 0  # Fail-open: ein Wächter darf keinen Sessionstart kippen
    return 0


if __name__ == '__main__':
    sys.exit(main())
