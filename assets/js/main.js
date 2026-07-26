/* =========================================================
   Einkaufsliste
   Main JavaScript
   ========================================================= */


/* ---------------------------------------------------------
   1. Konfiguration
   --------------------------------------------------------- */

const GERICHTE_MANIFEST = "data/gerichte/manifest.json";
const GERICHTE_PFAD = "data/gerichte";

const STORAGE_KEY = "ausgewaehlteGerichte";


/* ---------------------------------------------------------
   2. Marktdaten
   --------------------------------------------------------- */

/*
 * Die Zutaten werden über ihre technische ID mit den
 * Zutaten aus den Gericht-JSON-Dateien verknüpft.
 */
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
   3. Zustand
   --------------------------------------------------------- */

const gerichte = new Map();

let currentMap = "none";


/* ---------------------------------------------------------
   4. DOM-Elemente
   --------------------------------------------------------- */

const controls = document.getElementById("controls");

const zutatenListe =
    document.getElementById("zutatenListe");

const mapContainer =
    document.getElementById("map-container");

const mapImage =
    document.getElementById("mapImage");

const markersDiv =
    document.getElementById("markers");

const popup =
    document.getElementById("popup");

const resetButton =
    document.getElementById("resetBtn");

const overlay =
    document.getElementById("iconOverlay");

const overlayImg =
    document.getElementById("iconOverlayImg");

const marktAuswahl =
    document.getElementById("marktAuswahl");


/* ---------------------------------------------------------
   5. Gerichte laden
   --------------------------------------------------------- */

/**
 * Lädt das Gerichte-Manifest und anschließend alle darin
 * aufgeführten Gericht-Dateien.
 *
 * Fehlende oder fehlerhafte Dateien werden übersprungen,
 * ohne das Laden der übrigen Gerichte abzubrechen.
 */
