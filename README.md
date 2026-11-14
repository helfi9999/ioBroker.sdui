# ioBroker.sdui 0.5.0 – experimenteller Community-Testadapter

## Wochenstundenplan wie in Sdui

Die bestehende Wochenansicht `sdui.0.timetable.weekGrid.html` zeigt Montag bis Freitag mit Stunde und Uhrzeit links. In jeder Fachkachel werden **Fachkürzel**, **Lehrerkürzel** und **Raumkürzel** dargestellt. Vertretungen und Entfall erhalten farbliche Markierungen. Die tatsächlichen Daten kommen weiterhin über den vorhandenen Sdui-API-Abruf.

## Farben selbst einstellen

Öffne **Instanzen → sdui.0 → Einstellungen**. Dort gibt es Farbwähler für Wirtschaft, Englisch, Erdkunde, Biologie, Sport, Mathematik, Deutsch, Physik, Kunst und Klassenstunde. Zusätzliche Fachnamen können unter *Weitere Fachfarben* eingetragen werden, z. B.:

```
Informatik=#BFE7C0
Religion=#F1E3C1
```

Format: eine Zeile `Fachname=#RRGGBB`, den vollständigen Fachnamen aus Sdui benutzen. Die benutzerdefinierten Farben überschreiben die vorgegebenen Fachfarben. Außerdem lassen sich Standardfarbe, Randfarben für Vertretung/Entfall und Uhrzeitanzeige je Kachel einstellen. Nach **Speichern und Schließen** wird der HTML-State bei der nächsten Abfrage aktualisiert (normalerweise 15 Minuten). Bei einem Adapterneustart wird er sofort neu erzeugt.

## Datenpunkte

- `sdui.0.timetable.weekGrid.html` – fertiger HTML-Wochenplan für VIS
- `sdui.0.timetable.weekGrid.json` – strukturiertes Wochenraster, jetzt zusätzlich mit Feld `kürzel` in jeder Unterrichtsstunde
- Alle bisherigen Stundenplan-, Vertretungs-, JSON- und HTML-Datenpunkte bleiben erhalten.

## Installation / Upgrade

Vor dem Update ein Backup bzw. Proxmox-Snapshot erstellen. Adapter-Paket in ioBroker Admin als eigene Quelle aus Datei installieren. Bestehende Instanz und Konfiguration prüfen. Bei der ersten Anmeldung Datenzugriff und Farben kontrollieren. Das ist ein **inoffizieller Testadapter**, offline getestet und nicht gegen eine echte ioBroker-Instanz verifiziert.

**Datenschutz:** Keine Zugangsdaten, Bearer-Tokens oder Schülerdaten weitergeben. Der Adapter greift lesend auf den Stundenplan zu; News, Chats und Kalender sind nicht Bestandteil dieser Version.

### Wochenwechsel in VIS (0.6.0)

Der zusätzliche Zustand `sdui.0.timetable.weekGrid.navigationHtml` enthält ein Wochenraster mit klickbaren Pfeilen für zwei vorherige und fünf folgende Wochen. Die Navigation nutzt HTML-Radiofelder und CSS (keine Inline-JavaScript-Ausführung); deshalb kann sie in einem VIS-HTML-Widget verwendet werden, das Eingabefelder, Labels und `<style>`-Elemente zulässt. Im VIS-Editor können Klicks zunächst den Widget-Rahmen auswählen; teste den Wochenwechsel im Laufzeitmodus.

Die Navigation wechselt zwischen bereits geladenen Wochen. Sie löst keine neuen API-Anfragen aus. Für die vorige Woche `Days past` auf mindestens 14, für zwei vorige Wochen auf 21 stellen. Für mehrere zukünftige Wochen `Days future` entsprechend erhöhen (maximal 35). Bei fehlenden Daten zeigt die Navigation einen Hinweis. Das bisherige `weekGrid.html` bleibt als statische Ausgabe erhalten.

## Version 0.6.3: future holidays

An additional read-only timetable scan queries 28-day chunks for the next 210 days, once per day, for `kind: HOLIDAY` entries. No official separate holidays API is assumed. If the school does not supply holidays for the requested period, the adapter cannot infer them. The scan maintains the previous successful cache if a later request fails. Future holidays are surfaced through `holidays.*` and the navigable week grid, with navigation across the previous 3 weeks and next 8 weeks. The `nextEnd` value is the last school holiday day returned by Sdui, not an independently verified official end date.

## Version 0.6.4: Extended timetable range

`daysFuture` supports 1–210 days. The next 35 days are refreshed at the configured polling interval, and days 36–210 are refreshed daily in chunks of at most 28 days per request. The navigable weekly HTML view spans the configured horizon. Entries are available only if supplied by the Sdui API. Individual per-lesson states remain limited to the immediate 35 days for performance; full future items appear in `timetable.all`, `timetable.weekGrid.navigationHtml` and `timetable.raw.all`.

## VIS individual styling (0.6.5)

Set CSS variables in the VIS HTML widget custom CSS, or add an HTML style tag around the data-point content. Example:

```css
.sdui-navigator {
  --sdui-font: Verdana, sans-serif;
  --sdui-size: 14px;
  --sdui-text: #172033;
  --sdui-subject-size: 15px;
  --sdui-details-size: 12px;
  --sdui-header-size: 16px;
  --sdui-header-bg: #dce8fa;
  --sdui-header-text: #253858;
  --sdui-period-bg: #eaf1fc;
  --sdui-period-text: #172033;
  --sdui-label-std: "Stunde";
  --sdui-label-mo: "Montag";
  --sdui-label-di: "Dienstag";
  --sdui-label-mi: "Mittwoch";
  --sdui-label-do: "Donnerstag";
  --sdui-label-fr: "Freitag";
}
```

On regular `weekGrid.html` target `.sdui-week-wrap` instead of `.sdui-navigator`. Depending on VIS/VIS2 widgets, style settings may be embedded in an HTML widget or a project-level stylesheet. If the widget uses an iframe, global CSS will not cross its boundary. All colors remain independently configurable in ioBroker. This change is presentational only; the API and existing data points remain unchanged.
