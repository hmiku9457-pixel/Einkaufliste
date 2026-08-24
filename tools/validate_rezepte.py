#!/usr/bin/env python3
"""Validiert Zutatenkatalog und Rezepte für die Einkaufsliste.

Neue CMS-Rezepte speichern pro Zutat nur noch id, menge und einheit.
Der sichtbare Zutatenname wird zur Laufzeit aus data/zutaten/00_katalog.json ergänzt.
Alte Rezeptdateien mit zusätzlichem name-Feld bleiben kompatibel.
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path
from typing import Any

GERICHTE_DIR = Path("data/gerichte")
ZUTATEN_DIR = Path("data/zutaten")
ID_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
ALLOWED_UNITS = {
    "g", "kg", "ml", "l", "Stk", "EL", "TL", "Prise", "n. B.", "Bund",
    "Becher", "Dose", "Packung", "Glas", "Flasche", "Scheiben", "Zehen",
    "Handvoll", "Tasse", "Würfel", "Blatt", "Rolle",
}


def error(path: Path, message: str) -> None:
    print(f"::error file={path}::{message}")


def warning(path: Path, message: str) -> None:
    print(f"::warning file={path}::{message}")


def is_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return math.isfinite(float(value))
    if isinstance(value, str):
        try:
            return math.isfinite(float(value.replace(",", ".")))
        except ValueError:
            return False
    return False


def load_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        error(path, f"Ungültiges JSON: {exc.msg} (Zeile {exc.lineno}, Spalte {exc.colno}).")
        return None


def validate_ingredients() -> tuple[dict[str, dict[str, Any]], bool]:
    if not ZUTATEN_DIR.is_dir():
        print(f"::error::{ZUTATEN_DIR} wurde nicht gefunden.")
        return {}, False

    files = sorted(
        p for p in ZUTATEN_DIR.glob("*.json")
        if p.is_file() and not p.name.startswith("00_")
    )
    if not files:
        print("::error::Keine Zutaten-Dateien gefunden.")
        return {}, False

    catalog: dict[str, dict[str, Any]] = {}
    valid = True

    for path in files:
        data = load_json(path)
        if data is None:
            valid = False
            continue
        if not isinstance(data, dict):
            error(path, "Die JSON-Wurzel muss ein Objekt sein.")
            valid = False
            continue

        iid = data.get("id")
        name = data.get("name")
        category = data.get("kategorie")
        standard_unit = data.get("standardEinheit")

        problems: list[str] = []
        if not isinstance(iid, str) or not iid.strip() or not ID_RE.fullmatch(iid):
            problems.append("Feld 'id' fehlt, ist leer oder enthält unzulässige Zeichen.")
        elif path.stem != iid:
            problems.append(f"Dateiname '{path.stem}.json' muss zur Zutaten-ID '{iid}' passen.")
        if not isinstance(name, str) or not name.strip():
            problems.append("Feld 'name' fehlt oder ist leer.")
        if not isinstance(category, str) or not category.strip():
            problems.append("Feld 'kategorie' fehlt oder ist leer.")
        if standard_unit not in ALLOWED_UNITS:
            problems.append(f"Feld 'standardEinheit' ist ungültig: {standard_unit!r}.")

        for problem in problems:
            error(path, problem)
        if problems:
            valid = False
            continue

        assert isinstance(iid, str)
        if iid in catalog:
            error(path, f"Doppelte Zutaten-ID '{iid}'.")
            valid = False
            continue
        catalog[iid] = data

    return catalog, valid


def validate_recipes(catalog: dict[str, dict[str, Any]]) -> bool:
    if not GERICHTE_DIR.is_dir():
        print(f"::error::{GERICHTE_DIR} wurde nicht gefunden.")
        return False

    files = sorted(
        p for p in GERICHTE_DIR.glob("*.json")
        if p.is_file() and not p.name.startswith("00_")
    )
    if not files:
        print("::error::Keine Rezeptdateien gefunden.")
        return False

    valid = True
    seen_recipe_ids: dict[str, Path] = {}

    for path in files:
        data = load_json(path)
        if data is None:
            valid = False
            continue
        if not isinstance(data, dict):
            error(path, "Die JSON-Wurzel muss ein Objekt sein.")
            valid = False
            continue

        problems: list[str] = []
        recipe_id = data.get("id")
        if not isinstance(recipe_id, str) or not recipe_id.strip():
            problems.append("Feld 'id' fehlt oder ist leer.")
        elif not ID_RE.fullmatch(recipe_id):
            problems.append("Feld 'id' enthält unzulässige Zeichen.")

        name = data.get("name")
        if not isinstance(name, str) or not name.strip():
            problems.append("Feld 'name' fehlt oder ist leer.")

        bild = data.get("bild")
        if bild is not None and not isinstance(bild, str):
            problems.append("Feld 'bild' muss leer/null oder ein String sein.")

        zutaten = data.get("zutaten")
        if not isinstance(zutaten, list):
            problems.append("Feld 'zutaten' muss eine Liste sein.")
        elif not zutaten:
            problems.append("Feld 'zutaten' darf nicht leer sein.")
        else:
            for index, zutat in enumerate(zutaten, start=1):
                prefix = f"Zutat {index}"
                if not isinstance(zutat, dict):
                    problems.append(f"{prefix} muss ein Objekt sein.")
                    continue

                zutat_id = zutat.get("id")
                if not isinstance(zutat_id, str) or not zutat_id.strip():
                    problems.append(f"{prefix}: 'id' fehlt oder ist leer.")
                elif not ID_RE.fullmatch(zutat_id):
                    problems.append(f"{prefix}: 'id' enthält unzulässige Zeichen.")
                elif zutat_id not in catalog:
                    problems.append(
                        f"{prefix}: Zutaten-ID '{zutat_id}' existiert nicht im zentralen Zutatenkatalog."
                    )
                else:
                    old_name = zutat.get("name")
                    canonical = catalog[zutat_id]["name"]
                    if isinstance(old_name, str) and old_name.strip() and old_name != canonical:
                        warning(
                            path,
                            f"{prefix}: altes name-Feld '{old_name}' weicht vom Katalognamen "
                            f"'{canonical}' ab. Die Webseite verwendet künftig den Katalognamen."
                        )

                if not is_number(zutat.get("menge")):
                    problems.append(f"{prefix}: 'menge' ist keine gültige Zahl.")
                elif float(str(zutat.get("menge")).replace(",", ".")) < 0:
                    problems.append(f"{prefix}: 'menge' darf nicht negativ sein.")

                unit = zutat.get("einheit")
                if not isinstance(unit, str) or not unit.strip():
                    problems.append(f"{prefix}: 'einheit' fehlt oder ist leer.")
                elif unit not in ALLOWED_UNITS:
                    problems.append(f"{prefix}: unbekannte Einheit '{unit}'.")

        preparation = data.get("zubereitung")
        if preparation is not None:
            if not isinstance(preparation, list):
                problems.append("Feld 'zubereitung' muss eine Liste sein.")
            else:
                for index, step in enumerate(preparation, start=1):
                    if not isinstance(step, str) or not step.strip():
                        problems.append(f"Zubereitungsschritt {index} ist leer oder kein String.")

        for problem in problems:
            error(path, problem)
        if problems:
            valid = False
            continue

        assert isinstance(recipe_id, str)
        if recipe_id in seen_recipe_ids:
            error(path, f"Doppelte Rezept-ID '{recipe_id}'. Bereits verwendet in {seen_recipe_ids[recipe_id]}.")
            valid = False
        else:
            seen_recipe_ids[recipe_id] = path

    return valid


def main() -> int:
    catalog, ingredients_ok = validate_ingredients()
    recipes_ok = validate_recipes(catalog) if catalog else False

    if not ingredients_ok or not recipes_ok:
        print("Datenprüfung fehlgeschlagen.")
        return 1

    print(f"Datenprüfung erfolgreich: {len(catalog)} Zutaten im Katalog; Rezepte gültig.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
