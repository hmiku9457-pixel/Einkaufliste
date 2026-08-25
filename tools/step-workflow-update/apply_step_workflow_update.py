#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "index.html"
RECIPE_OVERVIEW = ROOT / "rezept_uebersicht.html"
MAIN_JS = ROOT / "assets" / "js" / "main.js"
MAIN_CSS = ROOT / "assets" / "css" / "main.css"

MARKER = "STEP-WORKFLOW-UPDATE-2026-08-25"


def read(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Pflichtdatei fehlt: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> bool:
    old = path.read_text(encoding="utf-8") if path.exists() else None
    if old == content:
        return False
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
                return text[:match.start()] + replacement.rstrip() + text[i + 1:]

        i += 1

    raise RuntimeError(f"Schließende Klammer von {name} nicht gefunden.")


INDEX_HEADER = r'''<header class="site-header">
			<div class="page-container header-content">
				<div class="header-heading">
					<p class="eyebrow">Essensplanung</p>
					<h1>Einkaufsliste</h1>
					<p class="header-description">
						Wähle zuerst deine Gerichte aus und erledige danach den Einkauf Schritt für Schritt.
					</p>
				</div>

				<nav class="header-actions" aria-label="Seitennavigation">
					<a
						href="rezept_uebersicht.html"
						id="rezeptBtn"
						class="button button-secondary"
					>
						Rezepte
					</a>

					<button
						type="button"
						id="backToSelectionBtn"
						class="button button-danger"
						hidden
					>
						Zurück zur Gerichtsauswahl
					</button>
				</nav>
			</div>
		</header>'''


INDEX_MAIN = r'''<main id="main-content" class="page-container">
			<section
				id="selectionStep"
				class="purchase-step"
				aria-labelledby="gerichte-heading"
			>
				<div class="panel gerichte-panel step-panel">
					<div class="panel-header">
						<div>
							<p class="panel-kicker">Schritt 1</p>
							<h2 id="gerichte-heading">Gerichte auswählen</h2>
						</div>
					</div>

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

					<div id="controls" class="gerichte-liste"></div>

					<div class="step-actions">
						<button
							type="button"
							id="confirmSelectionBtn"
							class="button button-secondary"
							disabled
						>
							Weiter zur Einkaufsliste
						</button>
					</div>
				</div>
			</section>

			<section
				id="shoppingStep"
				class="purchase-step"
				aria-labelledby="zutaten-heading"
				hidden
			>
				<div id="listen-container" class="shopping-step-grid">
					<section class="panel zutaten-panel" aria-labelledby="zutaten-heading">
						<div class="panel-header">
							<div>
								<p class="panel-kicker">Schritt 2</p>
								<h2 id="zutaten-heading">Zutaten einkaufen</h2>
							</div>
						</div>

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

							<label class="toggle-control toggle-control-locked">
								<input
									type="checkbox"
									id="groupShoppingListToggle"
									disabled
								>
								<span>Nach Gericht gruppieren</span>
							</label>

							<p id="groupToggleHint" class="toggle-hint">
								Diese Ansicht wird verfügbar, sobald alles eingekauft ist.
							</p>

							<p
								id="shoppingProgress"
								class="shopping-progress"
								aria-live="polite"
							></p>
						</div>

						<div id="zutatenListe" aria-live="polite">
							<p class="empty-state"><em>Keine Zutaten ausgewählt</em></p>
						</div>
					</section>

					<section class="panel markt-panel" aria-labelledby="markt-heading">
						<div class="panel-header">
							<div>
								<p class="panel-kicker">Optional</p>
								<h2 id="markt-heading">Markt auswählen</h2>
							</div>
						</div>

						<fieldset id="marktAuswahl">
							<legend class="visually-hidden">Karte eines Marktes auswählen</legend>

							<label class="markt-option">
								<input type="radio" name="markt" value="none" checked>
								<span>Keine Karte</span>
							</label>

							<label class="markt-option">
								<input type="radio" name="markt" value="edeka">
								<span>Edeka</span>
							</label>

							<label class="markt-option">
								<input type="radio" name="markt" value="lidl">
								<span>Lidl</span>
							</label>
						</fieldset>
					</section>
				</div>

				<section
					id="map-container"
					class="map-section hidden"
					aria-labelledby="map-heading"
				>
					<div class="map-header">
						<p class="panel-kicker">Orientierung</p>
						<h2 id="map-heading">Marktkarte</h2>
					</div>

					<div class="map-stage">
						<img
							id="mapImage"
							src=""
							alt="Karte des ausgewählten Marktes"
						>
						<div id="markers" aria-label="Positionen der ausgewählten Zutaten"></div>
						<div id="popup" class="popup" role="status" aria-live="polite"></div>
					</div>
				</section>
			</section>
		</main>'''


RESET_MODAL = r'''
		<dialog
			id="resetShoppingModal"
			class="confirmation-modal"
			aria-labelledby="resetShoppingModalTitle"
		>
			<form method="dialog" class="confirmation-modal-card">
				<p class="panel-kicker">Einkauf zurücksetzen</p>
				<h2 id="resetShoppingModalTitle">Zurück zur Gerichtsauswahl?</h2>
				<p>
					Die ausgewählten Gerichte und alle bereits abgehakten Zutaten werden gelöscht.
				</p>

				<div class="confirmation-modal-actions">
					<button type="button" id="cancelResetShoppingBtn" class="button">
						Abbrechen
					</button>
					<button type="button" id="confirmResetShoppingBtn" class="button button-danger">
						Ja, Einkauf zurücksetzen
					</button>
				</div>
			</form>
		</dialog>
'''


RECIPE_HEADER = r'''<header class="site-header">
			<div class="page-container header-content">
				<div class="header-heading">
					<p class="eyebrow">Essensplanung</p>
					<h1>Rezepte</h1>
					<p class="header-description">
						Durchsuche die Rezeptsammlung und öffne ein Gericht für die Zubereitung.
					</p>
				</div>

				<nav class="header-actions" aria-label="Seitennavigation">
					<a href="index.html" class="button button-secondary">
						Einkaufsliste
					</a>

					<button
						type="button"
						class="button button-disabled"
						disabled
						title="Diese Funktion ist aktuell deaktiviert."
					>
						Rezept einreichen
					</button>
				</nav>
			</div>
		</header>'''


RECIPE_MAIN = r'''<main id="main-content" class="page-container">
			<section aria-labelledby="rezept-heading">
				<div class="panel-header recipe-overview-heading">
					<div>
						<p class="panel-kicker">Kochbuch</p>
						<h2 id="rezept-heading">Rezeptübersicht</h2>
					</div>
				</div>

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

				<div id="rezeptListe"></div>
			</section>
		</main>'''


STEP_HELPERS = r'''
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
'''


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
}'''


CSS_BLOCK = r'''
/* =========================================================
   STEP-WORKFLOW-UPDATE-2026-08-25
   ========================================================= */

