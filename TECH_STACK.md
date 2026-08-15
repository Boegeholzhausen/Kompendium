# Tech Stack — Kompendium

Persönliche Bibliothek für selbstgebaute HTML-Dokumente. React Native / Expo,
Android-first, mobile only.

## Plattform

| | |
|---|---|
| Framework | Expo SDK 57 (`~57.0.12`) |
| Runtime | React Native 0.86.2, React 19.2.3 |
| Sprache | TypeScript `~5.9.2`, `tsc --noEmit` als einziger Typcheck |
| Navigation | `expo-router` (typed routes), Bottom-Tabs + Push-Screens |
| Zielplattform | Android (`de.boege.kompendium`), Portrait only, Dark Mode only |
| Ausführung | Expo Go SDK 57 auf dem Zielgerät — kein Dev Build, keine nativen Custom-Module |

**Warum SDK 57 statt der im Lösungskonzept gepinnten SDK 54:** Auf dem
Zielgerät ist Expo Go für SDK 57 installiert, deshalb gilt hier abweichend
vom Handoff-Dokument (`C:\Projekte\HTML-Dokumenten-Ordner\README.md`) 57.
Bei Widersprüchen zwischen beiden Dokumenten gilt das Handoff-Dokument.

## State & Daten

| Zweck | Paket / Datei |
|---|---|
| Zustand | `zustand` (`src/state/`) — pro Domäne ein Store (`documents`, `folders`, `search`, `viewer`, `network`, `sync`, `notice`, `appearance`) |
| Lokale DB | `expo-sqlite` (`src/data/db/`) — **einzige Wahrheitsquelle**, `repository.ts` die einzige Datei mit SQL |
| Web-Fallback | `repository.web.ts` — dieselbe Schnittstelle im Arbeitsspeicher, weil `expo-sqlite`/WASM im Browser COOP/COEP-Header braucht, die der einfache Web-Server nicht schickt |
| Dateicache | `expo-file-system` über `src/data/cache.ts` (native) / `cache.web.ts` — eine Datei je importiertes Dokument unter `dokumente/` |
| Backend (Sync-Ziel, noch nicht verdrahtet) | `@supabase/supabase-js` (`src/data/supabase.ts`) — Postgres + Storage-Bucket `documents`, Schema in `supabase/schema.sql` |
| Netzstatus | `@react-native-community/netinfo` (`state/network.ts`), Web-Variante über `window.online`/`offline` (`networkSource.web.ts`) |
| Persistenz von Auth/Session | `@react-native-async-storage/async-storage` |

**Prinzip:** Screens kennen weder SQLite noch Supabase. Sie lesen aus den
Zustand-Stores; die Stores lesen beim Start einmal `loadSnapshot()` aus dem
Repository und schreiben Änderungen feldweise zurück.

## UI & Darstellung

| Zweck | Paket |
|---|---|
| Icons | `phosphor-react-native` |
| Schrift | `@expo-google-fonts/inter` (Regular/Medium/SemiBold/Bold) |
| Animation | `react-native-reanimated` 4.5 + `react-native-worklets`, `react-native-gesture-handler` |
| Verlauf/Blur | `expo-linear-gradient`, `expo-blur` (Viewer-Chrome) |
| SVG | `react-native-svg` |
| Viewer | `react-native-webview` (nativ) / `DocumentView.web.tsx` mit `<iframe>` (Web) |
| Sonstige Expo-Module | `expo-document-picker`, `expo-clipboard`, `expo-sharing`, `expo-print`, `expo-haptics`, `expo-keep-awake`, `expo-status-bar`, `expo-linking`, `expo-constants` |

Design-Tokens liegen ausschließlich unter `src/theme/` (`colors.ts`,
`typography.ts`, `layout.ts`, `motion.ts`, `tile.ts`) — Details siehe
[DESIGN.md](DESIGN.md).

## Backend (Supabase) — Zielbild

Noch nicht produktiv verdrahtet (`state/sync.ts` führt den Zustandsverlauf
bisher nur vor), aber Schema und Client stehen:

- **Storage:** privater Bucket `documents`, flach, Dateiname `<uuid>.html`.
  Ablage ≠ Ordnung: eine Datei bewegen heißt nie eine Zeile ändern.
- **Postgres:** `folders`, `documents`, `tags`, `document_tags`, je mit
  RLS-Policy `owner_id = auth.uid()` — der Publishable Key ist damit
  gefahrlos in der App. Volltextsuche serverseitig über `tsvector`
  (Deutsch), `updated_at`-Trigger für das Sync-Wasserzeichen.
- **Auth:** anonymes Sign-in (`supabase.auth.signInAnonymously()`), kein
  Login-Screen.
- **Sync-Strategie:** Pull über Wasserzeichen (`updated_at`), Push über eine
  Outbox-Warteschlange, Konflikte Last-Write-Wins auf Zeilenebene. Details im
  Lösungskonzept, Abschnitt 5.
- Ohne `.env` startet die App trotzdem und läuft rein lokal.

## Entwicklung & Prüfungen

```bash
npm install
cp .env.example .env      # Supabase-Zugangsdaten, optional
npx expo start
```

```bash
npm run typecheck     # tsc --noEmit
npm run lint:tokens   # scripts/lint-tokens.mjs — keine freihaendigen Hex-/Schriftwerte ausserhalb src/theme
```

`react-native-web` liegt nur in `devDependencies`: zum Soll-Ist-Vergleich per
Screenshot (`npx expo start --web`, `npx expo export --platform web` +
`scripts/shots*.mjs`, siehe [README.md](README.md)). Zielplattform bleibt
mobile only, das Web-Target existiert nur für die Bildkontrolle.

## Projektstruktur

```
app/(tabs)/           Bibliothek, Ordner, Tags, Einstellungen
app/dokument/[id]      Viewer (Push, ohne Tab-Bar)
app/ordner/[name]      Ordner-Detail (Push)
app/suche.tsx          Suche (Push, ohne Tab-Bar)
app/papierkorb.tsx     Papierkorb
app/darstellung.tsx    Darstellung
app/offline.tsx        Offline behaltene Dokumente
app/abnahme.tsx        Abnahmeblaetter (Entwicklung)
src/theme/             Design-Tokens — einzige Stelle mit Hex-Werten
src/ui/                Basiskomponenten, Kachel, Icon-Register
src/screens/           Screens, je ein eigener Ordner
src/state/             zustand-Stores
src/data/              Typen, Formate, Suche, Import, Dateicache
src/data/db/           Schema + Repository — einzige Stelle mit SQL
src/dev/               Abnahmeblaetter (Tokens, Kacheln, Komponenten)
scripts/                Token-Linter, Screenshot-Skripte
supabase/schema.sql    Backend-Schema fuer den spaeteren Sync
```

## Referenzdokumente

- [README.md](README.md) — Stand, Abweichungen vom Handoff, Prüfbefehle
- `C:\Projekte\HTML-Dokumenten-Ordner\README.md` — verbindliches
  Handoff-Dokument (Design-Tokens, Komponenten-Inventar, Screens)
- `C:\Projekte\HTML-Dokumenten-Ordner\Loesungskonzept-HTML-Dokumenten-App.md`
  — ursprüngliches Architektur- und Sync-Konzept
