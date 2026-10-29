#!/usr/bin/env python3
"""Gemeinsame Logik des Sitzungsregisters.

Ein Eintrag je lebender Sitzung unter `~/.claude/sessions-aktiv/<kennung>.json`, zentral und
NICHT im Repo, weil die folgenreicheren Kollisionen repo-übergreifend sind (ADR-2026-08-29-1805).

Lebendigkeit wird an der Prozesskennung NACHGESCHLAGEN, nicht aus dem Alter des Lebenszeichens
geschätzt: Sitzungen ruhen stundenlang und bleiben dabei anschreibbar (ADR-2026-08-29-1812).
Die Zeitschwelle trennt nur `aktiv` von `ruhend`.

Diese Datei ist die einzige Stelle, an der Zustand und Anspruchsvergleich definiert sind.
Registerschreiber, Kollisionsmelder, Leseweg und Nachweis laden sie, statt sie nachzubauen
(ADR-2026-08-29-1206).

Fail-open: die aufrufenden Hooks fangen jeden Fehler ab und blockieren nie.
"""
from __future__ import annotations

import fnmatch
import json
import os
import re
import tempfile
import time
from pathlib import Path

# Lebenszeichen jünger als das gilt als "arbeitet gerade". Trennt nur aktiv von ruhend und
# entscheidet NIE über Leben und Tod.
AKTIV_SEKUNDEN = 15 * 60

ZUSTAND_AKTIV = 'aktiv'
ZUSTAND_RUHEND = 'ruhend'
ZUSTAND_VERWAIST = 'verwaist'
ZUSTAND_UNBEKANNT = 'unbekannt'

# Rollen aus AGENTS.md, Abschnitt "Parallele Sitzungen". `abnahme` trägt die Rollenteilung:
# eine Sitzung baut, eine zweite nimmt ab und legt ihr Urteil selbst ab (ADR-2026-08-29-221202).
ROLLEN = ('bau', 'abnahme', 'beobachtung')


def register_verzeichnis() -> Path:
    """Zielordner des Registers. Über SITZUNGSREGISTER_DIR umlenkbar (Nachweis, Wegwerf-Register)."""
    eigen = os.environ.get('SITZUNGSREGISTER_DIR')
    if eigen:
        return Path(eigen)
    return Path(os.path.expanduser('~')) / '.claude' / 'sessions-aktiv'


def eigene_session_id() -> str | None:
    for name in ('CLAUDE_CODE_SESSION_ID', 'CLAUDE_SESSION_ID'):
        wert = os.environ.get(name)
        if wert:
            return wert
    return None


def kennung_aus(session_id: str) -> str:
    """Kurzkennung: die ersten sechs Zeichen der Session-ID, wie sie auch im Titel steht."""
    return (session_id or '').replace('-', '')[:6] or 'unbekannt'


def prozess_lebt(pid) -> bool | None:
    """True, False oder None wenn nicht feststellbar. None wird nie zu einer Annahme verdichtet."""
    try:
        pid = int(pid)
    except (TypeError, ValueError):
        return None
    if pid <= 0:
        return None
    if os.name == 'nt':
        try:
            import ctypes
            # PROCESS_QUERY_LIMITED_INFORMATION, reicht auch ohne erhöhte Rechte.
            handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
            if handle:
                ctypes.windll.kernel32.CloseHandle(handle)
                return True
            # 5 = Zugriff verweigert, der Prozess existiert also.
            return True if ctypes.windll.kernel32.GetLastError() == 5 else False
        except Exception:
            return None
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    except Exception:
        return None


def zustand_von(eintrag: dict, jetzt: float | None = None) -> str:
    """aktiv, ruhend, verwaist oder unbekannt. Die Zeitschwelle tötet nie - und belebt nie.

    Der Prozess wird IMMER gefragt, auch bei frischem Lebenszeichen (ADR-2026-08-29-213621). Die
    frühere Abkürzung sparte die Prüfung im 15-Minuten-Fenster und ließ damit beendete Sitzungen
    als `aktiv` gelten; der Riegel blockierte daran echte Commits, und zwar typischerweise bei dem,
    der den Kickoff der eben beendeten Sitzung fortsetzte. Gespart hat sie nichts: gemessen 2 % des
    Aufwands, den ein Registerdurchlauf ohnehin kostet
    (`werkzeuge/sitzungsregister/messe-kosten.py`).

    Die Zeitschwelle trennt nur noch `aktiv` von `ruhend` unter den Lebenden.
    """
    jetzt = time.time() if jetzt is None else jetzt
    alter = alter_sekunden(eintrag, jetzt)
    frisch = alter is not None and alter < AKTIV_SEKUNDEN
    if 'pid' not in eintrag or eintrag.get('pid') in (None, ''):
        return ZUSTAND_AKTIV if frisch else ZUSTAND_UNBEKANNT
    lebt = prozess_lebt(eintrag.get('pid'))
    if lebt is None:
        # Unbestimmbar heißt nicht tot: im Zweifel melden, nicht abräumen.
        return ZUSTAND_AKTIV if frisch else ZUSTAND_UNBEKANNT
    if not lebt:
        return ZUSTAND_VERWAIST
    return ZUSTAND_AKTIV if frisch else ZUSTAND_RUHEND


def alter_sekunden(eintrag: dict, jetzt: float | None = None) -> float | None:
    jetzt = time.time() if jetzt is None else jetzt
    try:
        return max(0.0, jetzt - float(eintrag.get('lebenszeichen')))
    except (TypeError, ValueError):
        return None


def alter_text(sekunden: float | None) -> str:
    if sekunden is None:
        return 'Alter unbekannt'
    if sekunden < 90:
        return 'vor %d Sekunden' % int(sekunden)
    if sekunden < 5400:
        return 'vor %d Minuten' % int(sekunden / 60)
    if sekunden < 172800:
        return 'vor %.1f Stunden' % (sekunden / 3600)
    return 'vor %d Tagen' % int(sekunden / 86400)


def _lies_datei(pfad: Path) -> dict | None:
    try:
        daten = json.loads(pfad.read_text(encoding='utf-8'))
        return daten if isinstance(daten, dict) else None
    except Exception:
        return None


def lies_register(entferne_verwaiste: bool = True, jetzt: float | None = None) -> list[dict]:
    """Alle Einträge mit ihrem Zustand. Verwaiste werden beiläufig entfernt, kein eigener Lauf."""
    verzeichnis = register_verzeichnis()
    ergebnis = []
    try:
        dateien = sorted(verzeichnis.glob('*.json'))
    except Exception:
        return ergebnis
    for pfad in dateien:
        eintrag = _lies_datei(pfad)
        if eintrag is None:
            continue
        zustand = zustand_von(eintrag, jetzt)
        if zustand == ZUSTAND_VERWAIST:
            if entferne_verwaiste:
                try:
                    pfad.unlink()
                except Exception:
                    pass
            continue
        eintrag['zustand'] = zustand
        eintrag['alter_sekunden'] = alter_sekunden(eintrag, jetzt)
        eintrag['_datei'] = str(pfad)
        ergebnis.append(eintrag)
    return ergebnis


