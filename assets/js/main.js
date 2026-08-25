/* =========================================================
   Einkaufsliste & Rezepte
   Main JavaScript
   ========================================================= */


/* ---------------------------------------------------------
   1. Konfiguration
   --------------------------------------------------------- */

const GERICHTE_MANIFEST =
	"data/gerichte/00_manifest.json";

const GERICHTE_PFAD =
	"data/gerichte";

const ZUTATEN_KATALOG =
	"data/zutaten/00_katalog.json";

const STORAGE_KEY =
	"ausgewaehlteGerichte";

const SHOPPING_CHECKED_KEY =
	"abgehakteZutaten";

const GROUPED_VIEW_KEY =
	"einkaufslisteNachGericht";

const SHOPPING_STARTED_KEY =
	"einkaufGestartet";

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



/* ---------------------------------------------------------
   2. Marktdaten
   --------------------------------------------------------- */

const maps = {

	edeka: {
		image: "data/laeden/karte-edeka.png",

		zutaten: {

			tomate: {
				top: 60,
				left: 65
			},

			kaese: {
				top: 35,
				left: 94
			},

			nudeln: {
				top: 34,
				left: 75
			},

			salat: {
				top: 65,
				left: 55
			},

			haehnchenbrust: {
				top: 19,
				left: 78
			}
		}
	},


	lidl: {
		image: "data/laeden/karte-lidl.png",

		zutaten: {

			tomate: {
				top: 30,
				left: 49
			},

			kaese: {
				top: 45,
				left: 20
			},

			nudeln: {
				top: 65,
				left: 45
			},

			salat: {
				top: 20,
				left: 60
			},

			haehnchenbrust: {
				top: 35,
				left: 60
			}
		}
	}
};


/* ---------------------------------------------------------
   3. Globaler Zustand
   --------------------------------------------------------- */

const gerichte =
	new Map();
const zutatenKatalog =
	new Map();
let zutatenKatalogGeladen =
	false;

let currentMap =
	"none";


/* =========================================================
   GEMEINSAME FUNKTIONEN
   ========================================================= */



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


/* ---------------------------------------------------------
   4. Gerichte laden
   --------------------------------------------------------- */

/**
 * Lädt das Gerichte-Manifest und anschließend alle darin
 * aufgeführten Gericht-Dateien.
 *
 * Fehlende, fehlerhafte oder ungültige Dateien werden
 * übersprungen.
 *
 * @returns {Promise<Map<string, Object>>}
 */
async function loadGerichte() {

	gerichte.clear();

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



	const response =
		await fetch(
			GERICHTE_MANIFEST
		);


	if (!response.ok) {

		throw new Error(
			`Gerichte-Manifest konnte nicht geladen werden: ${response.status}`
		);
	}


	const manifest =
		await response.json();


	if (
		!manifest ||
		!Array.isArray(
			manifest.gerichte
		)
	) {

		throw new Error(
			"Das Gerichte-Manifest enthält keine gültige Gerichte-Liste."
		);
	}


	for (
		const datei
		of manifest.gerichte
	) {

		/*
		 * Ungültige Einträge im Manifest überspringen.
		 */
		if (
			typeof datei !== "string" ||
			datei.trim() === ""
		) {

			console.warn(
				"Ungültiger Eintrag im Gerichte-Manifest wurde übersprungen:",
				datei
			);

			continue;
		}


		try {

			const response =
				await fetch(
					`${GERICHTE_PFAD}/${datei}`
				);


			if (!response.ok) {

				console.warn(
					`Gericht "${datei}" wurde übersprungen: HTTP ${response.status}`
				);

				continue;
			}


			const gericht =
				await response.json();

			resolveZutatenNamen(
				gericht
			);



			if (
				!isValidGericht(
					gericht
				)
			) {

				console.warn(
					`Gericht "${datei}" besitzt keine gültige Struktur und wurde übersprungen.`,
					gericht
				);

				continue;
			}


			if (
				gerichte.has(
					gericht.id
				)
			) {

				console.warn(
					`Doppelte Gericht-ID "${gericht.id}" in "${datei}". Datei wurde übersprungen.`
				);

				continue;
			}


			gerichte.set(
				gericht.id,
				gericht
			);

		} catch (error) {

			console.warn(
				`Gericht "${datei}" konnte nicht verarbeitet werden und wurde übersprungen.`,
				error
			);
		}
	}


	return gerichte;
}


