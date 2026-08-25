#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

INDEX = ROOT / "index.html"
RECIPE_OVERVIEW = ROOT / "rezept_uebersicht.html"
MAIN_JS = ROOT / "assets" / "js" / "main.js"
MAIN_CSS = ROOT / "assets" / "css" / "main.css"
TEMPLATE_JSON = ROOT / "data" / "gerichte" / "00_template.json"
PAGES_CONFIG = ROOT / ".pages.yml"
SUBMIT_PAGE = ROOT / "rezept_einreichen.html"

MARKER = "UX-UPDATE-2026-08-25"


def read(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Pflichtdatei fehlt: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> bool:
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old == content:
        return False

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    print(f"[GEÄNDERT] {path.relative_to(ROOT)}")
    return True


def replace_js_function(text: str, name: str, replacement: str) -> str:
    pattern = re.compile(rf"(?m)^(?:async\s+)?function\s+{re.escape(name)}\s*\(")
    match = pattern.search(text)

    if not match:
        raise RuntimeError(f"JavaScript-Funktion nicht gefunden: {name}")

    brace = text.find("{", match.end())
    if brace < 0:
        raise RuntimeError(f"Öffnende Klammer von {name} nicht gefunden.")

    depth = 0
    i = brace
    quote = None
    escaped = False
    line_comment = False
    block_comment = False

    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""

        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue

        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue

        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue

        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
            continue

        if ch in ("'", '"', "`"):
            quote = ch
            i += 1
            continue

        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1

            if depth == 0:
                end = i + 1
                return text[:match.start()] + replacement.rstrip() + text[end:]

        i += 1

    raise RuntimeError(f"Schließende Klammer von {name} nicht gefunden.")



def ensure_zutaten_catalog_integration() -> None:
    """Aktiviert die bereits im Repository vorbereitete Zutatenkatalog-Integration."""
    current = read(MAIN_JS)

    if "const ZUTATEN_KATALOG =" in current:
        return

    helper = ROOT / "tools" / "patch_main_js_zutaten.py"

    if not helper.exists():
        print(
            "[HINWEIS] tools/patch_main_js_zutaten.py fehlt; "
            "alte Rezeptdateien bleiben nutzbar, neue CMS-Rezepte benötigen "
            "für Name/Einheit den zentralen Katalog."
        )
        return

    subprocess.run(
        [sys.executable, str(helper)],
        cwd=ROOT,
        check=True,
    )


def patch_index(text: str) -> str:
    if 'id="gerichtSuche"' not in text:
        controls = r'''
					<div class="filter-toolbar" aria-label="Gerichte filtern">
						<label class="filter-field">
							<span>Suche</span>
							<input
								type="search"
								id="gerichtSuche"
								placeholder="Rezept oder Zutat suchen …"
								autocomplete="off"
							>
						</label>

						<label class="filter-field">
							<span>Kategorie</span>
							<select id="gerichtKategorie">
								<option value="">Alle Kategorien</option>
							</select>
						</label>
					</div>

'''
        pattern = re.compile(
            r'<div\b(?=[^>]*\bid="controls")(?=[^>]*\bclass="gerichte-liste")[^>]*></div>',
            re.S,
        )
        match = pattern.search(text)

        if not match:
            raise RuntimeError("index.html: #controls konnte nicht gefunden werden.")

        text = text[:match.start()] + controls + text[match.start():]

    if 'id="groupShoppingListToggle"' not in text:
        shopping_tools = r'''
					<div class="shopping-toolbar">
						<div class="filter-toolbar filter-toolbar-shopping" aria-label="Zutaten filtern">
							<label class="filter-field">
								<span>Zutat suchen</span>
								<input
									type="search"
									id="zutatenSuche"
									placeholder="Zutat suchen …"
									autocomplete="off"
								>
							</label>

							<label class="filter-field">
								<span>Kategorie</span>
								<select id="zutatenKategorie">
									<option value="">Alle Kategorien</option>
								</select>
							</label>
						</div>

						<label class="toggle-control">
							<input
								type="checkbox"
								id="groupShoppingListToggle"
							>
							<span>Nach Gericht gruppieren</span>
						</label>

						<p
							id="shoppingProgress"
							class="shopping-progress"
							aria-live="polite"
						></p>
					</div>

'''
        ul_pattern = re.compile(
            r'<ul\b(?=[^>]*\bid="zutatenListe")(?=[^>]*\baria-live="polite")[^>]*>.*?</ul>',
            re.S,
        )
        match = ul_pattern.search(text)

        if not match:
            raise RuntimeError("index.html: #zutatenListe konnte nicht gefunden werden.")

        replacement = shopping_tools + r'''					<div
						id="zutatenListe"
						aria-live="polite"
					>
						<p class="empty-state"><em>Keine Zutaten ausgewählt</em></p>
					</div>'''

        text = text[:match.start()] + replacement + text[match.end():]

    return text


def patch_recipe_overview(text: str) -> str:
    if 'href="rezept_einreichen.html"' not in text:
        nav = re.search(
            r'(<nav[^>]*aria-label="Seitennavigation"[^>]*>.*?)(</nav>)',
            text,
            re.S,
        )

        if not nav:
            raise RuntimeError("rezept_uebersicht.html: Navigation nicht gefunden.")

        addition = r'''
			<a href="rezept_einreichen.html" class="button button-secondary">
				Rezept einreichen
			</a>
		'''
        text = text[:nav.start(2)] + addition + text[nav.start(2):]

    if 'id="rezeptSuche"' not in text:
        target = '<div id="rezeptListe"></div>'

        if target not in text:
            raise RuntimeError("rezept_uebersicht.html: #rezeptListe nicht gefunden.")

        filters = r'''
		<div class="filter-toolbar recipe-overview-filters" aria-label="Rezepte filtern">
			<label class="filter-field">
				<span>Suche</span>
				<input
					type="search"
					id="rezeptSuche"
					placeholder="Rezept oder Zutat suchen …"
					autocomplete="off"
				>
			</label>

			<label class="filter-field">
				<span>Kategorie</span>
				<select id="rezeptKategorie">
					<option value="">Alle Kategorien</option>
				</select>
			</label>
		</div>

'''
        text = text.replace(target, filters + "\t\t" + target, 1)

    return text


CONSTANTS = r'''
const SHOPPING_CHECKED_KEY =
	"abgehakteZutaten";

const GROUPED_VIEW_KEY =
	"einkaufslisteNachGericht";

const RECIPE_SUBMISSION_ISSUES_URL =
	"https://github.com/hmiku9457-pixel/Einkaufliste/issues/new";

const RECIPE_CATEGORIES = [
	"Fleisch",
	"Fisch",
	"Vegetarisch",
	"Suppe",
	"Pasta & Gnocchi",
	"Reisgericht",
	"Ofengericht"
];
'''

HELPERS = r'''
/* =========================================================
   UX-HILFSFUNKTIONEN
   UX-UPDATE-2026-08-25
   ========================================================= */

function normalizeFilterText(value) {
	return String(value ?? "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();
}

function uniqueStrings(values) {
	return Array.from(
		new Set(
			values
				.filter(Boolean)
				.map(value => String(value).trim())
				.filter(Boolean)
		)
	);
}

function getRezeptKategorien(gericht) {
	const explicit = Array.isArray(gericht?.kategorien)
		? uniqueStrings(gericht.kategorien)
		: (
			typeof gericht?.kategorie === "string"
				? [gericht.kategorie.trim()].filter(Boolean)
				: []
		);

	if (explicit.length > 0) {
		return explicit;
	}

	const haystack = normalizeFilterText(
		[
			gericht?.name,
			...(gericht?.zutaten ?? []).map(zutat => zutat?.name)
		].join(" ")
	);

	const result = [];

	if (/(lachs|fisch|thunfisch|garnele|forelle)/.test(haystack)) {
		result.push("Fisch");
	} else if (/(haehn|hahnchen|fleisch|hack|chorizo|wurst|speck|schinken|salami)/.test(haystack)) {
		result.push("Fleisch");
	} else {
		result.push("Vegetarisch");
	}

	if (/suppe/.test(haystack)) {
		result.push("Suppe");
	}

	if (/(spaghetti|nudel|pasta|gnocchi)/.test(haystack)) {
		result.push("Pasta & Gnocchi");
	}

	if (/(^|\s)reis(\s|$)|reisgericht/.test(haystack)) {
		result.push("Reisgericht");
	}

	if (/(ofen|ueberback|uberback|kruste)/.test(haystack)) {
		result.push("Ofengericht");
	}

	return uniqueStrings(result);
}

function getCatalogIngredient(zutat) {
	const id =
		typeof zutat?.id === "string"
			? zutat.id.trim()
			: "";

	if (!id) {
		return null;
	}

	if (
		typeof zutatenKatalog !== "undefined" &&
		zutatenKatalog instanceof Map
	) {
		return zutatenKatalog.get(id) ?? null;
	}

	return null;
}

function getZutatKategorie(zutat) {
	if (
		typeof zutat?.kategorie === "string" &&
		zutat.kategorie.trim()
	) {
		return zutat.kategorie.trim();
	}

	const catalog =
		getCatalogIngredient(zutat);

	if (
		typeof catalog?.kategorie === "string" &&
		catalog.kategorie.trim()
	) {
		return catalog.kategorie.trim();
	}

	const name = normalizeFilterText(zutat?.name);

	const tests = [
		[
			"Obst",
			/(zitrone|apfel|orange|limette|banane|mango|beere)/
		],
		[
			"Gemüse",
			/(tomat|paprika|zwiebel|knoblauch|champignon|kartoffel|zucchini|salat|spinat|brokkoli|karotte|mohre|gurke|aubergine|mais)/
		],
		[
			"Fisch & Meeresfrüchte",
			/(lachs|fisch|thunfisch|garnele|forelle|kabeljau)/
		],
		[
			"Fleisch",
			/(haehn|hahnchen|fleisch|hack|chorizo|wurst|speck|schinken|salami|pute)/
		],
		[
			"Milchprodukte & Eier",
			/(sahne|milch|kaese|kase|feta|frischkaese|frischkase|butter|joghurt|quark|ei\b|eier)/
		],
		[
			"Getreide & Beilagen",
			/(reis|nudel|spaghetti|pasta|gnocchi|mehl|brot|toast|couscous|bulgur|hafer)/
		],
		[
			"Gewürze & Kräuter",
			/(salz|pfeffer|gewuerz|gewurz|paprikapulver|curry|thymian|basilikum|oregano|rosmarin|oel|ol\b)/
		],
		[
			"Öle, Saucen & Würzmittel",
			/(bruehe|bruhe|senf|honig|tomatenmark|sauce|sojasauce|kokosmilch|essig|pesto)/
		]
	];

	for (const [category, regex] of tests) {
		if (regex.test(name)) {
			return category;
		}
	}

	return "Sonstiges";
}

function getIngredientKey(zutat) {
	return `${zutat?.id ?? normalizeFilterText(zutat?.name)}::${zutat?.einheit ?? ""}`;
}

function loadCheckedIngredientKeys() {
	try {
		const raw = localStorage.getItem(SHOPPING_CHECKED_KEY);

		if (!raw) {
			return new Set();
		}

		const parsed = JSON.parse(raw);

		return new Set(
			Array.isArray(parsed)
				? parsed.filter(value => typeof value === "string")
				: []
		);
	} catch (error) {
		console.warn(
			"Abgehakte Zutaten konnten nicht geladen werden:",
			error
		);
		return new Set();
	}
}

function saveCheckedIngredientKeys(keys) {
	localStorage.setItem(
		SHOPPING_CHECKED_KEY,
		JSON.stringify(Array.from(keys))
	);
}

function setIngredientChecked(key, checked) {
	const keys = loadCheckedIngredientKeys();

	if (checked) {
		keys.add(key);
	} else {
		keys.delete(key);
	}

	saveCheckedIngredientKeys(keys);
}

function populateSelect(select, values, emptyLabel) {
	if (!select) {
		return;
	}

	const oldValue = select.value;
	const sorted = uniqueStrings(values)
		.sort((a, b) => a.localeCompare(b, "de"));

	select.innerHTML = "";

	const all = document.createElement("option");
	all.value = "";
	all.textContent = emptyLabel;
	select.appendChild(all);

	sorted.forEach(value => {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = value;
		select.appendChild(option);
	});

	if (
		oldValue &&
		sorted.includes(oldValue)
	) {
		select.value = oldValue;
	}
}

function populateRecipeCategoryFilter(select) {
	populateSelect(
		select,
		Array.from(gerichte.values())
			.flatMap(getRezeptKategorien),
		"Alle Kategorien"
	);
}

function populateIngredientCategoryFilter(select, einkaufsliste) {
	populateSelect(
		select,
		einkaufsliste.map(getZutatKategorie),
		"Alle Kategorien"
	);
}

function applyGerichtFilter(controls) {
	const search = normalizeFilterText(
		document.getElementById("gerichtSuche")?.value
	);

	const category =
		document.getElementById("gerichtKategorie")?.value ?? "";

	controls
		.querySelectorAll(".gericht")
		.forEach(container => {
			const categories =
				(container.dataset.categories ?? "")
					.split("|")
					.filter(Boolean);

			const matchesSearch =
				!search ||
				normalizeFilterText(container.dataset.search)
					.includes(search);

			const matchesCategory =
				!category ||
				categories.includes(category);

			container.hidden =
				!(matchesSearch && matchesCategory);
		});
}

function applyRezeptFilter(rezeptListe) {
	const search = normalizeFilterText(
		document.getElementById("rezeptSuche")?.value
	);

	const category =
		document.getElementById("rezeptKategorie")?.value ?? "";

	let visible = 0;

	rezeptListe
		.querySelectorAll(".rezept-card")
		.forEach(card => {
			const categories =
				(card.dataset.categories ?? "")
					.split("|")
					.filter(Boolean);

			const matchesSearch =
				!search ||
				normalizeFilterText(card.dataset.search)
					.includes(search);

			const matchesCategory =
				!category ||
				categories.includes(category);

			card.hidden =
				!(matchesSearch && matchesCategory);

			if (!card.hidden) {
				visible += 1;
			}
		});

	let empty =
		rezeptListe.querySelector(".recipe-filter-empty");

	if (visible === 0) {
		if (!empty) {
			empty = document.createElement("p");
			empty.className =
				"recipe-filter-empty empty-state";
			empty.textContent =
				"Keine passenden Rezepte gefunden.";
			rezeptListe.appendChild(empty);
		}
	} else {
		empty?.remove();
	}
}

function createGroupedShoppingList(controls) {
	return getSelectedGerichte(controls)
		.map(gericht => ({
			gerichtId: gericht.id,
			gerichtName: gericht.name,
			zutaten: (gericht.zutaten ?? [])
				.filter(zutat => zutat?.id && zutat?.name)
				.map(zutat => ({
					id: zutat.id,
					name: zutat.name,
					menge: Number(zutat.menge),
					einheit: zutat.einheit ?? "",
					kategorie:
						zutat.kategorie ?? null
				}))
				.filter(zutat =>
					Number.isFinite(zutat.menge)
				)
		}))
		.filter(group => group.zutaten.length > 0);
}

function createShoppingItem(zutat, checkedKeys) {
	const li =
		document.createElement("li");

	li.className =
		"shopping-item";

	const key =
		getIngredientKey(zutat);

	const checked =
		checkedKeys.has(key);

	if (checked) {
		li.classList.add("is-done");
	}

	const label =
		document.createElement("label");

	const checkbox =
		document.createElement("input");

	checkbox.type =
		"checkbox";

	checkbox.className =
		"shopping-item-checkbox";

	checkbox.dataset.shoppingKey =
		key;

	checkbox.checked =
		checked;

	checkbox.setAttribute(
		"aria-label",
		`${zutat.name} als erledigt markieren`
	);

	const text =
		document.createElement("span");

	text.className =
		"shopping-item-text";

	const einheit =
		zutat.einheit
			? ` ${zutat.einheit}`
			: "";

	text.textContent =
		`${formatMenge(zutat.menge)}${einheit} ${zutat.name}`;

	label.appendChild(checkbox);
	label.appendChild(text);
	li.appendChild(label);

	return li;
}

function ingredientMatchesFilters(zutat) {
	const search = normalizeFilterText(
		document.getElementById("zutatenSuche")?.value
	);

	const category =
		document.getElementById("zutatenKategorie")?.value ?? "";

	return (
		(
			!search ||
			normalizeFilterText(zutat?.name)
				.includes(search)
		) &&
		(
			!category ||
			getZutatKategorie(zutat) === category
		)
	);
}

function updateShoppingProgress(einkaufsliste) {
	const target =
		document.getElementById("shoppingProgress");

	if (!target) {
		return;
	}

	if (einkaufsliste.length === 0) {
		target.textContent = "";
		return;
	}

	const checked =
		loadCheckedIngredientKeys();

	const allKeys =
		uniqueStrings(
			einkaufsliste.map(getIngredientKey)
		);

	const done =
		allKeys.filter(key =>
			checked.has(key)
		).length;

	target.textContent =
		`${done} von ${allKeys.length} Zutaten erledigt`;
}

function slugifyRecipeId(value) {
	const words =
		normalizeFilterText(value)
			.replace(/[^a-z0-9]+/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean);

	if (words.length === 0) {
		return "rezeptVorschlag";
	}

	return (
		words[0] +
		words
			.slice(1)
			.map(word =>
				word.charAt(0).toUpperCase() +
				word.slice(1)
			)
			.join("")
	);
}

function collectIngredientSuggestions() {
	const map =
		new Map();

	if (
		typeof zutatenKatalog !== "undefined" &&
		zutatenKatalog instanceof Map
	) {
		zutatenKatalog.forEach(
			(item, id) => {
				if (!item?.name) {
					return;
				}

				map.set(
					normalizeFilterText(item.name),
					{
						id,
						name:
							item.name,
						kategorie:
							item.kategorie ?? null,
						standardEinheit:
							item.standardEinheit ?? null
					}
				);
			}
		);
	}

	gerichte.forEach(gericht => {
		(gericht.zutaten ?? [])
			.forEach(zutat => {
				if (!zutat?.name) {
					return;
				}

				const key =
					normalizeFilterText(
						zutat.name
					);

				if (!map.has(key)) {
					map.set(
						key,
						{
							id:
								zutat.id ??
								slugifyRecipeId(zutat.name),
							name:
								zutat.name,
							kategorie:
								getZutatKategorie(zutat),
							standardEinheit:
								zutat.einheit ?? null
						}
					);
				}
			});
	});

	return map;
}

function createSubmissionIngredientRow(
	container,
	datalistId,
	suggestions
) {
	const row =
		document.createElement("div");

	row.className =
		"submission-ingredient-row";

	const name =
		document.createElement("input");

	name.type =
		"text";
	name.className =
		"submission-ingredient-name";
	name.placeholder =
		"Zutat";
	name.setAttribute(
		"list",
		datalistId
	);
	name.required =
		true;

	const amount =
		document.createElement("input");

	amount.type =
		"number";
	amount.className =
		"submission-ingredient-amount";
	amount.placeholder =
		"Menge";
	amount.min =
		"0.01";
	amount.step =
		"0.01";
	amount.required =
		true;

	const unit =
		document.createElement("select");

	unit.className =
		"submission-ingredient-unit";
	unit.required =
		true;

	["g", "ml"].forEach(value => {
		const option =
			document.createElement("option");
		option.value =
			value;
		option.textContent =
			value;
		unit.appendChild(option);
	});

	const syncUnitWithIngredient =
		() => {
			const match =
				suggestions?.get(
					normalizeFilterText(
						name.value
					)
				);

			if (
				match?.standardEinheit === "g" ||
				match?.standardEinheit === "ml"
			) {
				unit.value =
					match.standardEinheit;
				unit.disabled =
					true;
			} else {
				unit.disabled =
					false;
			}
		};

	name.addEventListener(
		"input",
		syncUnitWithIngredient
	);

	const remove =
		document.createElement("button");

	remove.type =
		"button";
	remove.className =
		"button submission-remove-ingredient";
	remove.textContent =
		"Entfernen";

	remove.addEventListener(
		"click",
		() => {
			if (
				container.children.length > 1
			) {
				row.remove();
			}
		}
	);

	row.appendChild(name);
	row.appendChild(amount);
	row.appendChild(unit);
	row.appendChild(remove);

	container.appendChild(row);
}

async function initRezeptEinreichen() {
	const form =
		document.getElementById(
			"recipeSubmissionForm"
		);

	if (!form) {
		return;
	}

	const ingredientsContainer =
		document.getElementById(
			"submissionIngredients"
		);

	const addButton =
		document.getElementById(
			"addSubmissionIngredient"
		);

	const datalist =
		document.getElementById(
			"ingredientSuggestions"
		);

	const categoriesContainer =
		document.getElementById(
			"submissionCategories"
		);

	const preview =
		document.getElementById(
			"submissionPreview"
		);

	const previewOutput =
		document.getElementById(
			"submissionJson"
		);

	if (
		!ingredientsContainer ||
		!addButton ||
		!datalist ||
		!categoriesContainer ||
		!preview ||
		!previewOutput
	) {
		throw new Error(
			"Das Rezeptvorschlagsformular ist unvollständig."
		);
	}

	try {
		await loadGerichte();
	} catch (error) {
		console.warn(
			"Bestehende Zutaten konnten für die Vorschläge nicht geladen werden.",
			error
		);
	}

	const suggestions =
		collectIngredientSuggestions();

	suggestions.forEach(item => {
		const option =
			document.createElement("option");

		option.value =
			item.name;

		datalist.appendChild(option);
	});

	RECIPE_CATEGORIES.forEach(category => {
		const label =
			document.createElement("label");

		label.className =
			"submission-category";

		const input =
			document.createElement("input");

		input.type =
			"checkbox";
		input.name =
			"submissionCategory";
		input.value =
			category;

		const text =
			document.createElement("span");

		text.textContent =
			category;

		label.appendChild(input);
		label.appendChild(text);

		categoriesContainer.appendChild(label);
	});

	createSubmissionIngredientRow(
		ingredientsContainer,
		datalist.id,
		suggestions
	);

	addButton.addEventListener(
		"click",
		() => {
			createSubmissionIngredientRow(
				ingredientsContainer,
				datalist.id,
				suggestions
			);
		}
	);

	form.addEventListener(
		"submit",
		event => {
			event.preventDefault();

			if (!form.reportValidity()) {
				return;
			}

			const recipeName =
				document.getElementById(
					"submissionRecipeName"
				).value.trim();

			const ingredientRows =
				Array.from(
					ingredientsContainer
						.querySelectorAll(
							".submission-ingredient-row"
						)
				);

			const ingredients =
				ingredientRows
					.map(row => {
						const rawName =
							row.querySelector(
								".submission-ingredient-name"
							).value.trim();

						const match =
							suggestions.get(
								normalizeFilterText(
									rawName
								)
							);

						return {
							id:
								match?.id ??
								slugifyRecipeId(
									rawName
								),
							name:
								match?.name ??
								rawName,
							menge:
								Number(
									row.querySelector(
										".submission-ingredient-amount"
									).value
								),
							einheit:
								row.querySelector(
									".submission-ingredient-unit"
								).value,
							kategorie:
								match?.kategorie ?? null
						};
					})
					.filter(item =>
						item.name &&
						Number.isFinite(item.menge) &&
						item.menge > 0
					);

			const categories =
				Array.from(
					form.querySelectorAll(
						'input[name="submissionCategory"]:checked'
					)
				)
					.map(input =>
						input.value
					);

			const preparation =
				document.getElementById(
					"submissionPreparation"
				)
					.value
					.split(/\r?\n/)
					.map(step =>
						step.trim()
					)
					.filter(Boolean);

			const proposal = {
				id:
					slugifyRecipeId(
						recipeName
					),
				name:
					recipeName,
				kategorien:
					categories,
				zutaten:
					ingredients,
				zubereitung:
					preparation
			};

			const json =
				JSON.stringify(
					proposal,
					null,
					2
				);

			previewOutput.value =
				json;

			preview.hidden =
				false;

			const issueTitle =
				`[Rezeptvorschlag] ${recipeName}`;

			const issueBody =
				[
					"## Rezeptvorschlag",
					"",
					"Dieser Vorschlag wurde über die öffentliche Rezeptseite erstellt.",
					"Er wird **nicht automatisch** als Rezept veröffentlicht.",
					"",
					"```json",
					json,
					"```"
				].join("\n");

			const url =
				`${RECIPE_SUBMISSION_ISSUES_URL}?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}`;

			window.open(
				url,
				"_blank",
				"noopener"
			);
		}
	);
}
'''

RENDER_GERICHTE = r'''function renderGerichte(
	controls
) {
	controls.innerHTML =
		"";

	gerichte.forEach(
		gericht => {
			const container =
				document.createElement(
					"div"
				);

			container.className =
				"gericht";

			container.dataset.search =
				[
					gericht.name,
					...(gericht.zutaten ?? [])
						.map(zutat =>
							zutat?.name ?? ""
						)
				].join(" ");

			container.dataset.categories =
				getRezeptKategorien(
					gericht
				).join("|");

			const label =
				document.createElement(
					"label"
				);

			const checkbox =
				document.createElement(
					"input"
				);

			checkbox.type =
				"checkbox";

			checkbox.value =
				gericht.id;

			checkbox.id =
				`gericht-${gericht.id}`;

			const textWrapper =
				document.createElement(
					"span"
				);

			textWrapper.className =
				"gericht-text";

			const name =
				document.createElement(
					"span"
				);

			name.className =
				"gericht-name";

			name.textContent =
				gericht.name;

			const categories =
				document.createElement(
					"small"
				);

			categories.className =
				"gericht-categories";

			categories.textContent =
				getRezeptKategorien(
					gericht
				).join(" · ");

			textWrapper.appendChild(
				name
			);

			textWrapper.appendChild(
				categories
			);

			label.appendChild(
				checkbox
			);

			label.appendChild(
				textWrapper
			);

			container.appendChild(
				label
			);

			if (
				gericht.bild
			) {
				const image =
					document.createElement(
						"img"
					);

				image.alt =
					gericht.name;

				image.className =
					"icon";

				image.loading =
					"lazy";

				image.decoding =
					"async";

				container.appendChild(
					image
				);

				loadOptionalImage(
					image,
					gericht.bild
				);
			}

			controls.appendChild(
				container
			);
		}
	);
}'''

RENDER_SHOPPING = r'''function renderShoppingList(
	zutatenListe,
	einkaufsliste,
	groupedShoppingList = []
) {
	zutatenListe.innerHTML =
		"";

	updateShoppingProgress(
		einkaufsliste
	);

	if (
		einkaufsliste.length === 0
	) {
		const empty =
			document.createElement(
				"p"
			);

		empty.className =
			"empty-state";

		empty.innerHTML =
			"<em>Keine Zutaten ausgewählt</em>";

		zutatenListe.appendChild(
			empty
		);

		return;
	}

	const grouped =
		document.getElementById(
			"groupShoppingListToggle"
		)?.checked ?? false;

	const checkedKeys =
		loadCheckedIngredientKeys();

	const createSection =
		(title, items, extraClass = "") => {
			if (
				items.length === 0
			) {
				return null;
			}

			const section =
				document.createElement(
					"section"
				);

			section.className =
				`shopping-section ${extraClass}`.trim();

			const heading =
				document.createElement(
					"h3"
				);

			heading.textContent =
				title;

			const list =
				document.createElement(
					"ul"
				);

			list.className =
				"shopping-list";

			items.forEach(
				item => {
					list.appendChild(
						createShoppingItem(
							item,
							checkedKeys
						)
					);
				}
			);

			section.appendChild(
				heading
			);

			section.appendChild(
				list
			);

			return section;
		};

	if (grouped) {
		let visibleGroups =
			0;

		groupedShoppingList.forEach(
			group => {
				const items =
					group.zutaten
						.filter(
							ingredientMatchesFilters
						);

				const section =
					createSection(
						group.gerichtName,
						items,
						"shopping-dish-group"
					);

				if (
					section
				) {
					zutatenListe.appendChild(
						section
					);

					visibleGroups +=
						1;
				}
			}
		);

		if (
			visibleGroups === 0
		) {
			const empty =
				document.createElement(
					"p"
				);

			empty.className =
				"empty-state";

			empty.textContent =
				"Keine passenden Zutaten gefunden.";

			zutatenListe.appendChild(
				empty
			);
		}

		return;
	}

	const filtered =
		einkaufsliste
			.filter(
				ingredientMatchesFilters
			);

	const openItems =
		filtered.filter(
			item =>
				!checkedKeys.has(
					getIngredientKey(item)
				)
		);

	const doneItems =
		filtered.filter(
			item =>
				checkedKeys.has(
					getIngredientKey(item)
				)
		);

	const openSection =
		createSection(
			"Offen",
			openItems
		);

	const doneSection =
		createSection(
			`Erledigt${doneItems.length ? ` (${doneItems.length})` : ""}`,
			doneItems,
			"shopping-done-section"
		);

	if (
		openSection
	) {
		zutatenListe.appendChild(
			openSection
		);
	}

	if (
		doneSection
	) {
		zutatenListe.appendChild(
			doneSection
		);
	}

	if (
		!openSection &&
		!doneSection
	) {
		const empty =
			document.createElement(
				"p"
			);

		empty.className =
			"empty-state";

		empty.textContent =
			"Keine passenden Zutaten gefunden.";

		zutatenListe.appendChild(
			empty
		);
	}
}'''

UPDATE_VIEW = r'''function updateEinkaufslisteView(
	controls,
	zutatenListe,
	mapContainer,
	mapImage,
	markersDiv,
	popup
) {
	const einkaufsliste =
		createShoppingList(
			controls
		);

	const groupedShoppingList =
		createGroupedShoppingList(
			controls
		);

	populateIngredientCategoryFilter(
		document.getElementById(
			"zutatenKategorie"
		),
		einkaufsliste
	);

	renderShoppingList(
		zutatenListe,
		einkaufsliste,
		groupedShoppingList
	);

	renderMap(
		mapContainer,
		mapImage,
		markersDiv,
		popup,
		einkaufsliste
	);
}'''

RESET_SELECTION = r'''function resetSelection(
	controls,
	zutatenListe,
	mapContainer,
	mapImage,
	markersDiv,
	popup
) {
	controls
		.querySelectorAll(
			'input[type="checkbox"]'
		)
		.forEach(
			checkbox => {
				checkbox.checked =
					false;
			}
		);

	localStorage.removeItem(
		STORAGE_KEY
	);

	localStorage.removeItem(
		SHOPPING_CHECKED_KEY
	);

	hidePopup(
		popup
	);

	updateEinkaufslisteView(
		controls,
		zutatenListe,
		mapContainer,
		mapImage,
		markersDiv,
		popup
	);
}'''

INIT_SHOPPING = r'''async function initEinkaufsliste() {
	const controls =
		document.getElementById(
			"controls"
		);

	const zutatenListe =
		document.getElementById(
			"zutatenListe"
		);

	const mapContainer =
		document.getElementById(
			"map-container"
		);

	const mapImage =
		document.getElementById(
			"mapImage"
		);

	const markersDiv =
		document.getElementById(
			"markers"
		);

	const popup =
		document.getElementById(
			"popup"
		);

	const resetButton =
		document.getElementById(
			"resetBtn"
		);

	const overlay =
		document.getElementById(
			"iconOverlay"
		);

	const overlayImg =
		document.getElementById(
			"iconOverlayImg"
		);

	const marktAuswahl =
		document.getElementById(
			"marktAuswahl"
		);

	const gerichtSuche =
		document.getElementById(
			"gerichtSuche"
		);

	const gerichtKategorie =
		document.getElementById(
			"gerichtKategorie"
		);

	const zutatenSuche =
		document.getElementById(
			"zutatenSuche"
		);

	const zutatenKategorie =
		document.getElementById(
			"zutatenKategorie"
		);

	const groupToggle =
		document.getElementById(
			"groupShoppingListToggle"
		);

	if (
		!controls ||
		!zutatenListe ||
		!mapContainer ||
		!mapImage ||
		!markersDiv ||
		!popup ||
		!resetButton ||
		!overlay ||
		!overlayImg ||
		!marktAuswahl
	) {
		throw new Error(
			"Die Einkaufsliste enthält nicht alle benötigten HTML-Elemente."
		);
	}

	await loadGerichte();

	renderGerichte(
		controls
	);

	loadState(
		controls
	);

	populateRecipeCategoryFilter(
		gerichtKategorie
	);

	applyGerichtFilter(
		controls
	);

	const checkedMarket =
		marktAuswahl.querySelector(
			'input[name="markt"]:checked'
		);

	currentMap =
		checkedMarket?.value ??
		"none";

	if (
		groupToggle
	) {
		groupToggle.checked =
			localStorage.getItem(
				GROUPED_VIEW_KEY
			) === "true";
	}

	controls.addEventListener(
		"change",
		event => {
			if (
				!event.target.matches(
					'input[type="checkbox"]'
				)
			) {
				return;
			}

			saveState(
				controls
			);

			updateEinkaufslisteView(
				controls,
				zutatenListe,
				mapContainer,
				mapImage,
				markersDiv,
				popup
			);
		}
	);

	controls.addEventListener(
		"click",
		event => {
			const image =
				event.target.closest(
					".icon"
				);

			if (
				!image
			) {
				return;
			}

			event.stopPropagation();

			openOverlay(
				overlay,
				overlayImg,
				image
			);
		}
	);

	gerichtSuche?.addEventListener(
		"input",
		() => {
			applyGerichtFilter(
				controls
			);
		}
	);

	gerichtKategorie?.addEventListener(
		"change",
		() => {
			applyGerichtFilter(
				controls
			);
		}
	);

	const updateShoppingFilters =
		() => {
			updateEinkaufslisteView(
				controls,
				zutatenListe,
				mapContainer,
				mapImage,
				markersDiv,
				popup
			);
		};

	zutatenSuche?.addEventListener(
		"input",
		updateShoppingFilters
	);

	zutatenKategorie?.addEventListener(
		"change",
		updateShoppingFilters
	);

	groupToggle?.addEventListener(
		"change",
		() => {
			localStorage.setItem(
				GROUPED_VIEW_KEY,
				String(
					groupToggle.checked
				)
			);

			updateShoppingFilters();
		}
	);

	zutatenListe.addEventListener(
		"change",
		event => {
			const checkbox =
				event.target.closest(
					".shopping-item-checkbox"
				);

			if (
				!checkbox
			) {
				return;
			}

			setIngredientChecked(
				checkbox.dataset.shoppingKey,
				checkbox.checked
			);

			updateShoppingFilters();
		}
	);

	marktAuswahl.addEventListener(
		"change",
		event => {
			if (
				!event.target.matches(
					'input[name="markt"]'
				)
			) {
				return;
			}

			currentMap =
				event.target.value;

			hidePopup(
				popup
			);

			updateShoppingFilters();
		}
	);

	resetButton.addEventListener(
		"click",
		() => {
			resetSelection(
				controls,
				zutatenListe,
				mapContainer,
				mapImage,
				markersDiv,
				popup
			);
		}
	);

	overlay.addEventListener(
		"click",
		() => {
			closeOverlay(
				overlay,
				overlayImg
			);
		}
	);

	document.addEventListener(
		"keydown",
		event => {
			if (
				event.key !==
				"Escape"
			) {
				return;
			}

			closeOverlay(
				overlay,
				overlayImg
			);

			hidePopup(
				popup
			);
		}
	);

	document.addEventListener(
		"click",
		event => {
			if (
				event.target.closest(
					".marker"
				)
			) {
				return;
			}

			hidePopup(
				popup
			);
		}
	);

	updateShoppingFilters();
}'''

RENDER_OVERVIEW = r'''function renderRezeptUebersicht(
	rezeptListe
) {
	rezeptListe.innerHTML =
		"";

	if (
		gerichte.size === 0
	) {
		const message =
			document.createElement(
				"p"
			);

		message.textContent =
			"Keine Rezepte verfügbar.";

		rezeptListe.appendChild(
			message
		);

		return;
	}

	gerichte.forEach(
		gericht => {
			const card =
				document.createElement(
					"a"
				);

			card.className =
				"rezept-card";

			card.href =
				`rezept.html?id=${encodeURIComponent(gericht.id)}`;

			card.dataset.search =
				[
					gericht.name,
					...(gericht.zutaten ?? [])
						.map(zutat =>
							zutat?.name ?? ""
						)
				].join(" ");

			const categories =
				getRezeptKategorien(
					gericht
				);

			card.dataset.categories =
				categories.join("|");

			if (
				gericht.bild
			) {
				setOptionalBackgroundImage(
					card,
					gericht.bild
				);
			}

			const content =
				document.createElement(
					"span"
				);

			content.className =
				"rezept-card-content";

			const title =
				document.createElement(
					"span"
				);

			title.className =
				"rezept-card-title";

			title.textContent =
				gericht.name;

			const categoryText =
				document.createElement(
					"span"
				);

			categoryText.className =
				"rezept-card-categories";

			categoryText.textContent =
				categories.join(" · ");

			content.appendChild(
				title
			);

			content.appendChild(
				categoryText
			);

			card.appendChild(
				content
			);

			rezeptListe.appendChild(
				card
			);
		}
	);
}'''

INIT_OVERVIEW = r'''async function initRezeptUebersicht() {
	const rezeptListe =
		document.getElementById(
			"rezeptListe"
		);

	if (
		!rezeptListe
	) {
		return;
	}

	const search =
		document.getElementById(
			"rezeptSuche"
		);

	const category =
		document.getElementById(
			"rezeptKategorie"
		);

	await loadGerichte();

	renderRezeptUebersicht(
		rezeptListe
	);

	populateRecipeCategoryFilter(
		category
	);

	const apply =
		() => {
			applyRezeptFilter(
				rezeptListe
			);
		};

	search?.addEventListener(
		"input",
		apply
	);

	category?.addEventListener(
		"change",
		apply
	);

	apply();
}'''

INIT_APP = r'''async function init() {
	try {
		if (
			document.getElementById(
				"recipeSubmissionForm"
			)
		) {
			await initRezeptEinreichen();
			return;
		}

		if (
			document.getElementById(
				"controls"
			) &&
			document.getElementById(
				"zutatenListe"
			)
		) {
			await initEinkaufsliste();
			return;
		}

		if (
			document.getElementById(
				"rezeptListe"
			)
		) {
			await initRezeptUebersicht();
			return;
		}

		if (
			document.getElementById(
				"rezeptDetails"
			)
		) {
			await initRezept();
			return;
		}
	} catch (error) {
		console.error(
			"Initialisierung fehlgeschlagen:",
			error
		);

		const main =
			document.querySelector("main");

		if (
			main &&
			!main.querySelector(
				".fatal-error"
			)
		) {
			const message =
				document.createElement(
					"p"
				);

			message.className =
				"fatal-error";

			message.textContent =
				"Die Daten konnten nicht vollständig geladen werden.";

			main.prepend(
				message
			);
		}
	}
}'''

CSS_BLOCK = r'''
/* =========================================================
   UX-UPDATE-2026-08-25
   Suche, Kategorien, Checklisten, Gruppierung, Submit
   ========================================================= */

.filter-toolbar {
	display: grid;
	grid-template-columns:
		minmax(0, 1fr)
		minmax(150px, 0.45fr);
	gap: 12px;
	margin-bottom: 18px;
}

.filter-field {
	display: grid;
	gap: 6px;
	min-width: 0;
	color: var(--color-text-muted);
	font-size: 0.78rem;
	font-weight: bold;
}

.filter-field input,
.filter-field select,
.submission-form input,
.submission-form select,
.submission-form textarea {
	width: 100%;
	min-width: 0;
	padding: 11px 12px;
	color: var(--color-text);
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-small);
	font: inherit;
}

.filter-field input:focus,
.filter-field select:focus,
.submission-form input:focus,
.submission-form select:focus,
.submission-form textarea:focus {
	border-color: var(--color-primary);
	outline: 3px solid rgba(29, 78, 216, 0.14);
	outline-offset: 1px;
}

.gericht-text {
	display: grid;
	gap: 2px;
	min-width: 0;
}

.gericht-name {
	font-weight: bold;
}

.gericht-categories {
	color: var(--color-text-muted);
	font-size: 0.72rem;
	line-height: 1.25;
}

.shopping-toolbar {
	margin-bottom: 18px;
	padding-bottom: 16px;
	border-bottom: 1px solid var(--color-border);
}

.filter-toolbar-shopping {
	margin-bottom: 12px;
}

.toggle-control {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	background: #fafafa;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-small);
	cursor: pointer;
	font-weight: bold;
}

.toggle-control input {
	width: 21px;
	height: 21px;
	flex-shrink: 0;
	accent-color: var(--color-primary);
	cursor: pointer;
}

.shopping-progress {
	margin: 10px 0 0;
	color: var(--color-text-muted);
	font-size: 0.78rem;
	font-weight: bold;
}

#zutatenListe {
	min-width: 0;
}

.shopping-section {
	margin-bottom: 18px;
}

.shopping-section:last-child {
	margin-bottom: 0;
}

.shopping-section h3 {
	margin: 0 0 9px;
	font-size: 0.92rem;
}

.shopping-dish-group {
	padding: 12px;
	background: #fafafa;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-small);
}

.shopping-done-section {
	padding-top: 14px;
	border-top: 1px solid var(--color-border);
}

.shopping-list {
	display: grid;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.shopping-item {
	margin: 0;
}

.shopping-item label {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	padding: 8px 9px;
	border-radius: var(--border-radius-small);
	cursor: pointer;
}

.shopping-item label:hover {
	background: var(--color-surface-hover);
}

.shopping-item-checkbox {
	width: 21px;
	height: 21px;
	margin-top: 1px;
	flex-shrink: 0;
	accent-color: var(--color-primary);
	cursor: pointer;
}

.shopping-item-text {
	min-width: 0;
	overflow-wrap: anywhere;
}

.shopping-item.is-done .shopping-item-text {
	color: var(--color-text-muted);
	text-decoration: line-through;
	opacity: 0.8;
}

.empty-state {
	margin: 0;
	color: var(--color-text-muted);
}

.recipe-overview-filters {
	max-width: 900px;
	margin-bottom: 24px;
}

.rezept-card-content {
	position: relative;
	z-index: 1;
	display: grid;
	align-self: stretch;
	align-content: end;
	width: 100%;
}

.rezept-card-content .rezept-card-title {
	padding-bottom: 5px;
}

.rezept-card-categories {
	padding: 0 18px 18px;
	color: rgba(255, 255, 255, 0.9);
	font-size: 0.72rem;
	font-weight: bold;
	text-shadow: 0 1px 3px rgba(0, 0, 0, 0.85);
}

.rezept-card[hidden] {
	display: none;
}

.submission-page {
	padding-bottom: 48px;
}

.submission-panel {
	max-width: 960px;
	margin: 0 auto;
}

.submission-intro {
	margin-top: 0;
	color: var(--color-text-muted);
}

.submission-form {
	display: grid;
	gap: 24px;
}

.submission-field {
	display: grid;
	gap: 7px;
}

.submission-field > span,
.submission-group legend {
	font-weight: bold;
}

.submission-field small,
.submission-group small {
	color: var(--color-text-muted);
}

.submission-form textarea {
	min-height: 170px;
	resize: vertical;
}

.submission-group {
	display: grid;
	gap: 12px;
	margin: 0;
	padding: 0;
	border: 0;
}

.submission-categories {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.submission-category {
	display: inline-flex;
	align-items: center;
	gap: 7px;
	padding: 8px 10px;
	background: #fafafa;
	border: 1px solid var(--color-border);
	border-radius: 999px;
	cursor: pointer;
}

.submission-category input {
	width: auto;
	accent-color: var(--color-primary);
}

.submission-ingredients {
	display: grid;
	gap: 10px;
}

.submission-ingredient-row {
	display: grid;
	grid-template-columns:
		minmax(180px, 1fr)
		minmax(90px, 0.3fr)
		90px
		auto;
	gap: 9px;
	align-items: center;
}

.submission-remove-ingredient {
	min-height: 44px;
	padding: 9px 12px;
}

.submission-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}

.submission-preview {
	padding: 16px;
	background: #fafafa;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-small);
}

.submission-preview h2 {
	margin-top: 0;
}

.submission-preview textarea {
	width: 100%;
	min-height: 260px;
	font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
	font-size: 0.8rem;
}

@media (max-width: 800px) {
	.filter-toolbar {
		grid-template-columns: 1fr;
	}

	.submission-ingredient-row {
		grid-template-columns:
			minmax(0, 1fr)
			100px;
	}

	.submission-ingredient-name {
		grid-column: 1 / -1;
	}

	.submission-remove-ingredient {
		grid-column: 1 / -1;
	}
}

@media (max-width: 500px) {
	.submission-actions > *,
	.submission-remove-ingredient {
		width: 100%;
	}

	.submission-ingredient-row {
		grid-template-columns: 1fr 80px;
	}
}
'''

SUBMIT_HTML = r'''<!DOCTYPE html>
<html lang="de">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta
		name="description"
		content="Ein Rezept für die gemeinsame Rezeptsammlung vorschlagen."
	>
	<link rel="stylesheet" href="assets/css/main.css">
	<title>Rezept einreichen</title>
</head>

<body>
	<a class="skip-link" href="#main-content">
		Zum Hauptinhalt
	</a>

	<header class="site-header">
		<div class="page-container header-content">
			<div class="header-heading">
				<p class="eyebrow">Rezeptvorschlag</p>
				<h1>Rezept einreichen</h1>
				<p class="header-description">
					Der Vorschlag wird zuerst geprüft und nicht automatisch veröffentlicht.
				</p>
			</div>

			<nav class="header-actions" aria-label="Seitennavigation">
				<a href="rezept_uebersicht.html" class="button">
					Rezepte
				</a>
				<a href="index.html" class="button">
					Einkaufsliste
				</a>
			</nav>
		</div>
	</header>

	<main id="main-content" class="page-container submission-page">
		<section class="panel submission-panel" aria-labelledby="submission-heading">
			<h2 id="submission-heading">Rezeptvorschlag erstellen</h2>

			<p class="submission-intro">
				Bestehende Zutaten werden beim Tippen vorgeschlagen. Mengen werden
				wie im neuen Rezeptmodell ausschließlich in <strong>g</strong> oder
				<strong>ml</strong> angegeben.
			</p>

			<p class="submission-intro">
				Beim Absenden öffnet sich ein vorausgefüllter GitHub-Vorschlag.
				Dafür müssen im Repository einmalig GitHub Issues aktiviert sein.
			</p>

			<form id="recipeSubmissionForm" class="submission-form">
				<label class="submission-field">
					<span>Name des Gerichts</span>
					<input
						type="text"
						id="submissionRecipeName"
						required
						autocomplete="off"
					>
				</label>

				<fieldset class="submission-group">
					<legend>Kategorien</legend>
					<div
						id="submissionCategories"
						class="submission-categories"
					></div>
				</fieldset>

				<fieldset class="submission-group">
					<legend>Zutaten</legend>
					<small>
						Bekannte Zutaten einfach anfangen zu tippen und auswählen.
					</small>

					<datalist id="ingredientSuggestions"></datalist>

					<div
						id="submissionIngredients"
						class="submission-ingredients"
					></div>

					<div>
						<button
							type="button"
							id="addSubmissionIngredient"
							class="button"
						>
							+ Zutat hinzufügen
						</button>
					</div>
				</fieldset>

				<label class="submission-field">
					<span>Zubereitung</span>
					<small>Ein Schritt pro Zeile.</small>
					<textarea
						id="submissionPreparation"
						required
					></textarea>
				</label>

				<div class="submission-actions">
					<button type="submit" class="button button-secondary">
						Vorschlag an GitHub übergeben
					</button>
				</div>
			</form>

			<section
				id="submissionPreview"
				class="submission-preview"
				hidden
				aria-labelledby="submission-preview-heading"
			>
				<h2 id="submission-preview-heading">JSON-Vorschau</h2>
				<p>
					Das ist der strukturierte Vorschlag, der später geprüft und
					ins CMS übernommen werden kann.
				</p>
				<textarea id="submissionJson" readonly></textarea>
			</section>
		</section>
	</main>

	<script src="assets/js/main.js"></script>
</body>
</html>
'''


def patch_main_js(text: str) -> str:
    if "const SHOPPING_CHECKED_KEY" not in text:
        anchor = re.search(
            r'const\s+STORAGE_KEY\s*=\s*"ausgewaehlteGerichte";',
            text,
            re.S,
        )

        if not anchor:
            raise RuntimeError("main.js: STORAGE_KEY-Anker nicht gefunden.")

        text = text[:anchor.end()] + "\n" + CONSTANTS + text[anchor.end():]

    if MARKER not in text:
        marker = "/* =========================================================\n   EINKAUFSLISTE"
        pos = text.find(marker)

        if pos < 0:
            raise RuntimeError("main.js: EINKAUFSLISTE-Marker nicht gefunden.")

        text = text[:pos] + HELPERS + "\n\n" + text[pos:]

    replacements = {
        "renderGerichte": RENDER_GERICHTE,
        "renderShoppingList": RENDER_SHOPPING,
        "updateEinkaufslisteView": UPDATE_VIEW,
        "resetSelection": RESET_SELECTION,
        "initEinkaufsliste": INIT_SHOPPING,
        "renderRezeptUebersicht": RENDER_OVERVIEW,
        "initRezeptUebersicht": INIT_OVERVIEW,
        "init": INIT_APP,
    }

    for name, replacement in replacements.items():
        text = replace_js_function(text, name, replacement)

    return text


def patch_css(text: str) -> str:
    if MARKER in text:
        return text

    return text.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"



def patch_pages_config(text: str) -> str:
    if "- name: kategorien" in text:
        return text

    name_block = """      - name: name
        label: Rezeptname
        type: string
        required: true
        options:
          maxlength: 160
"""

    if name_block not in text:
        raise RuntimeError(
            ".pages.yml: Rezeptname-Feld konnte nicht gefunden werden."
        )

    category_block = """
      - name: kategorien
        label: Rezeptkategorien
        type: select
        required: true
        description: "Eine oder mehrere Kategorien für Suche und Filter auswählen."
        options:
          multiple: true
          min: 1
          placeholder: "Kategorien auswählen"
          values:
            - Fleisch
            - Fisch
            - Vegetarisch
            - Suppe
            - Pasta & Gnocchi
            - Reisgericht
            - Ofengericht
"""

    text = text.replace(
        name_block,
        name_block + category_block,
        1,
    )

    text = text.replace(
        "      fields: [name, id]",
        "      fields: [name, kategorien, id]",
        1,
    )

    text = text.replace(
        "      search: [name, id]",
        "      search: [name, kategorien, id]",
        1,
    )

    return text


def patch_template_json(text: str) -> str:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        print("[HINWEIS] 00_template.json ist kein valides JSON; Template nicht geändert.")
        return text

    if not isinstance(data, dict):
        return text

    changed = False

    if "kategorien" not in data:
        new_data = {}

        for key, value in data.items():
            if key == "zutaten":
                new_data["kategorien"] = ["Vegetarisch"]

            new_data[key] = value

        data = new_data
        changed = True

    ingredients = data.get("zutaten")

    if isinstance(ingredients, list):
        for ingredient in ingredients:
            if (
                isinstance(ingredient, dict) and
                ingredient.get("einheit") not in ("g", "ml")
            ):
                ingredient["einheit"] = "g"
                changed = True

    if not changed:
        return text

    return json.dumps(
        data,
        ensure_ascii=False,
        indent=2
    ) + "\n"


def main() -> None:
    changed = False

    ensure_zutaten_catalog_integration()

    changed |= write(
        INDEX,
        patch_index(
            read(INDEX)
        )
    )

    changed |= write(
        RECIPE_OVERVIEW,
        patch_recipe_overview(
            read(RECIPE_OVERVIEW)
        )
    )

    changed |= write(
        MAIN_JS,
        patch_main_js(
            read(MAIN_JS)
        )
    )

    changed |= write(
        MAIN_CSS,
        patch_css(
            read(MAIN_CSS)
        )
    )

    if TEMPLATE_JSON.exists():
        changed |= write(
            TEMPLATE_JSON,
            patch_template_json(
                read(TEMPLATE_JSON)
            )
        )


    if PAGES_CONFIG.exists():
        changed |= write(
            PAGES_CONFIG,
            patch_pages_config(
                read(PAGES_CONFIG)
            )
        )

    changed |= write(
        SUBMIT_PAGE,
        SUBMIT_HTML
    )

    if not changed:
        print("[OK] Keine Änderungen notwendig – Update ist bereits vorhanden.")
    else:
        print()
        print("[OK] UX-Update erfolgreich angewendet.")
        print("[MANUELL] GitHub → Settings → General → Features → Issues aktivieren,")
        print("          damit öffentliche Rezeptvorschläge übergeben werden können.")


if __name__ == "__main__":
    main()