def schreibe(eintrag: dict) -> Path:
    """Legt den Eintrag atomar ab (erst temporär, dann ersetzen), damit kein halbes JSON entsteht."""
    verzeichnis = register_verzeichnis()
    verzeichnis.mkdir(parents=True, exist_ok=True)
    ziel = verzeichnis / ('%s.json' % eintrag['kennung'])
    fd, temp = tempfile.mkstemp(dir=str(verzeichnis), suffix='.tmp')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            json.dump(eintrag, fh, ensure_ascii=False, indent=2, sort_keys=True)
        os.replace(temp, ziel)
    except Exception:
        try:
            os.unlink(temp)
        except Exception:
            pass
        raise
    return ziel


def herzschlag(repo: str | None = None, strang: str | None = None,
               rolle: str | None = None) -> Path | None:
    """Legt den eigenen Eintrag an oder frischt ihn auf. Bestehende Ansprüche bleiben erhalten."""
    session_id = eigene_session_id()
    if not session_id:
        return None
    kennung = kennung_aus(session_id)
    vorhanden = _lies_datei(register_verzeichnis() / ('%s.json' % kennung)) or {}
    repo = repo or os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()
    # resolve() vor .name: bei repo='.' wäre der Name sonst leer und die Adresse unvollständig.
    repo_name = Path(repo).resolve().name
    strang = strang or vorhanden.get('strang') or ''
    rolle = rolle or vorhanden.get('rolle') or 'bau'
    eintrag = {
        'kennung': kennung,
        'session_id': session_id,
        'pid': _eigene_pid(),
        'rechner': _rechnername(),
        'repo': str(Path(repo).resolve()).replace('\\', '/'),
        'repo_name': repo_name,
        'strang': strang,
        'rolle': rolle,
        # Die Adresse wird bei JEDEM Herzschlag neu gebildet, nie aus dem Bestand übernommen.
        # Sonst friert sie beim ersten Herzschlag als `bau` ein, und eine Sitzung, die später in
        # die Inspektorrolle wechselt, führt eine Adresse, die ihre Rolle falsch angibt
        # (ADR-2026-08-29-221202).
        'adresse': _adresse(repo_name, strang, rolle, kennung),
        'ansprueche': vorhanden.get('ansprueche') or [],
        'begonnen': vorhanden.get('begonnen') or time.time(),
        'lebenszeichen': time.time(),
    }
    # Ein einmal gemeldeter Anschreibname überlebt jeden Herzschlag: er kommt aus einem
    # ListAgents-Aufruf der Sitzung und ließe sich hier nicht neu beschaffen.
    if vorhanden.get('anschreibname'):
        eintrag['anschreibname'] = vorhanden['anschreibname']
    # Dasselbe gilt für die Referenz: sie stammt aus derselben ListAgents-Ausgabe und wäre hier
    # ebenso wenig neu zu beschaffen (ADR-2026-09-01-195703).
    if vorhanden.get('anschreibreferenz'):
        eintrag['anschreibreferenz'] = vorhanden['anschreibreferenz']
    # Und für die Zeitpunkte der Ansprüche. Ohne diese Zeile löscht JEDER Herzschlag sie - er
    # baut den Eintrag neu auf und übernimmt nur, was hier ausdrücklich steht. Weil er bei jedem
    # Prompt läuft, wäre das Feld praktisch nie älter als eine Eingabe, und die Kollisionsregel
    # bliebe unentscheidbar wie zuvor (ADR-2026-09-01-204329). Vom Nachweis gefunden, nicht
    # gedacht: Kriterium 2a fiel mit „nachher None".
    # Auch die schwachen Ansprueche ueberleben den Herzschlag - derselbe Fallstrick wie oben,
    # er baut den Eintrag neu und uebernimmt nur, was hier ausdruecklich steht.
    # Beide schwachen Felder auf einmal, über SCHWACHE_FELDER: Ein neues Feld, das hier vergessen
    # wird, verschwindet bei jedem Prompt wieder - derselbe Fallstrick hat bei `anschreibname` und
    # bei `anspruch_seit` je einmal zugeschlagen und wurde beide Male erst vom Nachweis gefunden.
    for _feld in SCHWACHE_FELDER:
        if vorhanden.get(_feld):
            eintrag[_feld] = list(vorhanden[_feld])
    if isinstance(vorhanden.get('anspruch_seit'), dict):
        gehalten = set(eintrag.get('ansprueche') or [])
        behalten = {p: t for p, t in vorhanden['anspruch_seit'].items() if p in gehalten}
        if behalten:
            eintrag['anspruch_seit'] = behalten
    return schreibe(eintrag)


def anschreib_adresse(eintrag: dict) -> str | None:
    """Der String, den `SendMessage` im Feld `to` erwartet - mit Referenz, wo eine nötig ist.

    Der bloße Name genügt nur, solange ihn niemand sonst trägt; sonst verlangt `SendMessage` die
    Referenz in eckigen Klammern. Am 31.08.2026 kostete das acht Fehladressierungen an einem
    Nachmittag (ADR-2026-09-01-195703). Steht im Eintrag eine Referenz, hat die meldende Sitzung
    ihren Namen als mehrdeutig gemessen, und beides gehört zusammen ausgegeben.

    Liefert None, wenn kein Name gemeldet ist - dann behauptet keine Ausgabe Erreichbarkeit.
    """
    name = (eintrag.get('anschreibname') or '').strip()
    if not name:
        return None
    referenz = (eintrag.get('anschreibreferenz') or '').strip()
    # Trug der gemeldete Name die Klammer schon (Handeintrag der alten Art), nicht verdoppeln.
    if referenz and '[' not in name:
        return '%s [%s]' % (name, referenz)
    return name


def gleichnamige(eintrag: dict, alle: list[dict] | None = None) -> list[dict]:
    """Die übrigen lebenden Einträge, die denselben Anschreibnamen tragen.

    Das Register erkennt damit selbst, was `melde-namen.py` nur im Augenblick der Meldung sieht:
    Startet die gleichnamige Sitzung später, ist das Feld der ersten längst geschrieben. Beide
    Hälften zusammen decken beide Zeitpunkte ab (ADR-2026-09-01-195703).
    """
    name = (eintrag.get('anschreibname') or '').strip()
    if not name:
        return []
    if alle is None:
        alle = lies_register()
    return [e for e in alle
            if e.get('kennung') != eintrag.get('kennung')
            and (e.get('anschreibname') or '').strip() == name]


def unterscheidungs_hinweis(eintrag: dict, alle: list[dict] | None = None) -> str | None:
    """Sagt bei mehrdeutigem Namen OHNE Referenz, woran die Sitzung sonst zu erkennen ist.

    Den mehrdeutigen Namen bloß zu wiederholen hilft nicht weiter; was laut `claudecode-2c`
    zuverlässig funktioniert, ist der Weg über die Anspruchsliste. Liefert None, solange der Name
    eindeutig ist oder eine Referenz vorliegt - dann ist die Adresse für sich brauchbar.
    """
    if (eintrag.get('anschreibreferenz') or '').strip() or '[' in (eintrag.get('anschreibname') or ''):
        return None
    andere = gleichnamige(eintrag, alle)
    if not andere:
        return None
    ansprueche = [a for a in (eintrag.get('ansprueche') or []) if a]
    kopf = ('Der Name "%s" ist mehrdeutig: %d lebende Sitzungen tragen ihn, keine mit Referenz. '
            % ((eintrag.get('anschreibname') or '').strip(), len(andere) + 1))
    if ansprueche:
        zeige = ansprueche[-3:]
        return kopf + ('Unterscheidungsmerkmal ist die Anspruchsliste dieser Sitzung: %s'
                       % ', '.join(zeige))
    return kopf + ('Diese Sitzung hält noch keine Ansprüche; die Referenz steht in ListAgents '
                   'neben dem Namen.')