/**
 * Prüft die grundlegende Struktur eines Gerichts.
 *
 * Zusätzliche Rezeptfelder wie "portionen",
 * "zubereitungszeit" und "zubereitung" sind optional.
 *
 * @param {Object} gericht
 * @returns {boolean}
 */
function isValidGericht(
	gericht
) {

	return Boolean(
		gericht &&
		typeof gericht.id === "string" &&
		gericht.id.trim() !== "" &&
		typeof gericht.name === "string" &&
		gericht.name.trim() !== "" &&
		Array.isArray(
			gericht.zutaten
		)
	);
}


/* ---------------------------------------------------------
   5. Mengen formatieren
   --------------------------------------------------------- */

/**
 * Formatiert Mengen für die deutsche Darstellung.
 *
 * @param {number} menge
 * @returns {string}
 */
function formatMenge(
	menge
) {

	return new Intl.NumberFormat(
		"de-DE",
		{
			maximumFractionDigits: 2
		}
	).format(
		menge
	);
}


/* ---------------------------------------------------------
   6. Optionale Bilder
   --------------------------------------------------------- */

/**
 * Lädt ein Bild und blendet es erst ein, wenn die Datei
 * erfolgreich geladen wurde.
 *
 * Falls die Datei nicht existiert, wird das Bildelement
 * vollständig entfernt. Der 404-Fehler bleibt weiterhin
 * in der Browserkonsole sichtbar.
 *
 * @param {HTMLImageElement} image
 * @param {string} imagePath
 */
function loadOptionalImage(
	image,
	imagePath
) {

	if (
		!imagePath ||
		typeof imagePath !== "string"
	) {

		image.remove();

		return;
	}


	/*
	 * Verhindert, dass während des Ladevorgangs kurz ein
	 * defektes Bildsymbol angezeigt wird.
	 */
	image.hidden =
		true;


	image.addEventListener(
		"load",
		() => {

			image.hidden =
				false;
		},
		{
			once: true
		}
	);


	image.addEventListener(
		"error",
		() => {

			image.remove();
		},
		{
			once: true
		}
	);


	image.src =
		imagePath;
}


/**
 * Setzt ein Hintergrundbild erst dann, wenn es erfolgreich
 * geladen wurde.
 *
 * Bei einem Fehler bleibt lediglich die normale
 * Hintergrundfarbe des Elements sichtbar.
 *
 * @param {HTMLElement} element
 * @param {string} imagePath
 */
function setOptionalBackgroundImage(
	element,
	imagePath
) {

	if (
		!imagePath ||
		typeof imagePath !== "string"
	) {

		return;
	}


	const image =
		new Image();


	image.addEventListener(
		"load",
		() => {

			element.style.backgroundImage =
				`url(${JSON.stringify(imagePath)})`;
		},
		{
			once: true
		}
	);


	/*
	 * Kein eigener Error-Handler notwendig:
	 * Bei einem Fehler wird einfach kein Hintergrundbild
	 * gesetzt. Der 404 bleibt in der Konsole sichtbar.
	 */
	image.src =
		imagePath;
}



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


/* =========================================================
   EINKAUFSLISTE
   ========================================================= */


/* ---------------------------------------------------------
   7. Gerichte für Einkaufsliste darstellen
   --------------------------------------------------------- */

/**
 * Erstellt die Gericht-Auswahl auf der Startseite.
 *
 * @param {HTMLElement} controls
 */
function renderGerichte(
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
}


/* ---------------------------------------------------------
   8. Ausgewählte Gerichte
   --------------------------------------------------------- */

/**
 * Gibt alle aktuell ausgewählten Gerichte zurück.
 *
 * @param {HTMLElement} controls
 * @returns {Array<Object>}
 */
function getSelectedGerichte(
	controls
) {

	const selected =
		[];


	controls
		.querySelectorAll(
			'input[type="checkbox"]:checked'
		)
		.forEach(
			checkbox => {

				const gericht =
					gerichte.get(
						checkbox.value
					);


				if (
					gericht
				) {

					selected.push(
						gericht
					);
				}
			}
		);


	return selected;
}


/* ---------------------------------------------------------
   9. Einkaufsliste berechnen
   --------------------------------------------------------- */

/**
 * Fasst die Zutaten aller ausgewählten Gerichte zusammen.
 *
 * Gleiche Zutaten mit gleicher Einheit werden addiert.
 *
 * @param {HTMLElement} controls
 * @returns {Array<Object>}
 */
