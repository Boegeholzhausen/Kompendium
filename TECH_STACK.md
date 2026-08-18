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

**Warum SDK 57 statt der im Lösungskonzept ursprünglich gepinnten SDK 54:**
Auf dem Zielgerät ist Expo Go für SDK 57 installiert, deshalb gilt hier
abweichend vom ursprünglichen Lösungskonzept 57.

## Architektur — drei Ebenen

```
┌─────────────────────────────────────────────────────┐
│  PC — HTML-Dokumenten-Ordner                         │
│  Node-Watcher: neue .html erkennen → hochladen       │
│  (noch nicht umgesetzt, siehe "Noch offen")          │
└──────────────────────┬──────────────────────────────┘
                       │ upload + insert
                       ▼
┌─────────────────────────────────────────────────────┐
│  SUPABASE (Single Source of Truth, Sync-Ziel)        │
│  ├─ Storage Bucket "documents"  → die HTML-Dateien   │
│  └─ Postgres                    → die Ordnung        │
└──────────────────────┬──────────────────────────────┘
                       │ Pull (Wasserzeichen) / Push (Outbox)
                       ▼
┌─────────────────────────────────────────────────────┐
│  APP (Expo Go)                                       │
│  ├─ SQLite      → lokale Wahrheitsquelle, speist UI  │
│  ├─ FileSystem  → Datei-Cache                        │
│  └─ WebView     → Viewer                             │
└─────────────────────────────────────────────────────┘
```

Leitprinzip **Ablage ≠ Ordnung**: Die HTML-Dateien selbst liegen flach im
Storage-Bucket (Dateiname `<uuid>.html`, keine Struktur). Ordner, Tags,
Favoriten, Titel und Notizen stehen ausschließlich in den Postgres-Tabellen
bzw. ihrem lokalen SQLite-Spiegel. Ein Dokument in einen Ordner zu
verschieben bewegt deshalb nie eine Datei, sondern ändert nur eine
Datenbankzeile — sortieren am Handy erfordert keinen Umbau am PC und
umgekehrt. Tabellenschema, Setup-Anleitung und Sync-Strategie im Detail:
[DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).

**Prinzip in der App:** Die UI liest **immer** aus SQLite, nie direkt aus
Supabase — Screens kennen weder SQLite noch Supabase, sie lesen aus den
Zustand-Stores; die Stores lesen beim Start einmal `loadSnapshot()` aus dem
Repository und schreiben Änderungen feldweise zurück. Damit ist die App
offline vollständig benutzbar und startet sofort.

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

## Was in Expo Go nicht geht

| Fehlt | Auswirkung | Umgehung |
|---|---|---|
| Share-Sheet als Ziel ("Teilen an Kompendium" aus Chrome) | Kein 1-Tap-Import vom Handy | Import über Datei-Picker / Zwischenablage / URL. Später Dev Build. |
| Dateizuordnung `.html` öffnen mit … | Dasselbe | dito |
| Hintergrund-Sync (`expo-background-task`) | Sync nur bei App-Start / Vordergrund / Pull-to-Refresh | In der Praxis ausreichend |
| Eigenes App-Icon & Splash | Kosmetisch | Ab Dev Build |

Keiner dieser Punkte blockiert den Betrieb. Der Share-Sheet-Empfang ist die
einzige Funktion, für die sich ein Dev Build wirklich lohnt — ein
`npx expo run:android` weit weg, kein Umbau.

## Entwicklung & Prüfungen

```bash
npm install
cp .env.example .env      # Supabase-Zugangsdaten, optional
npx expo start
```

```bash
npm run typecheck     # tsc --noEmit
npm run lint:tokens   # scripts/lint-tokens.mjs — keine freihändigen Hex-/Schriftwerte ausserhalb src/theme
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
app/abnahme.tsx        Abnahmeblätter (Entwicklung)
src/theme/             Design-Tokens — einzige Stelle mit Hex-Werten
src/ui/                Basiskomponenten, Kachel, Icon-Register
src/screens/           Screens, je ein eigener Ordner
src/state/             zustand-Stores
src/data/              Typen, Formate, Suche, Import, Dateicache
src/data/db/           Schema + Repository — einzige Stelle mit SQL
src/dev/               Abnahmeblätter (Tokens, Kacheln, Komponenten)
scripts/               Token-Linter, Screenshot-Skripte
supabase/schema.sql    Backend-Schema für den späteren Sync
```

## Referenzdokumente

- [README.md](README.md) — Produktbeschreibung, Start, Stand, Abweichungen
- [DESIGN.md](DESIGN.md) — vollständiges Designsystem (Tokens, Komponenten, Screens)
- [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md) — Datenmodell, Sync-Strategie, Setup
- `C:\Projekte\HTML-Dokumenten-Ordner\README.md` — ursprüngliches, verbindliches
  Handoff-Dokument (Original der Inhalte in DESIGN.md)
- `C:\Projekte\HTML-Dokumenten-Ordner\Loesungskonzept-HTML-Dokumenten-App.md`
  — ursprüngliches Architektur- und Sync-Konzept (Original der Inhalte hier
  und in DATABASE_STRUCTURE.md)