def melde_anschreibname(name: str, referenz: str | None = None) -> Path | None:
    """Trägt den Namen ein, unter dem `SendMessage` diese Sitzung erreicht.

    Titel und Registeradresse sind NICHT dieser Name: `ListAgents` führt dieselbe Sitzung unter
    einer eigenen Kennung (gemessen am 29.08.2026: Titel `claudecode/… · bau · b9e875`, Liste
    `claudecode-11`). Ableiten lässt er sich aus keiner der übrigen Kennungen, deshalb meldet ihn
    die Sitzung selbst (ADR-2026-08-29-211414).

    `referenz` ist die unterscheidende Kennung aus `ListAgents`, die nur dort gehört, wo der Name
    mehrdeutig ist (ADR-2026-09-01-195703). Sie wird bei jedem Aufruf neu gesetzt, auch auf leer:
    Eindeutigkeit kann zurückkehren, und ein stehengebliebenes Feld behauptete sonst dauerhaft eine
    Mehrdeutigkeit, die es nicht mehr gibt.

    Liefert den Pfad des Eintrags oder None, wenn es keinen gibt und keiner anzulegen ist.
    """
    name = (name or '').strip()
    if not name:
        return None
    session_id = eigene_session_id()
    if not session_id:
        return None
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id))
    eintrag = _lies_datei(datei)
    if eintrag is None:
        herzschlag()
        eintrag = _lies_datei(datei)
        if eintrag is None:
            return None
    eintrag['anschreibname'] = name
    referenz = (referenz or '').strip()
    if referenz:
        eintrag['anschreibreferenz'] = referenz
    else:
        eintrag.pop('anschreibreferenz', None)
    eintrag['lebenszeichen'] = time.time()
    return schreibe(eintrag)


def melde_rolle(rolle: str, strang: str | None = None) -> Path | None:
    """Setzt Rolle und Strang des eigenen Eintrags und bildet die Adresse neu.

    Damit weist sich eine Sitzung als Inspektor eines Strangs aus, und der Bauer findet sie über
    das Register statt über eine Suche in `ListAgents` (ADR-2026-08-29-221202). Rolle und Strang
    standen im Eintrag von Anfang an, es gab aber keinen Weg, sie zu setzen: `herzschlag()` nimmt
    beide aus dem Bestand und fällt sonst auf `bau` zurück.

    Angefasst werden ausschließlich `rolle`, `strang`, `adresse` und `lebenszeichen`. Ansprüche,
    Anschreibname, Beginn und Session-ID bleiben unberührt - ein Rollenwechsel ist kein Neustart.

    Liefert den Pfad des Eintrags oder None, wenn es keinen gibt und keiner anzulegen ist.
    """
    rolle = (rolle or '').strip().lower()
    if rolle not in ROLLEN:
        raise ValueError('Unbekannte Rolle %r, erlaubt sind: %s' % (rolle, ', '.join(ROLLEN)))
    session_id = eigene_session_id()
    if not session_id:
        return None
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id))
    eintrag = _lies_datei(datei)
    if eintrag is None:
        herzschlag()
        eintrag = _lies_datei(datei)
        if eintrag is None:
            return None
    eintrag['rolle'] = rolle
    if strang is not None and strang.strip():
        eintrag['strang'] = strang.strip()
    eintrag['adresse'] = _adresse(eintrag.get('repo_name') or '', eintrag.get('strang') or '',
                                 rolle, eintrag.get('kennung') or kennung_aus(session_id))
    eintrag['lebenszeichen'] = time.time()
    return schreibe(eintrag)


def _rechnername() -> str:
    name = os.environ.get('COMPUTERNAME')
    if name:
        return name
    try:
        return os.uname().nodename
    except AttributeError:
        return ''


def _eigene_pid():
    wert = os.environ.get('CLAUDE_PID')
    try:
        return int(wert) if wert else os.getpid()
    except ValueError:
        return os.getpid()


def _adresse(repo_name: str, strang: str, rolle: str, kennung: str) -> str:
    teil = '%s/%s' % (repo_name, strang) if strang else repo_name
    return '%s · %s · %s' % (teil, rolle, kennung)


def normpfad(pfad: str, repo: str | None = None) -> str:
    """Repo-relativ, Schrägstriche vorwärts, auf Windows kleingeschrieben."""
    p = str(pfad).replace('\\', '/')
    if repo:
        wurzel = str(Path(repo).resolve()).replace('\\', '/')
        vergleich = p.lower() if os.name == 'nt' else p
        w = wurzel.lower() if os.name == 'nt' else wurzel
        if vergleich.startswith(w + '/'):
            p = p[len(wurzel) + 1:]
    return p.lower() if os.name == 'nt' else p


def anspruch_trifft(anspruch: str, pfad: str) -> bool:
    """Vergleicht einen Anspruch mit einem Zielpfad. `ordner/**` deckt den ganzen Teilbaum."""
    a = str(anspruch).replace('\\', '/')
    if os.name == 'nt':
        a = a.lower()
    if a.endswith('/**'):
        praefix = a[:-3]
        return pfad == praefix or pfad.startswith(praefix + '/')
    if a.endswith('/'):
        return pfad.startswith(a)
    return fnmatch.fnmatch(pfad, a) or pfad == a


def stempel_pflegen(eintrag: dict, neue: list[str], jetzt: float | None = None) -> None:
    """Hält `anspruch_seit` mit der Anspruchsliste im Gleichstand.

    Der Zeitpunkt steht in einem EIGENEN Feld, nicht in der Liste: `ansprueche` wird von Melder,
    Riegel, Leseweg, Protokoll, Freigabe und mehreren Nachweisen gelesen, und ein Strukturwechsel
    bräche sie alle an einer Stelle, an der ein Fehler still zu einem falschen „frei" führt
    (ADR-2026-09-01-204329).

    Zwei Regeln, beide tragend:

    * **Ein bestehender Zeitpunkt wird nie überschrieben.** Ein Anspruch ist so alt wie seine
      Entstehung, nicht wie die letzte Berührung - sonst gewinnt in der Kollisionsregel, wer
      zuletzt geschrieben hat, also das Gegenteil des Gewollten.
    * **Was nicht mehr beansprucht ist, verliert seinen Zeitpunkt.** Sonst wächst das Feld über
      die Kappung hinaus und beschreibt Pfade, die niemand mehr hält.
    """
    jetzt = time.time() if jetzt is None else jetzt
    stempel = eintrag.get('anspruch_seit')
    if not isinstance(stempel, dict):
        stempel = {}
    for pfad in neue:
        stempel.setdefault(pfad, jetzt)
    bestand = set(eintrag.get('ansprueche') or [])
    stempel = {p: t for p, t in stempel.items() if p in bestand}
    if stempel:
        eintrag['anspruch_seit'] = stempel
    else:
        eintrag.pop('anspruch_seit', None)