function createShoppingList(
	controls
) {

	const einkaufsliste =
		new Map();


	const selectedGerichte =
		getSelectedGerichte(
			controls
		);


	selectedGerichte.forEach(
		gericht => {

			gericht.zutaten.forEach(
				zutat => {

					if (
						!zutat ||
						!zutat.id ||
						!zutat.name
					) {

						console.warn(
							`Ungültige Zutat in "${gericht.name}" wurde übersprungen.`,
							zutat
						);

						return;
					}


					const menge =
						Number(
							zutat.menge
						);


					if (
						!Number.isFinite(
							menge
						)
					) {

						console.warn(
							`Ungültige Menge bei "${zutat.name}" in "${gericht.name}".`
						);

						return;
					}


					const einheit =
						zutat.einheit ?? "";


					const key =
						`${zutat.id}::${einheit}`;


					if (
						!einkaufsliste.has(
							key
						)
					) {

						einkaufsliste.set(
							key,
							{
								id:
									zutat.id,

								name:
									zutat.name,

								menge:
									0,

								einheit:
									einheit
							}
						);
					}


					einkaufsliste
						.get(
							key
						)
						.menge +=
							menge;
				}
			);
		}
	);


	return Array.from(
		einkaufsliste.values()
	);
}


/* ---------------------------------------------------------
   10. Einkaufsliste darstellen
   --------------------------------------------------------- */

/**
 * Rendert die Einkaufsliste.
 *
 * @param {HTMLElement} zutatenListe
 * @param {Array<Object>} einkaufsliste
 */
