/* ===================== Zutaten und Positionen ===================== */
const maps = {
    edeka: {
        image: "karte-edeka.png",
        zutaten: {
            Tomate: { name: "Tomate", top: 60, left: 65 },
            Käse:  { name: "Käse",    top: 35, left: 94 },
            Nudeln: { name: "Nudeln",  top: 34, left: 75 },
            Salat:  { name: "Salat",   top: 65, left: 55 },
			Hähnchenbrust:	{ name: "Hähnchenbrust", top: 19, left: 78 }
        }
    },
    lidl: {
        image: "karte-lidl.png",
        zutaten: {
            Tomate: { name: "Tomate", top: 30, left: 49 },
            Käse:  { name: "Käse",    top: 45, left: 20 },
            Nudeln: { name: "Nudeln",  top: 65, left: 45 },
            Salat:  { name: "Salat",   top: 20, left: 60 },
			Hähnchenbrust:	{ name: "Hähnchenbrust", top: 35, left: 60 }
        }
    }
};

/* ===================== Gerichte ===================== */
const gerichte = {
    gericht1: ["Tomate", "Nudeln"],
    gericht2: ["Tomate", "Käse"],
    gericht3: ["Hähnchenbrust", "Kartoffel festkochend 750g", "Brokkoli", "Tomate", "Tomate", "Zwiebel", "Zwiebel", "Knoblauchzehen", "Knoblauchzehen", "Creme Fraíche", "Tomatepesto 50g", "Hühnerbrühe"],
	gericht4: ["Hähnchenbrust", "Kartoffel festkochend 750g", "Salatmischung", "Knoblauchzehen", "Knoblauchzehen", "Buttermilch-Zitronen-Dressing 100ml", "Pflaumenkonfitüre 160g", "Sriracha Soße 8ml", "Sojasoße 20ml"],
    gericht5: ["Tomate", "Käse"],
    gericht6: ["Salat", "Tomate"]
};

/* ===================== ICON OVERLAY ===================== */
const overlay = document.getElementById("iconOverlay");
const overlayImg = document.getElementById("iconOverlayImg");

document.querySelectorAll(".icon").forEach(icon => {
    icon.addEventListener("click", e => {
        e.stopPropagation();
        overlayImg.src = icon.src;
        overlay.style.display = "flex";
    });
});

overlay.addEventListener("click", () => overlay.style.display = "none");



let currentMap = "none";

/* ===================== UPDATE ===================== */
function updateMap() {
    const zutatenListe = document.getElementById("zutatenListe");
    const markersDiv = document.getElementById("markers");
    const mapContainer = document.getElementById("map-container");

    zutatenListe.innerHTML = "";
    markersDiv.innerHTML = "";

    const counter = {};
	const positions = {}; // sammelt Zutaten pro Koordinate

    document.querySelectorAll("#controls input:checked").forEach(cb => {
        gerichte[cb.value].forEach(z => counter[z] = (counter[z] || 0) + 1);
    });

    if (Object.keys(counter).length === 0) {
        zutatenListe.innerHTML = "<li><em>Keine Zutaten ausgewählt</em></li>";
    } else {
        Object.keys(counter).forEach(key => {
            const name =
                currentMap !== "none"
                ? maps[currentMap].zutaten[key]?.name || key
                : key;

            const li = document.createElement("li");
            li.textContent = `${counter[key]}× ${name}`;
            zutatenListe.appendChild(li);
        });
    }

    if (currentMap === "none") {
        mapContainer.classList.add("hidden");
        return;
    }

    mapContainer.classList.remove("hidden");
    document.getElementById("mapImage").src = maps[currentMap].image;

    // Zutaten nach Position gruppieren
Object.keys(counter).forEach(key => {
    const z = maps[currentMap].zutaten[key];
    if (!z) return;

    const posKey = `${z.top}-${z.left}`;

    if (!positions[posKey]) {
        positions[posKey] = {
            top: z.top,
            left: z.left,
            items: []
        };
    }

    positions[posKey].items.push({
        name: z.name,
        amount: counter[key]
    });
});

// Für jede Position genau EIN Marker
Object.values(positions).forEach(pos => {
    const marker = document.createElement("div");
    marker.className = "marker";
    marker.style.top = pos.top + "%";
    marker.style.left = pos.left + "%";

    // Gesamtanzahl als Zahl im Marker
    const total = pos.items.reduce((sum, i) => sum + i.amount, 0);
    marker.innerText = total;

    marker.onclick = (e) => {
        e.stopPropagation();

        const text = pos.items
            .map(i => `${i.amount}× ${i.name}`)
            .join("\n");

        showPopup(marker, text);
    };

    markersDiv.appendChild(marker);
});
	
}

/* ===================== EVENTS ===================== */
document.querySelectorAll("#controls input").forEach(cb =>
    cb.addEventListener("change", updateMap)
);

document.querySelectorAll("input[name='markt']").forEach(rb =>
    rb.addEventListener("change", () => {
        currentMap = rb.value;
        updateMap();
    })
);

document.getElementById("resetBtn").addEventListener("click", () => {
    document.querySelectorAll("#controls input").forEach(cb => cb.checked = false);
    localStorage.removeItem("eingekaufteGerichte");
    updateMap();
});

updateMap();
function showPopup(marker, text) {
    const popup = document.getElementById("popup");
    popup.innerText = text;
    popup.style.display = "block";
    popup.style.top = (marker.offsetTop - 30) + "px";
    popup.style.left = (marker.offsetLeft + 25) + "px";
}

// Klick irgendwo → Popup schließen
document.addEventListener("click", () => {
    document.getElementById("popup").style.display = "none";
});

/* ===================== LOCAL STORAGE ===================== */
const STORAGE_KEY = "eingekaufteGerichte";

function saveState() {
    const state = {};
    document.querySelectorAll("#controls input").forEach(cb => {
        state[cb.id] = cb.checked;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

document.querySelectorAll("#controls input").forEach(cb => {
    cb.addEventListener("change", () => {
        saveState();
        updateMap();
    });
});

window.addEventListener("DOMContentLoaded", () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const state = JSON.parse(saved);
        document.querySelectorAll("#controls input").forEach(cb => {
            cb.checked = !!state[cb.id];
        });
    }
    updateMap();
});

/* ===================== RESET ===================== */
document.getElementById("resetBtn").addEventListener("click", () => {
    document.querySelectorAll("#controls input").forEach(cb => cb.checked = false);
    localStorage.removeItem(STORAGE_KEY);
    updateMap();
});