def trage_schwache_ansprueche(pfade, grenze: int = 40) -> list[str]:
    """Vermerkt Pfade als SCHWACHEN Anspruch, gelesen aus einem Bash-Befehlstext.

    Getrenntes Feld `schwache_ansprueche`, nicht die reguläre Liste: Der Melder und der Leseweg
    sehen sie, der blockende Commit-Riegel nicht (ADR-2026-09-01-204433). Eine neue
    Anspruchsquelle läuft erst warnend; ein falscher Anspruch am Riegel ist nur mit fremder Hilfe
    aufzulösen, und genau daran ist der Versuch vom 31.08.2026 gescheitert.

    Ein Pfad, der bereits regulär beansprucht ist, wird nicht zusätzlich schwach geführt - der
    stärkere Anspruch deckt ihn ab. Liefert die neu hinzugekommenen Pfade.
    """
    session_id = eigene_session_id()
    if not session_id:
        return []
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id))
    eintrag = _lies_datei(datei)
    if eintrag is None:
        herzschlag()
        eintrag = _lies_datei(datei)
        if eintrag is None:
            return []
    stark = set(eintrag.get('ansprueche') or [])
    schwach = [a for a in eintrag.get('schwache_ansprueche') or [] if isinstance(a, str)]
    neu = []
    for pfad in pfade:
        rel = normpfad(pfad, eintrag.get('repo'))
        if rel in stark or rel in schwach:
            continue
        schwach.append(rel)
        neu.append(rel)
    if not neu:
        return []
    eintrag['schwache_ansprueche'] = schwach[-grenze:]
    eintrag['lebenszeichen'] = time.time()
    try:
        schreibe(eintrag)
    except Exception:
        return []
    return neu


def melde_schreibziele(pfade, grenze: int = 40) -> list[str]:
    """Ein Werkzeug meldet die Dateien, die es geschrieben HAT (ADR-2026-09-02-234714).

    Das Gegenstück zu `trage_schwache_ansprueche`: Dort liest ein Hook das Ziel aus dem
    Befehlstext, hier meldet das schreibende Skript es selbst. Was ein aufgerufenes Skript intern
    schreibt, steht in keinem Befehlstext - `Sync-UmlautTriggers.ps1 -Apply` fasst 17 Repos an und
    gibt davon nichts preis. Geraten wird trotzdem nichts: Das Werkzeug weiß seine Ziele, und die
    Sitzung, der sie gutgeschrieben werden, kommt aus der vererbten `CLAUDE_CODE_SESSION_ID` - kein
    Zeitfenster, keine Zuordnung. Genau daran ist der Versuch vom 31.08.2026 gescheitert.

    **Gemeldet wird nach dem Schreiben, nicht vorher.** Eine Absichtserklärung wäre wieder eine
    Behauptung: Ein Trockenlauf schreibt nichts und dürfte nichts beanspruchen.

    **Ohne Sitzungskennung entsteht kein Anspruch** und es wird kein Eintrag angelegt. Ein
    Scheduled Task oder ein Lauf von einem anderen Rechner hat keinen Absender, und ein Anspruch
    ohne Absender wäre schlimmer als keiner.

    Eigenes Feld `gemeldete_ansprueche`, weil die Herkunft unterscheidbar bleiben muss: Der Kanon
    verlangt für jede neue Anspruchsquelle eine warnende Stufe, und in einem gemeinsamen Topf mit
    dem Bash-Weg ließe sich später nicht sagen, welcher der beiden seine Messphase bestanden hat.

    Liefert die Pfade, die neu hinzukamen. Wer die fremden Ansprüche darauf wissen will, fragt
    `fremde_ansprueche(pfad, schwach=True)` - diese Funktion meldet nur an.
    """
    session_id = eigene_session_id()
    if not session_id:
        return []
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id))
    eintrag = _lies_datei(datei)
    if eintrag is None:
        herzschlag()
        eintrag = _lies_datei(datei)
        if eintrag is None:
            return []
    stark = set(eintrag.get('ansprueche') or [])
    gemeldet = [a for a in eintrag.get('gemeldete_ansprueche') or [] if isinstance(a, str)]
    neu = []
    for pfad in pfade:
        if not pfad:
            continue
        rel = normpfad(str(pfad), eintrag.get('repo'))
        if rel in stark or rel in gemeldet:
            continue
        gemeldet.append(rel)
        neu.append(rel)
    if not neu:
        return []
    eintrag['gemeldete_ansprueche'] = gemeldet[-grenze:]
    eintrag['lebenszeichen'] = time.time()
    try:
        schreibe(eintrag)
    except Exception:
        return []
    return neu


# Die Felder, deren Ansprüche NUR warnen. Sie stehen als Liste, damit Melder, Leseweg und
# `fremde_ansprueche` nicht je eine eigene Aufzählung führen: Ein drittes Feld, das an einer der
# Stellen fehlt, führte dort still zu einem falschen „frei".
SCHWACHE_FELDER = ('schwache_ansprueche', 'gemeldete_ansprueche')


def schwache_liste(eintrag: dict) -> list[str]:
    """Alle nur warnenden Ansprüche eines Eintrags, gleich welcher Herkunft."""
    raus: list[str] = []
    for feld in SCHWACHE_FELDER:
        raus += [a for a in (eintrag.get(feld) or []) if isinstance(a, str)]
    return raus


def anspruch_herkunft(eintrag: dict, anspruch: str) -> str:
    """Woher der Anspruch stammt: `stark`, `werkzeug`, `bash` oder `unbekannt`.

    Die Reihenfolge ist die Rangfolge der Belastbarkeit. `stark` zuerst, weil ein Pfad in beiden
    Sorten stehen kann (erst Bash, später `Write`) und der stärkere Anspruch ihn dann abdeckt.
    `werkzeug` vor `bash`, weil eine Werkzeugmeldung sagt, was tatsächlich geschrieben wurde,
    während der Befehlstext sagt, was der Aufruf nennt.

    `unbekannt` heißt: dieser Anspruch steht in keiner der Listen - der Aufrufer hat ihn also
    nicht aus diesem Eintrag. Das ist ein Fehler beim Aufrufer, kein Zustand des Registers.
    """
    if anspruch in (eintrag.get('ansprueche') or []):
        return 'stark'
    if anspruch in (eintrag.get('gemeldete_ansprueche') or []):
        return 'werkzeug'
    if anspruch in (eintrag.get('schwache_ansprueche') or []):
        return 'bash'
    return 'unbekannt'


def herkunft_text(herkunft: str) -> str:
    """Ein Satzteil, der die Herkunft benennt - für jede Ausgabe, die einen Treffer beschriftet.

    Wer eine Warnung liest und danach erlebt, dass der Commit-Riegel schweigt, braucht den
    Hinweis, dass das so gemeint ist; sonst liest er das Schweigen als „kein Anspruch". Und er
    braucht die richtige Herkunft: Eine Werkzeugmeldung unter der Beschriftung „aus
    Bash-Befehlstext" wäre schlicht falsch (ADR-2026-09-02-234714).

    Der Halbsatz „der Commit-Riegel blockt auf ihm nicht" steht hier wörtlich, weil
    `pruefe_bash_anspruch.py` genau ihn in derselben Zeile wie „SCHWACH" verlangt. Beim Bau
    dieser Funktion stand dort zunächst „blockt darauf nicht", und der bestehende Nachweis fiel -
    von dessen Gegenprobe gefunden, nicht beim Schreiben bemerkt.
    """
    if herkunft == 'werkzeug':
        return 'vom schreibenden Werkzeug selbst gemeldet, der Commit-Riegel blockt auf ihm nicht'
    if herkunft == 'bash':
        return 'aus einem Bash-Befehlstext gelesen, der Commit-Riegel blockt auf ihm nicht'
    return ''


