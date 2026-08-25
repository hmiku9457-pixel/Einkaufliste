# Rezept-UX-Update – 25.08.2026

Dieses Paket ergänzt die bestehende Einkaufsliste / Rezept-Webseite um vier zusammenhängende Funktionen.

## Enthalten

1. **Einkaufsliste nach Gericht gruppieren**
   - Toggle direkt oberhalb der Zutatenliste.
   - Normalansicht bleibt die zusammengefasste Einkaufsliste.
   - Gruppierte Ansicht zeigt die Zutaten wieder pro ausgewähltem Gericht.
   - Der Status der Checkboxen bleibt erhalten.

2. **Checkboxen auf der Einkaufsliste**
   - Status wird in `localStorage` gespeichert.
   - In der normalen Einkaufansicht werden erledigte Zutaten in einen eigenen Bereich **Erledigt** verschoben.
   - In der gruppierten Ansicht bleiben sie beim jeweiligen Gericht sichtbar und werden durchgestrichen.
   - Fortschritt `x von y Zutaten erledigt`.

3. **Suche und Kategorien**
   - Gerichtsauswahl: Suche nach **Rezeptname oder enthaltenen Zutaten**.
   - Rezeptübersicht: gleiche Suche und Kategorien.
   - Zutatenliste: eigene Suche plus die echten Kategorien aus dem zentralen Zutatenkatalog.
   - Bestehende Rezepte benötigen keine Migration: Kategorien werden als Fallback aus Name/Zutaten abgeleitet.
   - Pages CMS erhält beim Rezept eine Mehrfachauswahl für `kategorien`; alte Rezepte funktionieren per Fallback weiter.

4. **„Rezept einreichen“**
   - Neuer Button auf der Rezeptübersicht.
   - Neue Seite `rezept_einreichen.html`.
   - Öffentliches Formular mit Name, Kategorien, Zutaten-Autocomplete aus dem zentralen Katalog, Mengen in `g`/`ml` und Zubereitung.
   - Das Formular erzeugt einen strukturierten JSON-Vorschlag.
   - Danach wird ein vorausgefüllter GitHub-Rezeptvorschlag geöffnet.
   - Es erfolgt **keine direkte Veröffentlichung ins CMS**.

## Installation

Den Inhalt dieses ZIPs in das Root-Verzeichnis des Repositories kopieren.

Danach:

1. Änderungen committen und pushen.
2. In GitHub **Actions** den Workflow **Apply recipe UX update** starten.
3. Nach erfolgreichem Lauf die Webseite auf Desktop und Smartphone testen.

Der Workflow führt aus:

```text
python tools/ux-update/apply_ux_update.py
```

und committet die erzeugten Änderungen automatisch.

## Ein manueller Schritt für „Rezept einreichen“

Im aktuellen Repository sind GitHub Issues deaktiviert.

Einmalig aktivieren:

**GitHub → Repository → Settings → General → Features → Issues**

Danach kann `rezept_einreichen.html` die Rezeptvorschläge in die Review-Warteschlange übergeben.

## JSON-Erweiterung

Explizite Kategorien sind optional:

```json
{
  "id": "mildesHaehnchenKokosCurry",
  "name": "Mildes Hähnchen-Kokos-Curry",
  "kategorien": [
    "Fleisch",
    "Reisgericht"
  ],
  "zutaten": []
}
```

Ohne `kategorien` ermittelt die Webseite für bestehende Alt-Rezepte passende Kategorien automatisch. Neue CMS-Rezepte wählen mindestens eine Kategorie direkt im Editor.

## LocalStorage

Zusätzlich zur bestehenden Gerichtsauswahl werden verwendet:

- `abgehakteZutaten`
- `einkaufslisteNachGericht`

`Auswahl zurücksetzen` löscht auch die abgehakten Zutaten.