function renderShoppingList(
	zutatenListe,
	einkaufsliste,
	groupedShoppingList = []
) {
	zutatenListe.innerHTML =
		"";

	updateShoppingProgress(
		einkaufsliste
	);

	syncGroupToggleAvailability(
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
}


/* ---------------------------------------------------------
   11. Karte darstellen
   --------------------------------------------------------- */

/**
 * Aktualisiert die Marktkarte.
 *
 * @param {HTMLElement} mapContainer
 * @param {HTMLImageElement} mapImage
 * @param {HTMLElement} markersDiv
 * @param {HTMLElement} popup
 * @param {Array<Object>} einkaufsliste
 */
function renderMap(
	mapContainer,
	mapImage,
	markersDiv,
	popup,
	einkaufsliste
) {

	markersDiv.innerHTML =
		"";


	if (
		currentMap === "none"
	) {

		mapContainer.classList.add(
			"hidden"
		);

		return;
	}


	const map =
		maps[currentMap];


	if (
		!map
	) {

		console.warn(
			`Unbekannte Karte: ${currentMap}`
		);

		mapContainer.classList.add(
			"hidden"
		);

		return;
	}


	mapContainer.classList.remove(
		"hidden"
	);


	mapImage.src =
		map.image;


	renderMarkers(
		markersDiv,
		popup,
		einkaufsliste,
		map
	);
}


/* ---------------------------------------------------------
   12. Kartenmarker
   --------------------------------------------------------- */

/**
 * Erstellt die Marker auf der Marktkarte.
 *
 * Zutaten mit identischer Position werden zu einem Marker
 * zusammengefasst.
 *
 * @param {HTMLElement} markersDiv
 * @param {HTMLElement} popup
 * @param {Array<Object>} einkaufsliste
 * @param {Object} map
 */
function renderMarkers(
	markersDiv,
	popup,
	einkaufsliste,
	map
) {

	const positions =
		{};


	einkaufsliste.forEach(
		zutat => {

			const position =
				map.zutaten[
					zutat.id
				];


			if (
				!position
			) {

				return;
			}


			const positionKey =
				`${position.top}-${position.left}`;


			if (
				!positions[
					positionKey
				]
			) {

				positions[
					positionKey
				] = {

					top:
						position.top,

					left:
						position.left,

					items:
						[]
				};
			}


			positions[
				positionKey
			].items.push(
				zutat
			);
		}
	);


	Object.values(
		positions
	).forEach(
		position => {

			const marker =
				document.createElement(
					"button"
				);

			marker.type =
				"button";

			marker.className =
				"marker";


			marker.style.top =
				`${position.top}%`;

			marker.style.left =
				`${position.left}%`;


			/*
			 * Anzahl unterschiedlicher Einkaufspositionen
			 * an dieser Position.
			 */
			marker.textContent =
				position.items.length;


			marker.addEventListener(
				"click",
				event => {

					event.stopPropagation();


					showPopup(
						popup,
						marker,
						position.items
					);
				}
			);


			markersDiv.appendChild(
				marker
			);
		}
	);
}


/* ---------------------------------------------------------
   13. Karten-Popup
   --------------------------------------------------------- */

/**
 * Öffnet das Zutaten-Popup eines Markers.
 *
 * @param {HTMLElement} popup
 * @param {HTMLElement} marker
 * @param {Array<Object>} items
 */
function showPopup(
	popup,
	marker,
	items
) {

	const text =
		items
			.map(
				item => {

					const einheit =
						item.einheit
							? ` ${item.einheit}`
							: "";


					return (
						`${formatMenge(item.menge)}${einheit} ${item.name}`
					);
				}
			)
			.join(
				"\n"
			);


	popup.textContent =
		text;


	popup.style.display =
		"block";


	popup.style.top =
		`${marker.offsetTop - 30}px`;


	popup.style.left =
		`${marker.offsetLeft + 25}px`;
}


/**
 * Schließt das Zutaten-Popup.
 *
 * @param {HTMLElement|null} popup
 */
function hidePopup(
	popup
) {

	if (
		popup
	) {

		popup.style.display =
			"none";
	}
}


/* ---------------------------------------------------------
   14. Bild-Overlay
   --------------------------------------------------------- */

/**
 * Öffnet das Rezeptbild im Overlay.
 *
 * @param {HTMLElement} overlay
 * @param {HTMLImageElement} overlayImg
 * @param {HTMLImageElement} image
 */
function openOverlay(
	overlay,
	overlayImg,
	image
) {

	overlayImg.src =
		image.src;


	overlayImg.alt =
		image.alt;


	overlay.style.display =
		"flex";
}


/**
 * Schließt das Rezeptbild.
 *
 * @param {HTMLElement|null} overlay
 * @param {HTMLImageElement|null} overlayImg
 */
function closeOverlay(
	overlay,
	overlayImg
) {

	if (
		!overlay ||
		!overlayImg
	) {

		return;
	}


	overlay.style.display =
		"none";


	overlayImg.src =
		"";


	overlayImg.alt =
		"";
}


/* ---------------------------------------------------------
   15. LocalStorage
   --------------------------------------------------------- */

/**
 * Speichert die IDs der ausgewählten Gerichte.
 *
 * @param {HTMLElement} controls
 */
function saveState(
	controls
) {

	const selectedIds =
		getSelectedGerichte(
			controls
		)
			.map(
				gericht =>
					gericht.id
			);


	localStorage.setItem(
		STORAGE_KEY,
		JSON.stringify(
			selectedIds
		)
	);
}


/**
 * Lädt die gespeicherte Auswahl.
 *
 * @param {HTMLElement} controls
 */
function loadState(
	controls
) {

	try {

		const saved =
			localStorage.getItem(
				STORAGE_KEY
			);


		if (
			!saved
		) {

			return;
		}


		const selectedIds =
			JSON.parse(
				saved
			);


		if (
			!Array.isArray(
				selectedIds
			)
		) {

			return;
		}


		controls
			.querySelectorAll(
				'input[type="checkbox"]'
			)
			.forEach(
				checkbox => {

					checkbox.checked =
						selectedIds.includes(
							checkbox.value
						);
				}
			);

	} catch (
		error
	) {

		console.error(
			"Gespeicherte Gerichte konnten nicht geladen werden:",
			error
		);
	}
}


/* ---------------------------------------------------------
   16. Einkaufsliste aktualisieren
   --------------------------------------------------------- */

function updateEinkaufslisteView(
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
}


/* ---------------------------------------------------------
   17. Einkaufsliste zurücksetzen
   --------------------------------------------------------- */

function resetSelection(
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

	localStorage.removeItem(
		GROUPED_VIEW_KEY
	);

	localStorage.removeItem(
		SHOPPING_STARTED_KEY
	);

	const groupToggle =
		document.getElementById(
			"groupShoppingListToggle"
		);

	if (groupToggle) {
		groupToggle.checked =
			false;
		groupToggle.disabled =
			true;
	}

	const marketNone =
		document.querySelector(
			'#marktAuswahl input[name="markt"][value="none"]'
		);

	if (marketNone) {
		marketNone.checked =
			true;
	}

	currentMap =
		"none";

	hidePopup(
		popup
	);

	updateContinueButton(
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


/* ---------------------------------------------------------
   18. Einkaufsliste initialisieren
   --------------------------------------------------------- */


/* =========================================================
   STEP-WORKFLOW-UPDATE-2026-08-25
   Zweistufiger Einkauf
   ========================================================= */

function getShoppingCompletion(einkaufsliste) {
	const checkedKeys =
		loadCheckedIngredientKeys();

	const allKeys =
		uniqueStrings(
			einkaufsliste.map(
				getIngredientKey
			)
		);

	const done =
		allKeys.filter(key =>
			checkedKeys.has(key)
		).length;

	return {
		done,
		total: allKeys.length,
		complete:
			allKeys.length > 0 &&
			done === allKeys.length
	};
}

function syncGroupToggleAvailability(einkaufsliste) {
	const toggle =
		document.getElementById(
			"groupShoppingListToggle"
		);

	const hint =
		document.getElementById(
			"groupToggleHint"
		);

	if (!toggle) {
		return;
	}

	const status =
		getShoppingCompletion(
			einkaufsliste
		);

	toggle.disabled =
		!status.complete;

	const wrapper =
		toggle.closest(
			".toggle-control"
		);

	wrapper?.classList.toggle(
		"toggle-control-locked",
		!status.complete
	);

	if (!status.complete) {
		toggle.checked =
			false;

		localStorage.setItem(
			GROUPED_VIEW_KEY,
			"false"
		);
	}

	if (hint) {
		hint.textContent =
			status.complete
				? "Einkauf vollständig – die Zutaten können jetzt nach Gericht gruppiert werden."
				: status.total > 0
					? `Nach dem Einkauf verfügbar (${status.done}/${status.total} erledigt).`
					: "Diese Ansicht wird verfügbar, sobald alles eingekauft ist.";
	}
}

function updateContinueButton(controls) {
	const button =
		document.getElementById(
			"confirmSelectionBtn"
		);

	if (!button) {
		return;
	}

	button.disabled =
		getSelectedGerichte(
			controls
		).length === 0;
}

function setPurchaseStep(step) {
	const selectionStep =
		document.getElementById(
			"selectionStep"
		);

	const shoppingStep =
		document.getElementById(
			"shoppingStep"
		);

	const backButton =
		document.getElementById(
			"backToSelectionBtn"
		);

	const shoppingActive =
		step === 2;

	if (selectionStep) {
		selectionStep.hidden =
			shoppingActive;
	}

	if (shoppingStep) {
		shoppingStep.hidden =
			!shoppingActive;
	}

	if (backButton) {
		backButton.hidden =
			!shoppingActive;
	}
}


async function initEinkaufsliste() {
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

	const continueButton =
		document.getElementById(
			"confirmSelectionBtn"
		);

	const backButton =
		document.getElementById(
			"backToSelectionBtn"
		);

	const resetModal =
		document.getElementById(
			"resetShoppingModal"
		);

	const cancelResetButton =
		document.getElementById(
			"cancelResetShoppingBtn"
		);

	const confirmResetButton =
		document.getElementById(
			"confirmResetShoppingBtn"
		);

	if (
		!controls ||
		!zutatenListe ||
		!mapContainer ||
		!mapImage ||
		!markersDiv ||
		!popup ||
		!overlay ||
		!overlayImg ||
		!marktAuswahl ||
		!continueButton ||
		!backButton ||
		!resetModal ||
		!cancelResetButton ||
		!confirmResetButton
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

	updateContinueButton(
		controls
	);

	const checkedMarket =
		marktAuswahl.querySelector(
			'input[name="markt"]:checked'
		);

	currentMap =
		checkedMarket?.value ??
		"none";

	if (groupToggle) {
		groupToggle.checked =
			localStorage.getItem(
				GROUPED_VIEW_KEY
			) === "true";
	}

	const hasSelection =
		getSelectedGerichte(
			controls
		).length > 0;

	const shoppingStarted =
		hasSelection &&
		localStorage.getItem(
			SHOPPING_STARTED_KEY
		) === "true";

	if (!hasSelection) {
		localStorage.removeItem(
			SHOPPING_STARTED_KEY
		);
	}

	setPurchaseStep(
		shoppingStarted
			? 2
			: 1
	);

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

			updateContinueButton(
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

			if (!image) {
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
			if (groupToggle.disabled) {
				groupToggle.checked =
					false;
				return;
			}

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

			if (!checkbox) {
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

	continueButton.addEventListener(
		"click",
		() => {
			if (
				getSelectedGerichte(
					controls
				).length === 0
			) {
				return;
			}

			localStorage.setItem(
				SHOPPING_STARTED_KEY,
				"true"
			);

			setPurchaseStep(2);
			updateShoppingFilters();

			window.scrollTo({
				top: 0,
				behavior: "smooth"
			});
		}
	);

	backButton.addEventListener(
		"click",
		() => {
			resetModal.showModal();
		}
	);

	cancelResetButton.addEventListener(
		"click",
		() => {
			resetModal.close();
		}
	);

	confirmResetButton.addEventListener(
		"click",
		() => {
			resetModal.close();

			resetSelection(
				controls,
				zutatenListe,
				mapContainer,
				mapImage,
				markersDiv,
				popup
			);

			if (gerichtSuche) {
				gerichtSuche.value =
					"";
			}

			if (gerichtKategorie) {
				gerichtKategorie.value =
					"";
			}

			if (zutatenSuche) {
				zutatenSuche.value =
					"";
			}

			if (zutatenKategorie) {
				zutatenKategorie.value =
					"";
			}

			applyGerichtFilter(
				controls
			);

			setPurchaseStep(1);

			window.scrollTo({
				top: 0,
				behavior: "smooth"
			});
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
}


/* =========================================================
   REZEPTÜBERSICHT
   ========================================================= */


/* ---------------------------------------------------------
   19. Rezeptübersicht darstellen
   --------------------------------------------------------- */

/**
 * Erstellt eine Rezeptkarte für jedes geladene Gericht.
 *
 * Die Karten sind Links, können per CSS aber vollständig
 * wie Buttons gestaltet werden.
 *
 * @param {HTMLElement} rezeptListe
 */
function renderRezeptUebersicht(
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
}


/* ---------------------------------------------------------
   20. Rezeptübersicht initialisieren
   --------------------------------------------------------- */

async function initRezeptUebersicht() {
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
}


/* =========================================================
   EINZELNES REZEPT
   ========================================================= */


/* ---------------------------------------------------------
   21. Rezept-ID aus URL lesen
   --------------------------------------------------------- */

/**
 * Liest beispielsweise aus
 *
 * rezept.html?id=gericht3
 *
 * die ID "gericht3".
 *
 * @returns {string|null}
 */
function getRezeptIdFromUrl() {

	const params =
		new URLSearchParams(
			window.location.search
		);


	return params.get(
		"id"
	);
}


/* ---------------------------------------------------------
   22. Rezept-Metadaten darstellen
   --------------------------------------------------------- */

function renderRezeptMeta(
	container,
	gericht
) {

	const metaItems =
		[];


	if (
		gericht.portionen !== undefined &&
		gericht.portionen !== null
	) {

		metaItems.push(
			`${gericht.portionen} Portionen`
		);
	}


	if (
		gericht.zubereitungszeit !== undefined &&
		gericht.zubereitungszeit !== null
	) {

		metaItems.push(
			`${gericht.zubereitungszeit} Minuten`
		);
	}


	if (
		metaItems.length === 0
	) {

		return;
	}


	const meta =
		document.createElement(
			"p"
		);


	meta.className =
		"rezept-meta";


	meta.textContent =
		metaItems.join(
			" · "
		);


	container.appendChild(
		meta
	);
}


/* ---------------------------------------------------------
   23. Rezept-Zutaten darstellen
   --------------------------------------------------------- */

function renderRezeptZutaten(
	container,
	gericht
) {

	const heading =
		document.createElement(
			"h2"
		);

	heading.textContent =
		"Zutaten";


	container.appendChild(
		heading
	);


	const list =
		document.createElement(
			"ul"
		);

	list.className =
		"rezept-zutaten";


	if (
		gericht.zutaten.length === 0
	) {

		const li =
			document.createElement(
				"li"
			);

		li.textContent =
			"Keine Zutaten hinterlegt.";


		list.appendChild(
			li
		);

		container.appendChild(
			list
		);

		return;
	}


	gericht.zutaten.forEach(
		zutat => {

			if (
				!zutat ||
				!zutat.name
			) {

				return;
			}


			const li =
				document.createElement(
					"li"
				);


			const menge =
				Number(
					zutat.menge
				);


			const einheit =
				zutat.einheit
					? ` ${zutat.einheit}`
					: "";


			if (
				Number.isFinite(
					menge
				)
			) {

				li.textContent =
					`${formatMenge(menge)}${einheit} ${zutat.name}`;

			} else {

				li.textContent =
					zutat.name;
			}


			list.appendChild(
				li
			);
		}
	);


	container.appendChild(
		list
	);
}


/* ---------------------------------------------------------
   24. Zubereitung darstellen
   --------------------------------------------------------- */

function renderZubereitung(
	container,
	gericht
) {

	const heading =
		document.createElement(
			"h2"
		);

	heading.textContent =
		"Zubereitung";


	container.appendChild(
		heading
	);


	if (
		!Array.isArray(
			gericht.zubereitung
		) ||
		gericht.zubereitung.length === 0
	) {

		const message =
			document.createElement(
				"p"
			);

		message.textContent =
			"Keine Zubereitung hinterlegt.";


		container.appendChild(
			message
		);

		return;
	}


	const list =
		document.createElement(
			"ol"
		);


	list.className =
		"rezept-zubereitung";


	gericht.zubereitung.forEach(
		schritt => {

			if (
				typeof schritt !==
					"string" ||
				schritt.trim() === ""
			) {

				return;
			}


			const li =
				document.createElement(
					"li"
				);


			li.textContent =
				schritt;


			list.appendChild(
				li
			);
		}
	);


	container.appendChild(
		list
	);
}


/* ---------------------------------------------------------
   25. Einzelnes Rezept darstellen
   --------------------------------------------------------- */

function renderRezept(
	rezeptDetails,
	gericht
) {

	rezeptDetails.innerHTML =
		"";


	document.title =
		`${gericht.name} – Rezept`;


	const title =
		document.createElement(
			"h1"
		);

	title.textContent =
		gericht.name;


	rezeptDetails.appendChild(
		title
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
			"rezept-bild";

		image.decoding =
			"async";


		rezeptDetails.appendChild(
			image
		);


		loadOptionalImage(
			image,
			gericht.bild
		);
	}


	renderRezeptMeta(
		rezeptDetails,
		gericht
	);


	renderRezeptZutaten(
		rezeptDetails,
		gericht
	);


	renderZubereitung(
		rezeptDetails,
		gericht
	);
}


/* ---------------------------------------------------------
   26. Rezept-Fehler anzeigen
   --------------------------------------------------------- */

function renderRezeptError(
	rezeptDetails,
	message
) {

	rezeptDetails.innerHTML =
		"";


	const heading =
		document.createElement(
			"h1"
		);

	heading.textContent =
		"Rezept nicht gefunden";


	const text =
		document.createElement(
			"p"
		);

	text.textContent =
		message;


	rezeptDetails.appendChild(
		heading
	);

	rezeptDetails.appendChild(
		text
	);
}


/* ---------------------------------------------------------
   27. Einzelnes Rezept initialisieren
   --------------------------------------------------------- */

async function initRezept() {

	const rezeptDetails =
		document.getElementById(
			"rezeptDetails"
		);


	if (
		!rezeptDetails
	) {

		return;
	}


	const rezeptId =
		getRezeptIdFromUrl();


	if (
		!rezeptId
	) {

		renderRezeptError(
			rezeptDetails,
			"Es wurde kein Rezept ausgewählt."
		);

		return;
	}


	await loadGerichte();


	const gericht =
		gerichte.get(
			rezeptId
		);


	if (
		!gericht
	) {

		renderRezeptError(
			rezeptDetails,
			`Für die ID "${rezeptId}" wurde kein Rezept gefunden.`
		);

		return;
	}


	renderRezept(
		rezeptDetails,
		gericht
	);
}


/* =========================================================
   ANWENDUNG INITIALISIEREN
   ========================================================= */


/* ---------------------------------------------------------
   28. Seite erkennen
   --------------------------------------------------------- */

/**
 * Erkennt anhand vorhandener HTML-Elemente automatisch,
 * welche Seite geöffnet wurde.
 */
async function init() {
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
}


/* ---------------------------------------------------------
   29. Start
   --------------------------------------------------------- */

document.addEventListener(
	"DOMContentLoaded",
	init
);
