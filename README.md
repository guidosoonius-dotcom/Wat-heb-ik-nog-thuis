# Wat heb ik nog thuis

Een eenvoudige webapp om de voorraad thuis bij te houden: drogisterij, schoonmaakspullen, babyspullen en houdbare etenswaren.

- **Voorraad per plek**: keuken, bijkeuken, voorraadkast (Marvat), badkamer. Plekken zijn aan te passen.
- **+/− per product**: pak je iets, dan tik je één keer op −.
- **Automatisch boodschappenlijstje**: komt een product onder het minimum, dan staat het op het lijstje. Vink af in de winkel en tik op *Klaar*: de voorraad wordt bijgewerkt.
- **Toevoegen** via de startlijst, door een barcode te scannen (Open Food/Beauty/Products Facts) of door zelf te typen.
- **Houdbaarheid** (optioneel) met een pushmelding zodra iets binnen 30 dagen verloopt.
- **Gedeeld huishouden**: log in met een code per mail en nodig je partner uit met een uitnodigingscode.
- Werkt als app op de iPhone: open in Safari → Deel → *Zet op beginscherm*.

## Techniek

- `app/`: React + TypeScript + Vite, PWA met service worker (`src/sw.ts`) voor offline-cache en pushmeldingen.
- `supabase/`: database (Postgres met Row Level Security per huishouden), realtime-sync, een Edge Function `notify-expiry` en een dagelijkse pg_cron-taak.

```bash
cd app
npm install
npm run dev
```

De Supabase-URL en de publishable key staan in `app/src/lib/config.ts` (die mogen publiek zijn). Je kunt ze overschrijven met `VITE_SUPABASE_URL` en `VITE_SUPABASE_PUBLISHABLE_KEY`.