def ist_schwacher_anspruch(eintrag: dict, anspruch: str) -> bool:
    """Ob dieser Anspruch aus einem Bash-Befehlstext stammt und der Riegel deshalb schweigt.

    Gebraucht von jedem Ausgabeweg, der einen Treffer aus `fremde_ansprueche(..., schwach=True)`
    beschriftet: Wer die Warnung liest und danach erlebt, dass der Commit-Riegel schweigt, braucht
    den Hinweis, dass das so gemeint ist - sonst liest er das Schweigen als „kein Anspruch"
    (ADR-2026-09-01-204433, Abnahmebefund B4 vom 02.09.2026).

    Steht derselbe Pfad in beiden Listen, gilt er als STARK: `trage_schwache_ansprueche` überspringt
    zwar, was schon regulär beansprucht ist, aber die umgekehrte Reihenfolge (erst Bash, später
    `Write`) trägt ihn in beide ein, und dort deckt der stärkere Anspruch ab.

    Seit ADR-2026-09-02-234714 gilt dasselbe für die vom Werkzeug gemeldeten Ansprüche. Wer die
    Herkunft braucht und nicht nur das Ja/Nein, ruft `anspruch_herkunft`.
    """
    return anspruch_herkunft(eintrag, anspruch) in ('werkzeug', 'bash')


def anspruch_seit(eintrag: dict, anspruch: str) -> float | None:
    """Wann dieser Anspruch entstanden ist, oder None für „unbekannt".

    None heißt ausdrücklich weder alt noch neu: Bestandseinträge und Sitzungen mit älterer Lib
    führen keinen Zeitpunkt, und wer daraus eine Reihenfolge ableitet, erfindet sie.
    """
    stempel = eintrag.get('anspruch_seit')
    if not isinstance(stempel, dict):
        return None
    wert = stempel.get(anspruch)
    return float(wert) if isinstance(wert, (int, float)) else None


def trage_anspruch_nach(pfad: str, grenze: int = 40) -> None:
    """Vermerkt den berührten Pfad im eigenen Eintrag. Ansprüche entstehen so aus dem Tun,
    statt getippt zu werden (ADR-2026-08-21-2035 sinngemäß)."""
    session_id = eigene_session_id()
    if not session_id:
        return
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id))
    eintrag = _lies_datei(datei)
    if eintrag is None:
        herzschlag()
        eintrag = _lies_datei(datei)
        if eintrag is None:
            return
    rel = normpfad(pfad, eintrag.get('repo'))
    ansprueche = [a for a in eintrag.get('ansprueche') or [] if isinstance(a, str)]
    if rel not in ansprueche:
        ansprueche.append(rel)
    eintrag['ansprueche'] = ansprueche[-grenze:]
    stempel_pflegen(eintrag, [rel])
    eintrag['lebenszeichen'] = time.time()
    try:
        schreibe(eintrag)
    except Exception:
        pass


def trage_ansprueche_nach(pfade, grenze: int = 40) -> list[str]:
    """Sammelvariante von `trage_anspruch_nach`: ein Schreibvorgang für viele Pfade.

    Ein Shell-Aufruf ändert regelmäßig mehrere Dateien auf einmal (ein Generator-Lauf, eine
    Mutationsprobe samt Rückbau). Pfadweise zu schreiben hieße, den Eintrag mehrfach zu
    serialisieren. Liefert die Pfade, die neu hinzukamen.
    """
    session_id = eigene_session_id()
    if not session_id:
        return []
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id))
    eintrag = _lies_datei(datei)
    if eintrag is None:
        herzschlag()
        eintrag = _lies_datei(datei)
        if eintrag is None:
            return []
    ansprueche = [a for a in eintrag.get('ansprueche') or [] if isinstance(a, str)]
    neu = []
    for pfad in pfade:
        rel = normpfad(pfad, eintrag.get('repo'))
        if rel not in ansprueche:
            ansprueche.append(rel)
            neu.append(rel)
    if not neu:
        return []
    eintrag['ansprueche'] = ansprueche[-grenze:]
    stempel_pflegen(eintrag, neu)
    eintrag['lebenszeichen'] = time.time()
    try:
        schreibe(eintrag)
    except Exception:
        return []
    return neu


# --- Wirkung eines Shell-Aufrufs (ADR-2026-08-31-141421) ----------------------------------
#
# Ansprüche entstehen aus dem Tun, aber `Write` und `Edit` sind nicht die einzigen Wege zu
# schreiben. Wer aus einem Skript, einem Generator oder einem Bash-Aufruf heraus ändert, löst
# den PreToolUse-Hook nicht aus; die Datei bleibt unbeansprucht, und der Commit-Riegel schützt
# sie nicht. Bei einem Shell-Aufruf ist vorher nicht feststellbar, welche Datei er anfassen
# wird - gemessen wird deshalb die WIRKUNG: was hat sich zwischen Messpunkt und jetzt geändert?

# Zeitstempel einer Datei und die Uhr des Prozesses stammen aus verschiedenen Quellen (auf NTFS
# zudem gröber aufgelöst). Die Toleranz fängt das ab. Sie wirkt in die konservative Richtung:
# im Zweifel wird ein Pfad beansprucht statt übersehen, denn ein überflüssiger Anspruch kostet
# eine Freigabe, ein fehlender kostet fremde Arbeit.
MESSPUNKT_TOLERANZ = 1.0

# Höchstalter einer Klammer, aus der noch Ansprüche entstehen. Feuert das schließende Ereignis,
# ist die Klammer die Laufzeit des Aufrufs (Median 0,42 Sekunden). Bleibt es aus, schließt erst
# der nächste Lauf nach - und dazwischen liegt die Denkzeit des Modells. In einem Arbeitsbaum
# mit zwanzig gleichzeitigen Sitzungen schreibt in einer Minute fast immer jemand anders, die
# Zuordnung "das war mein Aufruf" trägt dann nicht mehr. Nach dieser Frist wird der Messpunkt
# abgeräumt, ohne Ansprüche daraus abzuleiten (Nachtrag zu ADR-2026-08-31-141421, aus dem
# Feldbefund von `claudecode-a2` am 31.08.2026).
KLAMMER_HOECHSTALTER = 20.0


def setze_messpunkt(jetzt: float | None = None) -> float | None:
    """Öffnet die Klammer um einen Shell-Aufruf. Liefert den gesetzten Messpunkt."""
    jetzt = time.time() if jetzt is None else jetzt
    session_id = eigene_session_id()
    if not session_id:
        return None
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id))
    eintrag = _lies_datei(datei)
    if eintrag is None:
        herzschlag()
        eintrag = _lies_datei(datei)
        if eintrag is None:
            return None
    eintrag['messpunkt'] = jetzt
    eintrag['lebenszeichen'] = jetzt
    try:
        schreibe(eintrag)
    except Exception:
        return None
    return jetzt


