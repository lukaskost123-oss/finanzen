# Finanzen – Ausgaben & Raten

Web-App und iPhone-App (PWA) für monatliche Raten, Fixkosten, Einnahmen und einmalige Ausgaben.
Alle Daten bleiben lokal auf dem Gerät (keine Anmeldung, keine Cloud).

## Starten

```bash
npm install
npm run dev      # Entwicklung, auch im WLAN erreichbar
npm test         # Rechen-Tests
npm run build    # fertige App in dist/
```

## Aufs iPhone

1. Mac und iPhone im selben WLAN, `npm run dev` starten.
2. Auf dem iPhone in **Safari** `http://<IP-des-Macs>:5173` öffnen.
3. Teilen → **Zum Home-Bildschirm**.

Für Offline-Betrieb und Updates die App über HTTPS hosten (z. B. `dist/` auf Netlify, Vercel oder GitHub Pages).

## Bedienung

- **+** (oder Taste `N`): neuer Eintrag – einmalig oder laufend, Ausgabe oder Einnahme.
- **Übersicht**: frei verfügbares Geld, offene Zahlungen, Hinweise. Monat per Wischen oder Pfeilen wechseln. Kreis antippen = bezahlt/offen.
- **Raten**: Fortschritt, Restschuld, Zinsen, „ab wann mehr Geld übrig".
- **Analyse**: Kategorien, 12-Monats-Verlauf, Fixkosten pro Jahr, Top 5, Abo-Check.
- **Planung**: 12-Monats-Prognose, Was-wäre-wenn, Budgets, Sparziele.
- **Einstellungen**: Hell/Dunkel, Kategorien, Export (PDF, Excel, CSV), Kalender-Erinnerungen, Backup.

## Aufbau

- `src/lib/engine.ts` – Rechenlogik (Termine, Raten, Kredite, Prognose), getestet in `engine.test.ts`
- `src/lib/store.tsx` – Zustand, Speicherung, Rückgängig
- `src/lib/export.ts` – PDF, Excel, CSV, Kalender, Backup
- `src/pages/*` – Seiten, `src/components/*` – Formular und UI-Bausteine
