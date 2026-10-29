#!/usr/bin/env python3
"""Stop-Hook: gibt die eigenen Ansprüche auf saubere Dateien am Turn-Ende zurück.

Warum es das gibt
-----------------
Ein Anspruch im Sitzungsregister schützt davor, dass ein fremder Commit die eigene
uncommittete Arbeit mitnimmt (ADR-2026-08-29-192830). Sobald die Datei committet ist,
schützt er nichts mehr, blockiert aber weiter jeden fremden Commit, bis die Sitzung ihn
freigibt oder ihr Prozess endet. Die Freigabe aus ADR-2026-08-30-222543 hatte bis hierhin
keinen Auslöser im Ablauf, und gemessen am Riegel-Protokoll gingen 30 von 69 Blockaden auf
Halter zurück, die länger als eine Stunde still waren, 27 davon über vier Stunden
(ADR-2026-09-12-110133).

Was er tut
----------
Für jeden eigenen Anspruch prüft er `git status --porcelain -- <pfad>` im Repo des Eintrags.
Ist die Ausgabe leer, ist die Datei getrackt und gegenüber HEAD unverändert, es gibt nichts zu
schützen, und der Anspruch wird über `gib_anspruch_frei` zurückgenommen. Jede nicht leere
Ausgabe lässt den Anspruch stehen, also eine uncommittete Änderung (` M`), eine Löschung (` D`)
und ausdrücklich auch eine untrackte Datei (`??`).

Warum nicht `git diff HEAD --quiet`: Das meldet für eine **untrackte** Datei ebenfalls „keine
Abweichung" (gemessen 12.09.2026: Rückgabewert 0 auf einer nie committeten Datei). Der Hook hätte
damit genau der Arbeit den Schutz genommen, für die der Riegel da ist, denn eine frisch angelegte
Datei kann eine fremde Sitzung mitstagen. Gefunden in der Abnahme zu ADR-2026-09-12-110133.

Was er NICHT tut
----------------
Er fasst keinen fremden Eintrag an (`gib_anspruch_frei` lehnt das ohnehin ab), er meldet
nichts und er blockt nie: Jeder Fehler endet still mit Code 0, damit ein kaputter Hook keine
Eingabe abweist (ADR-2026-09-02-141242).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))


def ist_sauber(repo: str, pfad: str) -> bool:
    """True, wenn die Datei getrackt und gegenüber HEAD unverändert ist.

    Gemessen wird mit `git status --porcelain -- <pfad>`: Eine leere Ausgabe heißt getrackt und
    unverändert, jede Zeile darin heißt schützenswert. Das deckt die untrackte Datei (`??`) mit
    ab, die `git diff HEAD --quiet` fälschlich als sauber meldet.

    Im Zweifel False: Ein git-Fehler, ein von git gemeldeter Fehlschlag, ein Pfad außerhalb des
    Repos oder ein absoluter Pfad gelten als nicht sauber, damit der Anspruch im Unklaren
    bestehen bleibt statt zu fallen.
    """
    if not repo or not os.path.isdir(repo):
        return False
    if os.path.isabs(pfad):
        return False
    try:
        fertig = subprocess.run(
            ['git', 'status', '--porcelain', '--', pfad],
            cwd=repo, capture_output=True, text=True, timeout=20)
    except Exception:  # noqa: BLE001
        return False
    if fertig.returncode != 0:
        return False
    return fertig.stdout.strip() == ''


def main() -> int:
    try:
        import sitzungsregister_lib as reg

        session_id = reg.eigene_session_id()
        if not session_id:
            return 0
        kennung = reg.kennung_aus(session_id)
        datei = reg.register_verzeichnis() / ('%s.json' % kennung)
        eintrag = reg._lies_datei(datei)
        if not eintrag:
            return 0
        repo = eintrag.get('repo') or ''
        pfade = []
        for feld in ('ansprueche',) + tuple(getattr(reg, 'SCHWACHE_FELDER', ())):
            for a in eintrag.get(feld) or []:
                if isinstance(a, str) and a not in pfade:
                    pfade.append(a)
        for pfad in pfade:
            # Ein Glob-Anspruch ("ordner/**") ist keine einzelne Datei; git diff würde ihn
            # anders auflösen als anspruch_trifft. Solche Ansprüche bleiben stehen.
            if any(z in pfad for z in '*?['):
                continue
            if ist_sauber(repo, pfad):
                try:
                    reg.gib_anspruch_frei(pfad)
                except Exception:  # noqa: BLE001
                    continue
    except Exception:  # noqa: BLE001
        return 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