def lies_messpunkt() -> float | None:
    """Der offene Messpunkt der eigenen Sitzung, oder None."""
    session_id = eigene_session_id()
    if not session_id:
        return None
    eintrag = _lies_datei(register_verzeichnis() / ('%s.json' % kennung_aus(session_id)))
    if not eintrag:
        return None
    try:
        return float(eintrag.get('messpunkt'))
    except (TypeError, ValueError):
        return None


def _status_pfade(repo: str) -> list[str]:
    """Repo-relative Pfade aus `git status --porcelain`, inklusive unverfolgter Dateien.

    `-z` statt Zeilen, weil git sonst Pfade mit Sonderzeichen in Anführungszeichen setzt und
    maskiert. Bei einer Umbenennung nennt der Eintrag Ziel und Quelle; beide zählen als berührt.
    """
    import subprocess
    lauf = subprocess.run(['git', '-C', str(repo), 'status', '--porcelain', '-z',
                           '--untracked-files=all'],
                          capture_output=True)
    if lauf.returncode != 0:
        return []
    roh = (lauf.stdout or b'').decode('utf-8', errors='replace')
    felder = [f for f in roh.split('\0') if f]
    pfade = []
    i = 0
    while i < len(felder):
        eintrag = felder[i]
        # Feste Spalten, kein Trennen am Leerzeichen: die ersten beiden Zeichen sind der
        # Status (das erste ist bei ' M' selbst ein Leerzeichen), das dritte trennt, ab dem
        # vierten steht der Pfad. Ein `partition(' ')` liefert hier `m a.txt` statt `a.txt`.
        status = eintrag[:2]
        pfad = eintrag[3:]
        fehlt_erlaubt = 'D' in status
        if pfad:
            pfade.append((pfad, fehlt_erlaubt))
        # Umbenennung und Kopie führen die Quelle als eigenes Feld direkt dahinter. Sie
        # existiert unter dem alten Namen nicht mehr, zählt also wie eine Löschung.
        if status.strip()[:1] in ('R', 'C'):
            i += 1
            if i < len(felder) and felder[i]:
                pfade.append((felder[i], True))
        i += 1
    return pfade


def _geaendert_im_fenster(voller_pfad: str, messpunkt: float, fehlt_ok: bool = False,
                          toleranz: float = MESSPUNKT_TOLERANZ) -> bool:
    """Liegt die Änderungszeit der Datei im Fenster seit dem Messpunkt?

    DIE Kernbedingung dieser Messung, und deshalb bewusst eine eigene Funktion: Der Nachweis
    lädt sie hier, statt sie nachzubauen (ADR-2026-08-29-1206). Ohne sie beanspruchte ein Lauf
    jede offene Änderung des Arbeitsbaums, also auch die fremde Arbeit einer parallelen Sitzung.

    Eine gelöschte Datei hat keine Änderungszeit mehr. Sie gilt als berührt, denn löschen ist
    ein Schreibzugriff - aber nur, wenn git sie ausdrücklich als gelöscht führt (`fehlt_ok`).
    Sonst deckte dieser Zweig jeden Pfadfehler zu: ein falsch gelesener Pfad existiert ebenfalls
    nicht und würde als Änderung durchgehen. Genau daran ist der erste Anlauf gescheitert.
    """
    try:
        return os.stat(voller_pfad).st_mtime >= (messpunkt - toleranz)
    except FileNotFoundError:
        return bool(fehlt_ok)
    except OSError:
        return False


def geaenderte_seit(messpunkt: float, repo: str) -> list[str]:
    """Repo-relative Pfade, die seit dem Messpunkt geändert wurden.

    Zwei Bedingungen, und beide sind nötig: Der Status allein sieht eine Datei nicht, die schon
    vor dem Messpunkt geändert war und nun erneut geschrieben wurde - sie steht davor wie danach
    als `M` da. Die Änderungszeit allein zöge Dateien herein, die nur berührt und inhaltlich
    nicht verändert wurden.
    """
    if messpunkt is None:
        return []
    wurzel = Path(repo)
    treffer = []
    for rel, fehlt_ok in _status_pfade(str(wurzel)):
        if _geaendert_im_fenster(str(wurzel / rel), messpunkt, fehlt_ok):
            if rel not in treffer:
                treffer.append(rel)
    return treffer


def werte_messpunkt_aus(repo: str | None = None) -> list[str]:
    """Schließt eine offene Klammer: misst, trägt die Ansprüche nach, räumt den Messpunkt ab.

    Liefert die repo-relativen Pfade, die dabei als berührt erkannt wurden - auch die, die
    bereits beansprucht waren, denn der Melder soll auch dann über einen fremden Anspruch
    reden. Ohne offenen Messpunkt eine leere Liste.
    """
    messpunkt = lies_messpunkt()
    if messpunkt is None:
        return []
    ziel_repo = repo_des_ziels(repo)
    zu_alt = (time.time() - messpunkt) > KLAMMER_HOECHSTALTER
    betroffene = [] if (zu_alt or not ziel_repo) else geaenderte_seit(messpunkt, ziel_repo)
    session_id = eigene_session_id()
    datei = register_verzeichnis() / ('%s.json' % kennung_aus(session_id or ''))
    eintrag = _lies_datei(datei)
    if eintrag is not None and 'messpunkt' in eintrag:
        eintrag.pop('messpunkt', None)
        eintrag['lebenszeichen'] = time.time()
        try:
            schreibe(eintrag)
        except Exception:
            pass
    if betroffene:
        # Was eine andere lebende Sitzung bereits beansprucht, wird GEMELDET, aber nicht
        # übernommen. Sonst stiehlt eine Wirkungsmessung den Anspruch dessen, der die Datei
        # wirklich bearbeitet: Am 31.08.2026 hat genau das den Commit einer dritten Sitzung am
        # Riegel scheitern lassen, weil eine vierte während der Klammer eine Datei anlegte. Die
        # Regel deckt sich mit der Konfliktregel aus AGENTS.md - der ältere Anspruch behält das
        # Feld -, und die Fehlerrichtung ist die harmlose: ein fehlender eigener Anspruch kostet
        # nichts, solange der fremde die Datei ohnehin schützt.
        eigene = [p for p in betroffene if not fremde_ansprueche(p, repo=ziel_repo)]
        if eigene:
            trage_ansprueche_nach(eigene)
    return betroffene


