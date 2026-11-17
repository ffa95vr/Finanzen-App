# Meine Finanzen

Private Finanz-App fürs Handy (iPhone und Android) als Web-App zum Startbildschirm.
Alle Daten bleiben **nur auf dem Gerät** (Browser-Speicher, Schlüssel `finanzen_v1`). Kein Konto, kein Tracking.

## Funktionen (Prototyp, Schritt 1)

- Jahr eingeben, Monat wählen
- Einkommen und beliebig viele Ausgaben erfassen, bearbeiten, löschen
- Bilanz pro Monat (Einnahmen, Ausgaben, Überschuss, Sparquote) und Jahr
- Diagramme: Ausgaben nach Kategorie (Ring), Jahresverlauf (Balken)
- Konten (Privatkonto, Sparkonto, Kreditkarte, Bargeld …) mit eigener Währung und Anfangssaldo
- Kategorien mit Monatsbudget (CHF) und Warnung bei Überschreitung
- Wiederkehrende Zahlungen (Miete, Lohn, Abos) werden pro Monat automatisch eingetragen
- PIN-Sperre, Sicherung als JSON-Datei speichern/laden

## Starten (Mac, Terminal)

```bash
cd ~/Documents/Finanzen-App
npm install
npm run dev
```

Dann <http://localhost:5180> öffnen. Tests: `npm test`.

## Später

Synchronisation zwischen Geräten (nur nach Rückfrage, verschlüsselt), Hosting auf fester Adresse, evtl. echte App (Capacitor).
