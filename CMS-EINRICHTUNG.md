# Rezepte-CMS v2 – zentrale Zutaten mit Suchauswahl

Dieses Paket erweitert `hmiku9457-pixel/Einkaufliste` um ein Pages-CMS für Rezepte **und** einen zentralen Zutatenkatalog.

## Was sich gegenüber v1 ändert

Beim Rezept wird eine Zutat nicht mehr als freier Text eingegeben. Das Feld `Zutat` ist eine **suchbare Pages-CMS-Referenz** auf die Collection `Zutaten`.

Ablauf nach Variante A:

1. Existiert die Zutat bereits, im Rezeptfeld anfangen zu tippen und auswählen.
2. Existiert sie nicht, zuerst links im CMS unter `Zutaten` neu anlegen.
3. Danach zum Rezept zurückkehren und die neue Zutat auswählen.

Im Rezept selbst werden nur noch folgende Werte benötigt:

```json
{
  "id": "rotePaprika",
  "menge": 2,
  "einheit": "Stk"
}
```

Der sichtbare Name `Rote Paprika` wird beim Laden der Website aus dem zentralen Katalog ergänzt.

## Vorbelegte Zutaten

Das Paket enthält **154 Zutaten**:

- sämtliche in den aktuell vorhandenen Rezepten gefundenen technischen Zutaten-IDs, einschließlich bestehender Sonderfälle wie `haehnchenbrust`/`haehnchenbrustfilet` und `kartoffeln`/`kartoffelnFestkochend`
- zusätzlich eine breite Grundausstattung aus Gemüse, Obst, Fleisch, Fisch, Milchprodukten, Nudeln/Reis/Getreide, Hülsenfrüchten, Gewürzen, Saucen und Backzutaten
- `zutatA` bleibt als technischer Platzhalter enthalten, damit die alten Platzhalter-Rezepte bei der Validierung nicht brechen

## Performance

Pages CMS benötigt für die Suchauswahl die einzelnen Dateien unter `data/zutaten/`.
Die Website selbst lädt diese Dateien **nicht einzeln**. Der GitHub-Workflow erzeugt stattdessen `data/zutaten/00_katalog.json`; `main.js` lädt nur diese eine kompakte Datei.

## Installation

1. Den kompletten Inhalt dieses Pakets in das Stammverzeichnis des Repositories kopieren und committen.
2. Vorhandene Dateien mit gleichem Namen ersetzen, insbesondere:
   - `.pages.yml`
   - `.github/workflows/update-gericht-manifest.yml`
   - `tools/validate_rezepte.py`
3. Die enthaltenen neuen Dateien und den Ordner `data/zutaten/` mit übernehmen.
4. Der Workflow `Daten-Manifeste aktualisieren` läuft durch den Commit automatisch.
5. Der Workflow patcht `assets/js/main.js` idempotent und commitet die kleine Laufzeit-Anpassung selbst zurück.
6. Danach Pages CMS öffnen. Es erscheinen die Bereiche `Rezepte` und `Zutaten`.

Es muss **kein Code aus der Vereinsseite kopiert** werden.

## Bestehende Rezepte

Die vorhandenen Rezeptdateien können unverändert bleiben. Viele enthalten aktuell noch zusätzlich:

```json
"name": "Zwiebel"
```

Dieses redundante Feld ist für neue CMS-Rezepte nicht mehr nötig. Die Website überschreibt bzw. ergänzt den Namen zur Laufzeit mit dem zentralen Katalognamen. Wenn ein altes Rezept im CMS gespeichert wird und Pages CMS das alte `name`-Feld entfernt, ist das daher unproblematisch.

## Einheiten

Die Einheit ist im Rezept ein festes Dropdown. Enthalten sind:

`g`, `kg`, `ml`, `l`, `Stk`, `EL`, `TL`, `Prise`, `n. B.`, `Bund`, `Becher`, `Dose`, `Packung`, `Glas`, `Flasche`, `Scheiben`, `Zehen`, `Handvoll`, `Tasse`, `Würfel`, `Blatt`, `Rolle`.

Jede Zutat besitzt außerdem eine `standardEinheit`. Sie ist eine Orientierung und verhindert nicht, dass im konkreten Rezept eine andere passende Einheit verwendet wird.

## Schutzmechanismen

Der Validator prüft bei jedem relevanten Commit unter anderem:

- gültige und eindeutige Zutaten-IDs
- Übereinstimmung zwischen Zutaten-ID und Dateiname
- gültige Standard-Einheit
- gültige Rezept-IDs
- jede im Rezept verwendete Zutaten-ID muss im zentralen Katalog existieren
- gültige Mengen und Einheiten
- alte abweichende `name`-Felder werden nur als Warnung gemeldet; der Katalog ist künftig maßgeblich

Das Löschen von Zutaten ist im CMS absichtlich deaktiviert. Dadurch kann eine noch von Rezepten verwendete Zutat nicht versehentlich entfernt werden.

## Dateien

- `.pages.yml` – CMS-Konfiguration für Rezepte und Zutaten
- `data/zutaten/*.json` – zentrale Zutaten-Collection
- `data/zutaten/00_manifest.json` – automatisch generierte Dateiliste
- `data/zutaten/00_katalog.json` – kompakter Laufzeit-Katalog für die Website
- `tools/validate_rezepte.py` – Datenvalidierung
- `tools/patch_main_js_zutaten.py` – einmalige/idempotente main.js-Erweiterung
- `.github/workflows/update-gericht-manifest.yml` – Patch, Prüfung und Manifest-/Katalog-Generierung

## Neue Zutat anlegen

Beispiel Halloumi:

```json
{
  "id": "halloumi",
  "name": "Halloumi",
  "kategorie": "Milchprodukte & Eier",
  "standardEinheit": "g",
  "quelle": "eigen"
}
```

Im CMS werden diese Felder über Formularfelder gepflegt; JSON muss nicht von Hand geschrieben werden.
