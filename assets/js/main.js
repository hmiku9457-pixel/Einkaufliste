/* =========================================================
   Einkaufsliste & Rezepte
   Main JavaScript
   ========================================================= */


/* ---------------------------------------------------------
   1. Konfiguration
   --------------------------------------------------------- */

const GERICHTE_MANIFEST =
	"data/gerichte/manifest.json";

const GERICHTE_PFAD =
	"data/gerichte";

const STORAGE_KEY =
	"ausgewaehlteGerichte";


/* ---------------------------------------------------------
   2. Marktdaten
   --------------------------------------------------------- */

const maps = {

	edeka: {
		image: "date/laeden/karte-edeka.png",

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
		image: "date/laeden/karte-lidl.png",

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

let currentMap =
	"none";


/* =========================================================
   GEMEINSAME FUNKTIONEN
   ========================================================= */


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


/* =========================================================
   EINKAUFSLISTE
   ========================================================= */


/* ---------------------------------------------------------
   6. Gerichte für Einkaufsliste darstellen
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


			const text =
				document.createTextNode(
					` ${gericht.name}`
				);


			label.appendChild(
				checkbox
			);

			label.appendChild(
				text
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

				image.src =
					gericht.bild;

				image.alt =
					gericht.name;

				image.className =
					"icon";

				image.loading =
					"lazy";


				container.appendChild(
					image
				);
			}


			controls.appendChild(
				container
			);
		}
	);
}


/* ---------------------------------------------------------
   7. Ausgewählte Gerichte
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
   8. Einkaufsliste berechnen
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
   9. Einkaufsliste darstellen
   --------------------------------------------------------- */

/**
 * Rendert die Einkaufsliste.
 *
 * @param {HTMLElement} zutatenListe
 * @param {Array<Object>} einkaufsliste
 */
function renderShoppingList(
	zutatenListe,
	einkaufsliste
) {

	zutatenListe.innerHTML =
		"";


	if (
		einkaufsliste.length === 0
	) {

		const li =
			document.createElement(
				"li"
			);


		const em =
			document.createElement(
				"em"
			);

		em.textContent =
			"Keine Zutaten ausgewählt";


		li.appendChild(
			em
		);

		zutatenListe.appendChild(
			li
		);

		return;
	}


	einkaufsliste.forEach(
		zutat => {

			const li =
				document.createElement(
					"li"
				);


			const einheit =
				zutat.einheit
					? ` ${zutat.einheit}`
					: "";


			li.textContent =
				`${formatMenge(zutat.menge)}${einheit} ${zutat.name}`;


			zutatenListe.appendChild(
				li
			);
		}
	);
}


/* ---------------------------------------------------------
   10. Karte darstellen
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
   11. Kartenmarker
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
   12. Karten-Popup
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
 * @param {HTMLElement} popup
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
   13. Bild-Overlay
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
 * @param {HTMLElement} overlay
 * @param {HTMLImageElement} overlayImg
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
   14. LocalStorage
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
   15. Einkaufsliste aktualisieren
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


	renderShoppingList(
		zutatenListe,
		einkaufsliste
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
   16. Einkaufsliste zurücksetzen
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
}


/* ---------------------------------------------------------
   17. Einkaufsliste initialisieren
   --------------------------------------------------------- */

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


	const checkedMarket =
		marktAuswahl.querySelector(
			'input[name="markt"]:checked'
		);


	currentMap =
		checkedMarket?.value ??
		"none";


	/*
	 * Änderung der Gericht-Auswahl.
	 */
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


	/*
	 * Klick auf Rezeptbild.
	 */
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


	/*
	 * Markt wechseln.
	 */
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


	/*
	 * Auswahl zurücksetzen.
	 */
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


	/*
	 * Bild-Overlay schließen.
	 */
	overlay.addEventListener(
		"click",
		() => {

			closeOverlay(
				overlay,
				overlayImg
			);
		}
	);


	/*
	 * Escape schließt Overlay und Popup.
	 */
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


	/*
	 * Klick außerhalb eines Markers schließt Popup.
	 */
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


	updateEinkaufslisteView(
		controls,
		zutatenListe,
		mapContainer,
		mapImage,
		markersDiv,
		popup
	);
}


/* =========================================================
   REZEPTÜBERSICHT
   ========================================================= */


/* ---------------------------------------------------------
   18. Rezeptübersicht darstellen
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


			if (
				gericht.bild
			) {

				card.style.backgroundImage =
					`url("${gericht.bild}")`;
			}


			const title =
				document.createElement(
					"span"
				);


			title.className =
				"rezept-card-title";


			title.textContent =
				gericht.name;


			card.appendChild(
				title
			);


			rezeptListe.appendChild(
				card
			);
		}
	);
}


/* ---------------------------------------------------------
   19. Rezeptübersicht initialisieren
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


	await loadGerichte();


	renderRezeptUebersicht(
		rezeptListe
	);
}


/* =========================================================
   EINZELNES REZEPT
   ========================================================= */


/* ---------------------------------------------------------
   20. Rezept-ID aus URL lesen
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
   21. Rezept-Metadaten darstellen
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
   22. Rezept-Zutaten darstellen
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
   23. Zubereitung darstellen
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
				"string"
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
   24. Einzelnes Rezept darstellen
   --------------------------------------------------------- */

function renderRezept(
	rezeptDetails,
	gericht
) {

	rezeptDetails.innerHTML =
		"";


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

		image.src =
			gericht.bild;

		image.alt =
			gericht.name;

		image.className =
			"rezept-bild";


		rezeptDetails.appendChild(
			image
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
   25. Rezept-Fehler anzeigen
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
   26. Einzelnes Rezept initialisieren
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
   27. Seite erkennen
   --------------------------------------------------------- */

/**
 * Erkennt anhand vorhandener HTML-Elemente automatisch,
 * welche Seite geöffnet wurde.
 *
 * Dadurch benötigt die bestehende index.html keine
 * zusätzliche data-page-Angabe.
 */
async function init() {

	try {

		/*
		 * Einkaufsliste
		 */
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


		/*
		 * Rezeptübersicht
		 */
		if (
			document.getElementById(
				"rezeptListe"
			)
		) {

			await initRezeptUebersicht();

			return;
		}


		/*
		 * Einzelnes Rezept
		 */
		if (
			document.getElementById(
				"rezeptDetails"
			)
		) {

			await initRezept();

			return;
		}


		console.warn(
			"Für diese Seite wurde keine bekannte Ansicht gefunden."
		);

	} catch (
		error
	) {

		console.error(
			"Die Anwendung konnte nicht initialisiert werden:",
			error
		);


		const controls =
			document.getElementById(
				"controls"
			);


		if (
			controls
		) {

			controls.innerHTML =
				"";


			const message =
				document.createElement(
					"p"
				);

			message.textContent =
				"Die Gerichte konnten nicht geladen werden.";


			controls.appendChild(
				message
			);
		}


		const rezeptListe =
			document.getElementById(
				"rezeptListe"
			);


		if (
			rezeptListe
		) {

			rezeptListe.innerHTML =
				"";


			const message =
				document.createElement(
					"p"
				);

			message.textContent =
				"Die Rezepte konnten nicht geladen werden.";


			rezeptListe.appendChild(
				message
			);
		}


		const rezeptDetails =
			document.getElementById(
				"rezeptDetails"
			);


		if (
			rezeptDetails
		) {

			renderRezeptError(
				rezeptDetails,
				"Das Rezept konnte nicht geladen werden."
			);
		}
	}
}


/* ---------------------------------------------------------
   28. Start
   --------------------------------------------------------- */

document.addEventListener(
	"DOMContentLoaded",
	init
);