def gib_anspruch_frei(pfad: str, kennung: str | None = None) -> list[str] | None:
    """Nimmt den Anspruch auf einen Pfad im EIGENEN Eintrag zurück.

    Das Gegenstück zu `trage_anspruch_nach`. Bis zum 30.08.2026 gab es keines: Ein Anspruch war
    nur durch das Ende des Prozesses loszuwerden oder durch die Kappung auf die letzten
    `grenze` Einträge, und die greift praktisch nie (gemessen über 19 lebende Einträge: Median 0
    Ansprüche je Sitzung, Maximum 5). Wer eine geteilte Datei kurz berührte, sperrte sie damit
    faktisch bis zum Sitzungsende, und der Commit-Riegel trieb die nächste Sitzung in
    `--no-verify` (ADR-2026-08-30-222543).

    Entfernt wird jeder Anspruch, den `anspruch_trifft` auf diesen Pfad anwenden würde, also auch
    ein deckender Glob wie `ordner/**`. Andernfalls bliebe die Datei nach einer scheinbar
    erfolgreichen Freigabe weiter gesperrt, denn der Riegel fragt mit derselben Funktion.

    `kennung` dient nur der ausdrücklichen Ablehnung: Ein fremder Eintrag wird nie angefasst,
    sonst wäre der Riegel mit einem Befehl aushebelbar. Ein abweichender Wert löst `ValueError`
    aus, statt still nichts zu tun.

    Liefert die Liste der entfernten Ansprüche (leer, wenn keiner passte) oder None, wenn es
    keinen eigenen Eintrag gibt.
    """
    session_id = eigene_session_id()
    if not session_id:
        return None
    eigene = kennung_aus(session_id)
    if kennung is not None and str(kennung).strip() and str(kennung).strip() != eigene:
        raise ValueError(
            'Freigeben geht nur im eigenen Eintrag. Angefragt: %s, eigener: %s. Ein fremder '
            'Anspruch wird nie angefasst; sprich die haltende Sitzung an (SendMessage).'
            % (str(kennung).strip(), eigene))
    datei = register_verzeichnis() / ('%s.json' % eigene)
    eintrag = _lies_datei(datei)
    if eintrag is None:
        return None
    rel = normpfad(pfad, eintrag.get('repo'))
    ansprueche = [a for a in eintrag.get('ansprueche') or [] if isinstance(a, str)]
    entfernt = [a for a in ansprueche if anspruch_trifft(a, rel)]
    # Die schwachen Felder gehen mit frei (ADR-2026-09-02-234714). Sie blocken keinen Commit,
    # aber der Melder warnt auf ihnen, und ohne Freigabe stünde diese Warnung bis zum
    # Sitzungsende - dieselbe Alarm-Müdigkeit, gegen die ADR-2026-08-30-222543 die Freigabe
    # überhaupt eingeführt hat. Bis hierher fasste sie nur `ansprueche` an, ein schwacher
    # Anspruch war also gar nicht loszuwerden.
    schwach_entfernt = []
    for feld in SCHWACHE_FELDER:
        vorhanden = [a for a in eintrag.get(feld) or [] if isinstance(a, str)]
        raus = [a for a in vorhanden if anspruch_trifft(a, rel)]
        if not raus:
            continue
        schwach_entfernt += raus
        rest = [a for a in vorhanden if a not in raus]
        if rest:
            eintrag[feld] = rest
        else:
            eintrag.pop(feld, None)
    if not entfernt and not schwach_entfernt:
        return []
    entfernt = entfernt + schwach_entfernt
    eintrag['ansprueche'] = [a for a in ansprueche if a not in entfernt]
    # Der Zeitpunkt geht mit dem Anspruch: sonst beschriebe das Feld einen Pfad, den niemand
    # mehr hält, und ein spaeter neu entstehender Anspruch erbte das alte Alter.
    stempel_pflegen(eintrag, [])
    eintrag['lebenszeichen'] = time.time()
    schreibe(eintrag)
    return entfernt


def _aufgeloest(pfad) -> str | None:
    """Verzeichnispfad in Vergleichsform (vorwärts, auf Windows klein) oder None."""
    if not pfad:
        return None
    try:
        voll = str(Path(pfad).resolve()).replace('\\', '/')
    except Exception:
        return None
    return voll.lower() if os.name == 'nt' else voll


def repo_des_ziels(repo: str | None = None) -> str | None:
    """Repo, in dem gerade geschrieben oder committet wird.

    Dieselbe Kette wie in `herzschlag()`, damit beide Seiten des Repo-Vergleichs auf demselben
    Weg entstehen: übergebenes Repo, sonst CLAUDE_PROJECT_DIR, sonst Arbeitsverzeichnis.
    """
    return _aufgeloest(repo or os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd())


def eintrag_gilt_hier(eintrag: dict, pfad: str, ziel_repo: str | None) -> bool:
    """Gehört der Eintrag zu dem Repo, in dem der Zielpfad liegt? (ADR-2026-08-29-202848)

    Ansprüche sind repo-relativ notiert, und `AGENTS.md`, `cockpit.md` oder `.claude/hooks/**`
    gibt es in jedem Repo der Familie. Ohne diesen Vergleich träfe der Anspruch einer fremden
    Sitzung aus einem anderen Repo hier zu.

    IM ZWEIFEL WIRD GEMELDET: Trägt der Eintrag kein `repo` oder lässt es sich nicht auflösen,
    liefert die Funktion True. Ein Fehlalarm kostet einen Blick, eine verschwiegene Kollision
    kostet fremde Arbeit. Dasselbe gilt, wenn das Repo des Ziels unbestimmbar ist.
    """
    eintrag_repo = _aufgeloest(eintrag.get('repo'))
    if eintrag_repo is None or ziel_repo is None:
        return True
    if eintrag_repo == ziel_repo:
        return True
    # Absoluter Zielpfad, der im fremden Repo liegt: genau die Kollision, um die es geht. Sie
    # darf nicht daran scheitern, dass die schreibende Sitzung anderswo sitzt.
    # NUR für absolut übergebene Pfade: ein relativer Pfad gehört per Definition zum Repo des
    # Ziels, und ihn gegen das Arbeitsverzeichnis des laufenden Prozesses aufzulösen ergäbe je
    # nach Aufrufer ein anderes Ergebnis.
    try:
        if not Path(pfad).is_absolute():
            return False
    except Exception:
        return False
    ziel = _aufgeloest(pfad)
    return bool(ziel and (ziel == eintrag_repo or ziel.startswith(eintrag_repo + '/')))


def fremde_ansprueche(pfad: str, repo: str | None = None,
                      schwach: bool = False) -> list[tuple[dict, str]]:
    """Alle lebenden Fremdeinträge, deren Anspruch den Pfad trifft, mit dem treffenden Anspruch.

    Geprüft werden nur Einträge, die zum Repo des Zielpfads gehören (`eintrag_gilt_hier`).

    `schwach=True` bezieht zusätzlich die Ansprüche aus `schwache_ansprueche` ein, also die aus
    einem Bash-Befehlstext gelesenen (ADR-2026-09-01-204433). **Der Default ist bewusst False**,
    damit der blockende Riegel sie nicht sieht: Eine neue Anspruchsquelle läuft erst warnend,
    bevor sie an den Riegel kommt, und ein falscher Anspruch ist dort nur mit fremder Hilfe
    aufzulösen. Wer wissen will, ob ein Treffer schwach war, ruft `ist_schwacher_anspruch(eintrag,
    anspruch)`. Der frühere Rat, dafür `eintrag['schwache_ansprueche']` selbst abzufragen, liefert
    für einen Pfad, der in **beiden** Listen steht, die falsche Antwort (Abnahmehinweis 02.09.2026).
    """
    eigene = kennung_aus(eigene_session_id() or '')
    ziel_repo = repo_des_ziels(repo)
    treffer = []
    for eintrag in lies_register():
        if eintrag.get('kennung') == eigene:
            continue
        if not eintrag_gilt_hier(eintrag, pfad, ziel_repo):
            continue
        # Fällt das Repo des Eintrags aus, wird gegen das Repo des Ziels normalisiert, damit ein
        # relativer Anspruch überhaupt eine Chance auf einen Treffer hat.
        ziel = normpfad(pfad, eintrag.get('repo') or repo or ziel_repo)
        kandidaten = list(eintrag.get('ansprueche') or [])
        if schwach:
            kandidaten += schwache_liste(eintrag)
        for anspruch in kandidaten:
            if isinstance(anspruch, str) and anspruch_trifft(anspruch, ziel):
                treffer.append((eintrag, anspruch))
                break
    return treffer


