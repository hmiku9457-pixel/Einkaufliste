#!/usr/bin/env python3
'''Erweitert assets/js/main.js idempotent um den zentralen Zutatenkatalog.

Die bestehende Website-Struktur bleibt erhalten. Neue CMS-Rezepte speichern im
Zutatenobjekt nur `id` und `menge`; Name und Einheit werden beim Laden aus
`data/zutaten/00_katalog.json` ergänzt. Alte Rezepte mit eigener Einheit bleiben
weiterhin unverändert kompatibel.
'''

from __future__ import annotations

import sys
from pathlib import Path

PATH = Path("assets/js/main.js")


def fail(message: str) -> None:
    print(f"::error file={PATH}::{message}")
    raise SystemExit(1)


def insert_after(text: str, anchor: str, addition: str, check: str) -> str:
    if check in text:
        return text
    if anchor not in text:
        fail(f"Patch-Anker nicht gefunden: {anchor!r}")
    return text.replace(anchor, anchor + addition, 1)


def insert_before(text: str, anchor: str, addition: str, check: str) -> str:
    if check in text:
        return text
    if anchor not in text:
        fail(f"Patch-Anker nicht gefunden: {anchor!r}")
    return text.replace(anchor, addition + anchor, 1)


def main() -> int:
    if not PATH.is_file():
        fail("assets/js/main.js wurde nicht gefunden.")

    text = PATH.read_text(encoding="utf-8")
    original = text

    text = insert_after(
        text,
        'const GERICHTE_PFAD =\n\t"data/gerichte";',
        '\n\nconst ZUTATEN_KATALOG =\n\t"data/zutaten/00_katalog.json";',
        'const ZUTATEN_KATALOG =',
    )

    text = insert_after(
        text,
        'const gerichte =\n\tnew Map();',
        '\nconst zutatenKatalog =\n\tnew Map();\nlet zutatenKatalogGeladen =\n\tfalse;',
        'const zutatenKatalog =',
    )

    helper = r'''
/* ---------------------------------------------------------
   4a. Zentralen Zutatenkatalog laden
   --------------------------------------------------------- */
async function loadZutatenKatalog() {

	if (
		zutatenKatalogGeladen
	) {
		return zutatenKatalog;
	}

	zutatenKatalog.clear();

	const response =
		await fetch(
			ZUTATEN_KATALOG
		);

	if (!response.ok) {
		throw new Error(
			`Zutatenkatalog konnte nicht geladen werden: ${response.status}`
		);
	}

	const katalog =
		await response.json();

	if (
		!katalog ||
		!katalog.zutaten ||
		typeof katalog.zutaten !== "object" ||
		Array.isArray(katalog.zutaten)
	) {
		throw new Error(
			"Der Zutatenkatalog besitzt keine gültige Struktur."
		);
	}

	Object.entries(
		katalog.zutaten
	).forEach(
		([id, zutat]) => {
			if (
				typeof id !== "string" ||
				!zutat ||
				typeof zutat.name !== "string" ||
				zutat.name.trim() === ""
			) {
				console.warn(
					"Ungültiger Eintrag im Zutatenkatalog wurde übersprungen:",
					id,
					zutat
				);
				return;
			}

			zutatenKatalog.set(
				id,
				zutat
			);
		}
	);

	zutatenKatalogGeladen =
		true;

	return zutatenKatalog;
}

/**
 * Ergänzt Name und Einheit einer Rezept-Zutat aus dem zentralen Katalog.
 * Alte Rezeptdateien mit eigenem name-/einheit-Feld bleiben als Fallback kompatibel.
 */
function resolveZutatenNamen(
	gericht
) {

	if (
		!gericht ||
		!Array.isArray(
			gericht.zutaten
		)
	) {
		return gericht;
	}

	gericht.zutaten =
		gericht.zutaten.map(
			zutat => {
				if (
					!zutat ||
					typeof zutat !== "object"
				) {
					return zutat;
				}

				const id =
					typeof zutat.id === "string"
						? zutat.id.trim()
						: "";

				if (!id) {
					return zutat;
				}

				const katalogEintrag =
					zutatenKatalog.get(
						id
					);

				return {
					...zutat,
					name:
						katalogEintrag?.name ||
						zutat.name ||
						id,
					einheit:
						(typeof zutat.einheit === "string" && zutat.einheit.trim() !== "")
							? zutat.einheit
							: (katalogEintrag?.standardEinheit || "g")
				};
			}
		);

	return gericht;
}


'''
    text = insert_before(
        text,
        '/* ---------------------------------------------------------\n   4. Gerichte laden',
        helper,
        'async function loadZutatenKatalog()',
    )

    load_anchor = 'async function loadGerichte() {\n\n\tgerichte.clear();'
    load_addition = r'''

	try {
		await loadZutatenKatalog();
	} catch (error) {
		/*
		 * Die Seite bleibt auch bei einem Katalogfehler nutzbar.
		 * Alte Rezepte verwenden ihr vorhandenes name-Feld;
		 * neue Rezepte fallen notfalls auf die Zutaten-ID zurück.
		 */
		console.warn(
			"Zutatenkatalog konnte nicht geladen werden. Fallback wird verwendet.",
			error
		);
	}
'''
    if 'await loadZutatenKatalog();' not in text:
        if load_anchor not in text:
            fail("loadGerichte()-Anker wurde nicht gefunden.")
        text = text.replace(load_anchor, load_anchor + load_addition, 1)

    recipe_anchor = 'const gericht =\n\t\t\t\tawait response.json();'
    recipe_addition = r'''

			resolveZutatenNamen(
				gericht
			);
'''
    if 'resolveZutatenNamen(\n\t\t\t\tgericht' not in text:
        if recipe_anchor not in text:
            fail("Gericht-Ladeanker wurde nicht gefunden.")
        text = text.replace(recipe_anchor, recipe_anchor + recipe_addition, 1)

    if text == original:
        print("main.js enthält die Zutatenkatalog-Integration bereits vollständig.")
        return 0

    PATH.write_text(text, encoding="utf-8")
    print("assets/js/main.js wurde um den zentralen Zutatenkatalog erweitert.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