async function loadGerichte() {
	const response =
		await fetch(GERICHTE_MANIFEST);


	if (!response.ok) {
		throw new Error(
			`Gerichte-Manifest konnte nicht geladen werden: ${response.status}`
		);
	}


	const manifest =
		await response.json();


	if (!Array.isArray(manifest.gerichte)) {
		throw new Error(
			"Das Gerichte-Manifest enthält keine gültige Gerichte-Liste."
		);
	}


	for (const datei of manifest.gerichte) {

		try {

			const response =
				await fetch(
					`${GERICHTE_PFAD}/${datei}`
				);


			/*
			 * Fehlende oder anderweitig nicht erreichbare
			 * Gericht-Dateien überspringen.
			 */
			if (!response.ok) {

				console.warn(
					`Gericht "${datei}" wurde übersprungen: HTTP ${response.status}`
				);

				continue;
			}


			const gericht =
				await response.json();


			/*
			 * Grundlegende Struktur prüfen.
			 */
			if (
				!gericht.id ||
				!gericht.name ||
				!Array.isArray(gericht.zutaten)
			) {

				console.warn(
					`Gericht "${datei}" besitzt keine gültige Struktur und wurde übersprungen.`,
					gericht
				);

				continue;
			}


			/*
			 * Doppelte IDs verhindern.
			 */
			if (gerichte.has(gericht.id)) {

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

			/*
			 * Beispielsweise ungültiges JSON oder andere
			 * Probleme beim Laden der Datei.
			 */
			console.warn(
				`Gericht "${datei}" konnte nicht verarbeitet werden und wurde übersprungen.`,
				error
			);
		}
	}
}

/* ---------------------------------------------------------
   6. Gerichte darstellen
   --------------------------------------------------------- */

/**
 * Erstellt die Gericht-Auswahl dynamisch aus den
 * geladenen JSON-Dateien.
 */
function renderGerichte() {
    controls.innerHTML = "";


    gerichte.forEach(gericht => {

        const container =
            document.createElement("div");

        container.className = "gericht";


        const label =
            document.createElement("label");


        const checkbox =
            document.createElement("input");

        checkbox.type = "checkbox";
        checkbox.value = gericht.id;
        checkbox.id = `gericht-${gericht.id}`;


        const name =
            document.createTextNode(
                ` ${gericht.name}`
            );


        label.appendChild(checkbox);
        label.appendChild(name);


        container.appendChild(label);


        /*
         * Bild nur erstellen, wenn im JSON auch
         * tatsächlich eines angegeben wurde.
         */
        if (gericht.bild) {

            const bild =
                document.createElement("img");

            bild.src = gericht.bild;
            bild.alt = gericht.name;
            bild.className = "icon";
            bild.loading = "lazy";

            container.appendChild(bild);
        }


        controls.appendChild(container);
    });
}


/* ---------------------------------------------------------
   7. Ausgewählte Gerichte
   --------------------------------------------------------- */

/**
 * Gibt alle momentan ausgewählten Gerichte zurück.
 *
 * @returns {Array<Object>}
 */
function getSelectedGerichte() {
    const selected = [];


    controls
        .querySelectorAll(
            'input[type="checkbox"]:checked'
        )
        .forEach(checkbox => {

            const gericht =
                gerichte.get(
                    checkbox.value
                );


            if (gericht) {
                selected.push(gericht);
            }
        });


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
 * @returns {Array<Object>}
 */
function createShoppingList() {
    const einkaufsliste =
        new Map();


    const selectedGerichte =
        getSelectedGerichte();


    selectedGerichte.forEach(gericht => {

        gericht.zutaten.forEach(zutat => {

            const menge =
                Number(zutat.menge);


            if (!Number.isFinite(menge)) {
                console.warn(
                    `Ungültige Menge bei "${zutat.name}" in "${gericht.name}".`
                );

                return;
            }


            /*
             * Einheit ist Teil des Schlüssels.
             *
             * Dadurch werden beispielsweise
             *
             * 2 Stk Tomaten
             *
             * nicht versehentlich mit
             *
             * 500 g Tomaten
             *
             * verrechnet.
             */
            const key =
                `${zutat.id}::${zutat.einheit}`;


            if (!einkaufsliste.has(key)) {

                einkaufsliste.set(
                    key,
                    {
                        id: zutat.id,
                        name: zutat.name,
                        menge: 0,
                        einheit: zutat.einheit
                    }
                );
            }


            einkaufsliste.get(key).menge += menge;
        });
    });


    return Array.from(
        einkaufsliste.values()
    );
}


/* ---------------------------------------------------------
   9. Mengen formatieren
   --------------------------------------------------------- */

/**
 * Formatiert Zahlen für die deutsche Darstellung.
 *
 * @param {number} menge
 * @returns {string}
 */
function formatMenge(menge) {
    return new Intl.NumberFormat(
        "de-DE",
        {
            maximumFractionDigits: 2
        }
    ).format(menge);
}


/* ---------------------------------------------------------
   10. Einkaufsliste darstellen
   --------------------------------------------------------- */

/**
 * Zeigt die berechnete Einkaufsliste an.
 *
 * @param {Array<Object>} einkaufsliste
 */
function renderShoppingList(
    einkaufsliste
) {
    zutatenListe.innerHTML = "";


    if (einkaufsliste.length === 0) {

        const li =
            document.createElement("li");

        const em =
            document.createElement("em");

        em.textContent =
            "Keine Zutaten ausgewählt";


        li.appendChild(em);
        zutatenListe.appendChild(li);

        return;
    }


    einkaufsliste.forEach(zutat => {

        const li =
            document.createElement("li");


        li.textContent =
            `${formatMenge(zutat.menge)} ${zutat.einheit} ${zutat.name}`;


        zutatenListe.appendChild(li);
    });
}


/* ---------------------------------------------------------
   11. Karte darstellen
   --------------------------------------------------------- */

/**
 * Aktualisiert die Marktkarte.
 *
 * @param {Array<Object>} einkaufsliste
 */
function renderMap(
    einkaufsliste
) {
    markersDiv.innerHTML = "";


    if (currentMap === "none") {

        mapContainer.classList.add(
            "hidden"
        );

        return;
    }


    const map =
        maps[currentMap];


    if (!map) {
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

    mapImage.src = map.image;


    renderMarkers(
        einkaufsliste,
        map
    );
}


/* ---------------------------------------------------------
   12. Kartenmarker
   --------------------------------------------------------- */

/**
 * Erstellt die Marker für die Zutaten auf der Karte.
 *
 * Zutaten mit identischer Position werden zu einem Marker
 * zusammengefasst.
 *
 * @param {Array<Object>} einkaufsliste
 * @param {Object} map
 */
function renderMarkers(
    einkaufsliste,
    map
) {
    const positions = {};


    einkaufsliste.forEach(zutat => {

        const position =
            map.zutaten[zutat.id];


        /*
         * Zutat ist für diesen Markt nicht auf
         * der Karte hinterlegt.
         */
        if (!position) {
            return;
        }


        const positionKey =
            `${position.top}-${position.left}`;


        if (!positions[positionKey]) {

            positions[positionKey] = {
                top: position.top,
                left: position.left,
                items: []
            };
        }


        positions[positionKey].items.push(
            zutat
        );
    });


    Object.values(
        positions
    ).forEach(position => {

        const marker =
            document.createElement("button");

        marker.type = "button";
        marker.className = "marker";

        marker.style.top =
            `${position.top}%`;

        marker.style.left =
            `${position.left}%`;


        /*
         * Die Zahl zeigt jetzt die Anzahl verschiedener
         * Zutaten an dieser Position.
         *
         * Die Mengen können nicht mehr sinnvoll addiert
         * werden, weil beispielsweise Gramm und Stück
         * unterschiedliche Einheiten sind.
         */
        marker.textContent =
            position.items.length;


        marker.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                showPopup(
                    marker,
                    position.items
                );
            }
        );


        markersDiv.appendChild(
            marker
        );
    });
}


/* ---------------------------------------------------------
   13. Popup
   --------------------------------------------------------- */

/**
 * Zeigt die Zutaten eines Kartenmarkers an.
 *
 * @param {HTMLElement} marker
 * @param {Array<Object>} items
 */
function showPopup(
    marker,
    items
) {
    const text =
        items
            .map(
                item =>
                    `${formatMenge(item.menge)} ${item.einheit} ${item.name}`
            )
            .join("\n");


    popup.textContent = text;

    popup.style.display =
        "block";

    popup.style.top =
        `${marker.offsetTop - 30}px`;

    popup.style.left =
        `${marker.offsetLeft + 25}px`;
}


/**
 * Schließt das Karten-Popup.
 */
function hidePopup() {
    popup.style.display =
        "none";
}


/* ---------------------------------------------------------
   14. Bild-Overlay
   --------------------------------------------------------- */

/**
 * Öffnet das große Rezeptbild.
 *
 * @param {HTMLImageElement} image
 */
function openOverlay(image) {
    overlayImg.src =
        image.src;

    overlayImg.alt =
        image.alt;

    overlay.style.display =
        "flex";
}


/**
 * Schließt das Rezeptbild.
 */
function closeOverlay() {
    overlay.style.display =
        "none";

    overlayImg.src = "";
}


/* ---------------------------------------------------------
   15. LocalStorage
   --------------------------------------------------------- */

/**
 * Speichert die IDs der momentan ausgewählten Gerichte.
 */
function saveState() {
    const selectedIds =
        getSelectedGerichte()
            .map(
                gericht => gericht.id
            );


    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(selectedIds)
    );
}


