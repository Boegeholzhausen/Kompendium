# Kompendium — App

Persoenliche Bibliothek fuer selbstgebaute HTML-Dokumente.
React Native / Expo SDK 57 (React Native 0.86), Android-first, mobile only.

Verbindliche Vorgabe ist das Handoff-Dokument
`C:\Projekte\HTML-Dokumenten-Ordner\README.md`. Bei Widerspruechen gilt es.

## Start

```bash
npm install
cp .env.example .env      # Supabase-Zugangsdaten eintragen
npx expo start
```

Danach den QR-Code mit Expo Go scannen (Expo Go fuer SDK 57).

Abweichung vom Loesungskonzept: dort ist SDK 54 gepinnt, weil Expo Go dafuer
regulaer in den Stores liegt. Auf dem Zielgeraet ist Expo Go fuer SDK 57
installiert, deshalb gilt hier 57 (React Native 0.86, React 19.2, Reanimated 4.5).

## Supabase

1. Projekt anlegen, unter *Project Settings > API* die URL und den
   Publishable/Anon Key kopieren, in `.env` eintragen.
2. `supabase/schema.sql` im SQL-Editor ausfuehren. Legt Tabellen, Indizes,
   Volltextsuche, `updated_at`-Trigger, RLS-Policies und den privaten
   Storage-Bucket `documents` an.
3. Unter *Authentication > Sign In / Providers* **Anonymous sign-ins**
   aktivieren — die App meldet sich ohne Login-Screen an.

Ohne `.env` startet die App trotzdem und laeuft rein lokal.

## Struktur

```
app/                  Routen (expo-router)
src/theme/            Design-Tokens — einzige Stelle mit Hex-Werten
src/ui/               Basiskomponenten, Kachel und Icon-Register
src/data/             Supabase-Client, spaeter SQLite und Sync
src/dev/              Abnahmeblaetter (Tokens, Kacheln, Komponenten)
scripts/lint-tokens   Prueft: keine freihaendigen Farb- oder Schriftwerte
supabase/schema.sql   Datenbankschema
```

## Pruefungen

```bash
npm run typecheck     # tsc --noEmit
npm run lint:tokens   # keine freihaendigen Hex-Codes ausserhalb des Themes
```

`react-native-web` liegt nur in devDependencies: damit laesst sich der Stand mit
`npx expo start --web` im Browser ansehen und als Bild gegen den Prototyp
halten. Zielplattform bleibt mobile only.

Die Abnahmeblaetter liegen unter `src/dev/` und sind beim Start ueber den
Umschalter am unteren Rand erreichbar: **Tokens** (`1a`), **Kacheln** (`1b`),
**Komponenten** (`2a`).

## Stand

- [x] Projektgeruest, Supabase-Schema und -Client
- [x] Schritt 1 — Theme-Modul mit allen Tokens, Inter, Phosphor, Token-Uebersicht
- [x] Schritt 2 — Kachel-Komponente `DocTile` mit Hash-Farbton und fuenf Mustern
- [x] Schritt 3 — 18 Basiskomponenten aus Blatt `2a`, Abnahmeblatt "Komponenten"
- [ ] Schritt 4 — Bibliothek
- [ ] Schritt 5 — Viewer und Kernflow
- [ ] Schritt 6 — restliche Screens
- [ ] Schritt 7 — Zustaende
- [ ] Schritt 8 — Abnahme
