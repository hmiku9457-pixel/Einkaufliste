# Rezepte-CMS v3 – Einrichtung

## Ziel

Dieses Paket richtet Pages CMS für Rezepte und einen zentralen Zutatenkatalog ein. Zutaten werden im Rezept gesucht und ausgewählt; freie Zutatennamen und freie Einheiten entfallen.

## Einheitensystem

Das System verwendet für **neue Rezepte ausschließlich:**

- `g` für feste/trockene/stückige/pastöse Zutaten
- `ml` für Flüssigkeiten

Die Einheit wird direkt an der Zutat hinterlegt. Im Rezept gibst du nur **Zutat + Menge** ein. Beispiel: `Hähnchenbrust · g` auswählen und als Menge `500` eingeben.

Damit sind falsche Kombinationen wie `Hähnchenbrust + Bund` technisch ausgeschlossen.

## Bestehende Rezepte

Alte Rezeptdateien können weiterhin eigene Einheiten wie `Stk`, `EL`, `kg` usw. enthalten. Diese werden bewusst **nicht automatisch** umgerechnet, da dafür je nach Zutat Umrechnungsfaktoren nötig wären. Die Laufzeitlogik bevorzugt bei alten Rezepten deren vorhandene Einheit; nur bei neuen Rezepten ohne `einheit` wird die Katalogeinheit verwendet.

## Installation

1. Inhalt dieses Pakets in das Root-Verzeichnis des Repositories kopieren.
2. Dateien committen und nach `main` pushen.
3. Die Action `Daten-Manifeste aktualisieren` laufen lassen.
4. Pages CMS mit dem Repository verbinden bzw. neu laden.
5. Im CMS gibt es die Bereiche **Rezepte** und **Zutaten**.

## Neues Rezept

Unter **Rezepte**:

1. Rezept-ID und Namen eintragen.
2. Optional ein Bild auswählen/hochladen.
3. Unter Zutaten die gewünschte Zutat suchen. Die Auswahl zeigt Name, Einheit und Kategorie.
4. Nur die Menge in der angezeigten Einheit eintragen.
5. Zubereitungsschritte ergänzen und speichern.

## Neue Zutat

Unter **Zutaten**:

1. Zutaten-ID vergeben.
2. Namen und Kategorie eintragen.
3. Einheit auf `g` oder `ml` setzen.
4. Speichern.
5. Danach steht die Zutat in allen Rezepten über die Suche zur Verfügung.

## Automatik

Die GitHub Action:

- patcht `assets/js/main.js` idempotent für den Zutatenkatalog,
- validiert Zutaten und Rezepte,
- erzeugt `data/gerichte/00_manifest.json`,
- erzeugt `data/zutaten/00_manifest.json`,
- erzeugt `data/zutaten/00_katalog.json`.

Die Webseite lädt nur `00_katalog.json`, nicht alle einzelnen Zutaten-Dateien.
