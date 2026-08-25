# Zweistufiger Einkaufsworkflow – Update 25.08.2026

Dieses Paket setzt auf dem bereits installierten Paket `rezept-ux-update-2026-08-25-final.zip` auf.

## Änderungen

### 1. `index.html` als 2-Schritt-Workflow

**Schritt 1 – Gerichte auswählen**

- Suche und Rezeptkategorien bleiben erhalten.
- Die Gerichtsauswahl wird erst mit **„Weiter zur Einkaufsliste“** bestätigt.
- Der Weiter-Button ist deaktiviert, solange kein Gericht ausgewählt wurde.

**Schritt 2 – Einkaufen**

- Erst nach der Bestätigung aus Schritt 1 sichtbar.
- Enthält die Zutatenliste inklusive Checkboxen, Suchfeld und Zutatenkategorien.
- Die optionale Markt-/Kartenauswahl bleibt in Schritt 2 erhalten.
- Ein Reload während eines laufenden Einkaufs bleibt in Schritt 2.

### Gruppierung erst nach abgeschlossenem Einkauf

Der Toggle **„Nach Gericht gruppieren“** ist zunächst deaktiviert.

Er wird erst freigeschaltet, wenn alle Positionen der aktuellen Einkaufsliste abgehakt sind. Wird danach wieder eine Zutat auf offen gesetzt, wird die Gruppierung automatisch ausgeschaltet und erneut gesperrt.

### Zurück zur Gerichtsauswahl

In Schritt 2 erscheint im Header der Button **„Zurück zur Gerichtsauswahl“**.

Vor dem Zurücksetzen öffnet sich ein Bestätigungsmodal. Erst mit **„Ja, Einkauf zurücksetzen“** werden gelöscht:

- ausgewählte Gerichte,
- abgehakte Zutaten,
- Gruppierungsstatus,
- der laufende Schritt-2-Status,
- die aktuelle Marktauswahl.

Danach beginnt die Seite wieder bei Schritt 1.

## 2. Header der Rezeptübersicht

`rezept_uebersicht.html` verwendet jetzt denselben Header-Aufbau und dieselben CSS-Klassen wie `index.html`:

- `site-header`
- `page-container header-content`
- `header-heading`
- `header-actions`

Die Seitentexte bleiben passend zur Rezeptübersicht.

## 3. „Rezept einreichen“ vorerst deaktiviert

Der Button bleibt im Header sichtbar, ist aber:

- ausgegraut,
- technisch `disabled`,
- nicht klickbar.

Die vorhandene `rezept_einreichen.html` wird nicht gelöscht und kann später wieder aktiviert werden.

## Installation

1. Inhalt des ZIPs in das Root-Verzeichnis des Repositories kopieren.
2. Committen und pushen.
3. Unter **Actions** den Workflow **Apply recipe step workflow** starten.
4. Nach erfolgreichem Lauf Desktop und Smartphone testen.

Der Workflow prüft zusätzlich die erzeugte `assets/js/main.js` mit `node --check`.