.purchase-step[hidden],
#backToSelectionBtn[hidden] {
	display: none !important;
}

.step-panel {
	max-width: 980px;
	margin: 0 auto;
}

.step-actions {
	display: flex;
	justify-content: flex-end;
	margin-top: 22px;
	padding-top: 18px;
	border-top: 1px solid var(--color-border);
}

.shopping-step-grid {
	grid-template-columns:
		minmax(340px, 1.5fr)
		minmax(260px, 0.8fr) !important;
}

.toggle-control-locked {
	opacity: 0.58;
	cursor: not-allowed;
}

.toggle-control-locked input,
.toggle-control input:disabled {
	cursor: not-allowed;
}

.toggle-hint {
	margin: 7px 0 0;
	color: var(--color-text-muted);
	font-size: 0.76rem;
	line-height: 1.4;
}

.button:disabled,
.button-disabled,
.button-disabled:hover {
	color: #73777d !important;
	background: #e5e7eb !important;
	border-color: #d1d5db !important;
	box-shadow: none !important;
	transform: none !important;
	cursor: not-allowed !important;
	opacity: 0.75;
}

.confirmation-modal {
	width: min(92vw, 560px);
	padding: 0;
	color: var(--color-text);
	background: transparent;
	border: 0;
}

.confirmation-modal::backdrop {
	background: rgba(0, 0, 0, 0.55);
	backdrop-filter: blur(2px);
}

.confirmation-modal-card {
	padding: 24px;
	background: var(--color-surface);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-medium);
	box-shadow: var(--shadow-medium);
}

.confirmation-modal-card h2 {
	margin-top: 0;
	margin-bottom: 10px;
}

.confirmation-modal-card > p:not(.panel-kicker) {
	margin-top: 0;
	color: var(--color-text-muted);
}

.confirmation-modal-actions {
	display: flex;
	justify-content: flex-end;
	flex-wrap: wrap;
	gap: 10px;
	margin-top: 22px;
}

.recipe-overview-heading {
	margin-bottom: 14px;
}