# --- Auswertung einer ListAgents-Ausgabe (ADR-2026-09-03-103343) ---------------------------
#
# Das Register sagt, unter welchem Namen eine Sitzung anschreibbar IST. Ob `SendMessage` diesen
# Namen findet, entscheidet das Session-Management über seine eigene, seitenweise abgerufene
# Sitzungsliste; ist die gekappt, bleibt eine lebende, ordentlich gemeldete Sitzung unerreichbar.
# Diese Auswertung liegt genau einmal hier, weil `melde-namen.py` (Mehrdeutigkeit) und `zeige.py`
# (Erreichbarkeit) dieselbe Frage an denselben Text stellen.

# Der Name gefolgt von seiner Referenz, so wie ListAgents beide druckt - in der Selbstauskunft
# („This session is claudecode-5c [51e322] — …") wie in jeder Peer-Zeile.
_REF_MUSTER = r'\[([0-9A-Za-z_-]{4,})\]'

# Beide bekannten Formulierungen der Kappung, klein geschrieben verglichen:
#   ListAgents:  „(session list too long to fetch completely — sessions beyond the first pages …"
#   SendMessage: „Your session list was too long to check completely, so a session by that name …"
_KAPPUNG_MARKEN = ('session list too long', 'session list was too long')

# Woran eine ListAgents-Ausgabe zu erkennen ist. Ohne eines dieser Merkmale wird nicht geurteilt,
# sondern Werkzeugversagen gemeldet: eine beliebige Textdatei ergäbe sonst „niemand erreichbar",
# und das sähe wie ein Befund aus.
_LISTING_MARKEN = ('this session is', 'peer sessions', 'no agents')


class Peerliste:
    """Eine gelesene ListAgents-Ausgabe, ausgewertet.

    `gekappt` sagt, ob die Ausgabe selbst einräumt, unvollständig zu sein. Das ist der
    Unterschied zwischen „diese Sitzung ist nicht mehr da" und „ich konnte nicht alle sehen",
    und nur die Ausgabe selbst weiß das.
    """

    def __init__(self, text: str):
        self.text = text
        self.zeilen = text.splitlines()
        klein = text.lower()
        self.gekappt = any(marke in klein for marke in _KAPPUNG_MARKEN)
        self.ist_listing = any(marke in klein for marke in _LISTING_MARKEN)

    def traeger(self, name: str) -> tuple[int, str | None]:
        """(Zahl der Zeilen mit diesem Namen, eigene Referenz aus der Selbstauskunft).

        Gezählt werden Zeilen, nicht Vorkommen: eine Zeile ist eine Sitzung. Die Referenz stammt
        ausschließlich aus der Selbstauskunft-Zeile - eine fremde einzutragen wäre schlimmer als
        gar keine, weil sie eine falsche Adresse als geprüft ausgäbe.
        """
        mit_ref = re.compile(r'(?:^|\s)%s\s*%s' % (re.escape(name), _REF_MUSTER))
        # Auch ein Träger ohne Klammer zählt mit, sonst bliebe eine Mehrdeutigkeit unbemerkt,
        # nur weil die andere Zeile keine Referenz druckt.
        nackt = re.compile(r'(?:^|\s)%s(?:\s|$|,)' % re.escape(name))
        anzahl = 0
        eigene = None
        for zeile in self.zeilen:
            treffer = mit_ref.search(zeile)
            if not treffer and not nackt.search(zeile):
                continue
            anzahl += 1
            if treffer and zeile.strip().lower().startswith('this session is'):
                eigene = treffer.group(1)
        return anzahl, eigene

    def kennt(self, name: str) -> bool:
        return self.traeger(name)[0] > 0


def werte_peerliste(text: str) -> Peerliste:
    return Peerliste(text)


ERREICHBAR_MARKE = 'Erreichbarkeit:'


def erreichbarkeits_text(name: str, liste: Peerliste) -> str:
    """Ein Satz zur Frage „findet mein SendMessage diesen Namen?" - drei mögliche Auskünfte.

    Die dritte ist der Grund für die Dreiteilung: Erkennt eine spätere Fassung der Oberfläche die
    Kappungsmarke nicht mehr, darf daraus kein „die Sitzung ist beendet" werden. Gemessen ist
    dann nur die Abwesenheit in dieser einen Ausgabe, und genau das sagt der Text.
    """
    if liste.kennt(name):
        return ('in deiner ListAgents-Ausgabe vorhanden, also von hier aus erreichbar '
                '(Stand des Abrufs, nicht des Sendens).')
    if liste.gekappt:
        # Der Nachsatz gehört dazu, seit gemessen ist, dass die Sitzungsverwaltung der Oberfläche
        # nicht kappt: ohne ihn riete die Auskunft zum Aufgeben, wo ein gangbarer Weg bekannt ist,
        # und sagte damit weniger, als die Messung deckt (Abnahme Runde 2 zu ADR-2026-09-03-103343).
        return ('steht NICHT in deiner ListAgents-Ausgabe, und die meldet selbst, gekappt zu '
                'sein. Über SendMessage von hier aus nicht anschreibbar - leg die Sache als Datei '
                'ab, oder geh über die Sitzungsverwaltung (list_sessions, dort die Sitzung am '
                'Titel finden, dann send_message mit ihrer local_-Kennung), die diese Kappung '
                'nicht hat.')
    return ('steht nicht in deiner ListAgents-Ausgabe, die aber keine Kappung meldet. Gemessen '
            'ist allein die Abwesenheit in dieser Ausgabe: die Sitzung kann dort unsichtbar '
            'sein, oder die Ausgabe war unvollständig, ohne es zu sagen. Ein Sendeversuch kann '
            'gelingen oder scheitern.')


# Die Werkzeuge des Registers liegen genau einmal, in `claudecode` unter
# `werkzeuge/sitzungsregister/` (ADR-2026-10-28-202822, Entscheidung 5). In jedem anderen Repo der
# Familie gibt es diesen Ordner nicht; ein Hinweis, der dort den Repo-Pfad nennt, ist ein Befehl,
# der mit „Datei nicht gefunden" endet. Erreichbar sind sie dort über je einen Starter unter
# `~/.claude/scripts/`, der nur den Klon sucht.
STARTER_PRAEFIX = 'sitzungsregister-'


def werkzeug_aufruf(werkzeug: str, repo: str | None = None) -> str:
    """Befehl, mit dem ein Registerwerkzeug im Repo des Aufrufs tatsächlich startet.

    `werkzeug` ist der Dateiname ohne Ordner, etwa `melde-namen.py`. Liegt das Werkzeug im Repo
    selbst (in `claudecode`), lautet der Aufruf wie bisher repo-relativ; sonst nennt er den Starter.
    """
    wurzel = repo or os.environ.get('CLAUDE_PROJECT_DIR') or os.getcwd()
    try:
        if os.path.isfile(os.path.join(wurzel, 'werkzeuge', 'sitzungsregister', werkzeug)):
            return 'python werkzeuge/sitzungsregister/%s' % werkzeug
    except Exception:
        pass
    return 'python ~/.claude/scripts/%s%s' % (STARTER_PRAEFIX, werkzeug)