/**
 * Stellt die zuvor gespeicherte Auswahl wieder her.
 */
function loadState() {
    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!saved) {
            return;
        }


        const selectedIds =
            JSON.parse(saved);


        if (!Array.isArray(selectedIds)) {
            return;
        }


        controls
            .querySelectorAll(
                'input[type="checkbox"]'
            )
            .forEach(checkbox => {

                checkbox.checked =
                    selectedIds.includes(
                        checkbox.value
                    );
            });

    } catch (error) {

        console.error(
            "Gespeicherte Gerichte konnten nicht geladen werden:",
            error
        );
    }
}


/* ---------------------------------------------------------
   16. Ansicht aktualisieren
   --------------------------------------------------------- */

/**
 * Berechnet die Einkaufsliste neu und aktualisiert
 * Einkaufsliste und Karte.
 */
function updateView() {
    const einkaufsliste =
        createShoppingList();


    renderShoppingList(
        einkaufsliste
    );


    renderMap(
        einkaufsliste
    );
}


/* ---------------------------------------------------------
   17. Reset
   --------------------------------------------------------- */

/**
 * Entfernt die komplette aktuelle Auswahl.
 */
function resetSelection() {
    controls
        .querySelectorAll(
            'input[type="checkbox"]'
        )
        .forEach(checkbox => {

            checkbox.checked =
                false;
        });


    localStorage.removeItem(
        STORAGE_KEY
    );


    hidePopup();

    updateView();
}


/* ---------------------------------------------------------
   18. Events registrieren
   --------------------------------------------------------- */

function registerEventHandlers() {

    /*
     * Event Delegation für alle Gerichte.
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


            saveState();
            updateView();
        }
    );


    /*
     * Rezeptbilder ebenfalls über Event Delegation.
     */
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

            openOverlay(image);
        }
    );


    /*
     * Marktauswahl.
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


            hidePopup();
            updateView();
        }
    );


    /*
     * Reset.
     */
    resetButton.addEventListener(
        "click",
        resetSelection
    );


    /*
     * Overlay schließen.
     */
    overlay.addEventListener(
        "click",
        closeOverlay
    );


    /*
     * Escape schließt ebenfalls das Overlay.
     */
    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {
                closeOverlay();
                hidePopup();
            }
        }
    );


    /*
     * Klick außerhalb eines Markers schließt
     * das Karten-Popup.
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


            hidePopup();
        }
    );
}


/* ---------------------------------------------------------
   19. Initialisierung
   --------------------------------------------------------- */

async function init() {
    try {

        registerEventHandlers();

        await loadGerichte();

        renderGerichte();

        loadState();

        updateView();

    } catch (error) {

        console.error(
            "Die Anwendung konnte nicht initialisiert werden:",
            error
        );


        controls.innerHTML = "";


        const message =
            document.createElement("p");

        message.textContent =
            "Die Gerichte konnten nicht geladen werden.";


        controls.appendChild(
            message
        );
    }
}


/* ---------------------------------------------------------
   20. Start
   --------------------------------------------------------- */

document.addEventListener(
    "DOMContentLoaded",
    init
);