@media (max-width: 800px) {
	.shopping-step-grid {
		grid-template-columns: 1fr !important;
	}

	.step-actions > *,
	.confirmation-modal-actions > * {
		width: 100%;
	}
}
'''


def replace_element(text: str, tag: str, pattern: str, replacement: str) -> str:
    regex = re.compile(pattern, re.S | re.I)
    match = regex.search(text)
    if not match:
        raise RuntimeError(f"{tag} konnte nicht gefunden werden.")
    return text[:match.start()] + replacement + text[match.end():]


def patch_index(text: str) -> str:
    if 'id="gerichtSuche"' not in text or 'id="groupShoppingListToggle"' not in text:
        raise RuntimeError(
            "Das vorherige UX-Update ist auf index.html noch nicht vorhanden. "
            "Bitte zuerst das Paket 'rezept-ux-update-2026-08-25-final' anwenden."
        )

    text = replace_element(
        text,
        "Header",
        r'<header\b[^>]*class="[^"]*site-header[^"]*"[^>]*>.*?</header>',
        INDEX_HEADER,
    )

    text = replace_element(
        text,
        "Hauptinhalt",
        r'<main\b(?=[^>]*\bid="main-content")[^>]*>.*?</main>',
        INDEX_MAIN,
    )

    if 'id="resetShoppingModal"' not in text:
        overlay_marker = re.search(
            r'\s*<!--\s*=+\s*BILD-OVERLAY\s*=+\s*-->',
            text,
            re.I,
        )
        if overlay_marker:
            text = text[:overlay_marker.start()] + RESET_MODAL + text[overlay_marker.start():]
        else:
            script_marker = text.rfind('<script src="assets/js/main.js"></script>')
            if script_marker < 0:
                raise RuntimeError("index.html: Einfügepunkt für das Bestätigungsmodal fehlt.")
            text = text[:script_marker] + RESET_MODAL + "\n\t\t" + text[script_marker:]

    return text


def patch_recipe_overview(text: str) -> str:
    text = replace_element(
        text,
        "Rezept-Header",
        r'<header\b[^>]*>.*?</header>',
        RECIPE_HEADER,
    )

    text = replace_element(
        text,
        "Rezept-Hauptinhalt",
        r'<main\b[^>]*>.*?</main>',
        RECIPE_MAIN,
    )

    return text


def patch_main_js(text: str) -> str:
    if "const SHOPPING_CHECKED_KEY" not in text:
        raise RuntimeError(
            "Das vorherige UX-Update ist in assets/js/main.js noch nicht vorhanden."
        )

    if "const SHOPPING_STARTED_KEY" not in text:
        anchor = re.search(
            r'const\s+GROUPED_VIEW_KEY\s*=\s*"einkaufslisteNachGericht"\s*;',
            text,
        )
        if not anchor:
            raise RuntimeError("main.js: GROUPED_VIEW_KEY konnte nicht gefunden werden.")
        text = (
            text[:anchor.end()]
            + '\n\nconst SHOPPING_STARTED_KEY =\n\t"einkaufGestartet";'
            + text[anchor.end():]
        )

    if MARKER not in text:
        marker = re.search(r'(?m)^async\s+function\s+initEinkaufsliste\s*\(', text)
        if not marker:
            raise RuntimeError("main.js: initEinkaufsliste konnte nicht gefunden werden.")
        text = text[:marker.start()] + STEP_HELPERS + "\n\n" + text[marker.start():]

    text = replace_js_function(text, "renderShoppingList", RENDER_SHOPPING)
    text = replace_js_function(text, "resetSelection", RESET_SELECTION)
    text = replace_js_function(text, "initEinkaufsliste", INIT_SHOPPING)

    return text


def patch_css(text: str) -> str:
    if MARKER in text:
        return text
    return text.rstrip() + "\n\n" + CSS_BLOCK.strip() + "\n"


def main() -> None:
    changed = False

    changed |= write(INDEX, patch_index(read(INDEX)))
    changed |= write(RECIPE_OVERVIEW, patch_recipe_overview(read(RECIPE_OVERVIEW)))
    changed |= write(MAIN_JS, patch_main_js(read(MAIN_JS)))
    changed |= write(MAIN_CSS, patch_css(read(MAIN_CSS)))

    if changed:
        print()
        print("[OK] Zweistufiger Einkaufsworkflow erfolgreich eingebaut.")
        print("     - Schritt 1: Gerichtsauswahl + Weiter-Bestätigung")
        print("     - Schritt 2: Einkaufsliste + optionale Marktkarte")
        print("     - Gruppierung erst nach vollständig erledigtem Einkauf")
        print("     - Zurück-Button mit Bestätigungsmodal")
        print("     - Rezeptübersicht mit identischem Header-Stil")
        print("     - 'Rezept einreichen' sichtbar, aber deaktiviert")
    else:
        print("[OK] Keine Änderungen notwendig – Update ist bereits vorhanden.")


if __name__ == "__main__":
    main()
