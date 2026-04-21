# TMS Tools — Sirum Userscripts

Hilfsskripte für das Sirum TMS. Beschleunigt die tägliche Arbeit mit Anhängen, Lieferscheinen und POD-Versand direkt in der Auftragsübersicht.

## Installation (ca. 2 Minuten)

### Schritt 1: Tampermonkey installieren

Tampermonkey ist eine Browser-Erweiterung, die Userscripts ausführt. Sie wird weltweit genutzt, ist kostenlos und open-source.

- **Chrome / Edge / Brave**: [Tampermonkey im Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: [Tampermonkey für Firefox](https://addons.mozilla.org/de/firefox/addon/tampermonkey/)
- **Safari**: [Tampermonkey im App Store](https://apps.apple.com/app/apple-store/id1482490089)

### Schritt 2: Erweiterungs-Entwicklermodus aktivieren (nur Chrome/Edge/Brave)

Seit Ende 2024 verlangt Chrome für Userscript-Extensions, dass der *Entwicklermodus für Erweiterungen* aktiv ist. Das ist **nicht** der gleiche Modus wie die Chrome-DevTools (F12) und hat keinerlei Auswirkungen auf die Browser-Sicherheit.

1. In der Adresszeile eingeben: `chrome://extensions`  *(bei Edge: `edge://extensions`)*
2. Oben rechts den Schalter **"Entwicklermodus"** auf **An** stellen

### Schritt 3: Script installieren

👉 **[Auf diesen Link klicken, um das Script zu installieren](https://raw.githubusercontent.com/BAHendrik/tms_tools/main/POD_Workflow.user.js)**

Tampermonkey öffnet automatisch einen Installations-Dialog mit dem Skript-Inhalt. Einfach auf **"Installieren"** klicken — fertig!

### Schritt 4: Sirum öffnen

Einmal die Seite neu laden, falls Sirum schon offen war. Die neuen Buttons erscheinen direkt in der Auftragsübersicht.

---

## Features

- 📎 **Anhang-Badge** in jeder Auftragszeile — Anzahl + Ein-Klick-Zusammenführung aller PODs zu einer PDF
- 🔍 **Vorschau-Button** — alle Dokumente eines Auftrags in einer Vorschau öffnen
- ✅ **Quick-Tag** — "Lieferschein erledigt" mit einem Klick setzen
- 🗑️ **Originale löschen** — nach erfolgreichem Merge die Originaldateien entfernen
- 📧 **POD-Brief** — Abschluss-Benachrichtigung mit angehängter POD direkt an den Kunden senden
- 🟠 **Status-Anzeige** — orange gefüllter Brief-Button zeigt sofort, ob die POD-Mail schon gesendet wurde

---

## Updates

Neue Versionen werden **automatisch** installiert. Tampermonkey prüft alle 24 Stunden auf Updates. Wer früher aktualisieren will: Tampermonkey-Icon → *Dashboard* → *Scripts auf Updates prüfen*.

---

## Häufige Probleme

**Das Skript tut nichts / Buttons erscheinen nicht**
→ Prüfe im Tampermonkey-Dashboard, ob das Script aktiv ist (Schalter rechts oben muss grün sein). Seite neu laden.

**Beim Klick auf den Install-Link wird nur Quellcode angezeigt**
→ Tampermonkey ist nicht installiert oder deaktiviert. Schritt 1 wiederholen.

**"Diese Erweiterung funktioniert möglicherweise nicht mehr" in Chrome**
→ Schritt 2 durchführen (Entwicklermodus für Erweiterungen aktivieren).

**Schalter in `chrome://extensions` ist ausgegraut**
→ Firmen-IT hat ihn gesperrt, bei der IT melden.

---

## Bei Problemen

Bei Fragen oder Fehlern: [Issue erstellen](https://github.com/BAHendrik/tms_tools/issues) oder direkt bei Hendrik melden.
