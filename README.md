# Kompendium — App

Persönliche Bibliothek für selbstgebaute HTML-Dokumente.
React Native / Expo SDK 57 (React Native 0.86), Android-first, mobile only,
Dark Mode only.

## Über die App

Der Nutzer lässt sich am PC laufend HTML-Dateien generieren — Analysen,
Übersichten, Rechner, Nachschlagewerke, Reports —, die sich sonst über
Downloads-Ordner und Chats verstreuen. Kompendium sammelt sie an einem Ort,
macht sie am Handy lesbar und lässt sie in Ordner, Tags und Favoriten
sortieren. Der Nutzer ist gleichzeitig Autor und Leser seiner eigenen
Sammlung: ein technisch versierter Einzelnutzer, deutschsprachig, 50–500
Dokumente, nutzt die App abends und unterwegs, oft im Dunkeln. Er will in
dieser Reihenfolge: **wiederfinden** („Wo war nochmal die Übersicht von
letzter Woche?"), **lesen** (ohne dass die App im Weg steht) und
**aufräumen** (in kurzen Schüben).

Die zentrale Gestaltungsregel: Die Dokumente sind bunt, die App ist es
nicht — ein Regal, kein Poster. Vollständiges Designsystem: [DESIGN.md](DESIGN.md).

Verbindliche Vorgabe für alle Design- und Produktentscheidungen war
ursprünglich das Handoff-Dokument `C:\Projekte\HTML-Dokumenten-Ordner\README.md`;
sein vollständiger Inhalt ist in [DESIGN.md](DESIGN.md) übernommen. Bei
Widersprüchen zwischen diesem Repo und dem externen Ordner gilt weiterhin
das externe Original.

## Funktionsumfang

Die App ist gebaut und deckt ab: Theme/Design-Tokens, die generierte
Dokumentkachel, alle 18 Basiskomponenten, die Bibliothek in Listen- und
Kachelansicht mit Sektion "Neu" und kollabierendem Header, den Viewer mit
Chrome-Autohide, Info- und Tag-Sheet, Ordner-Übersicht und -Detail,
Tag-Verwaltung, Suche, Import (Datei/Zwischenablage/URL), Mehrfachauswahl,
Einstellungen mit Papierkorb und Darstellung sowie die fünf Lade-/Fehler-/
Leerzustände (leer, laden, offline, Sync-Fehler, kein Cache).

## Start

```bash
npm install
cp .env.example .env      # Supabase-Zugangsdaten eintragen
npx expo start
```

Danach den QR-Code mit Expo Go scannen (Expo Go für SDK 57).

**Abweichung vom Lösungskonzept:** Dort ist SDK 54 gepinnt, weil Expo Go
dafür regulär in den Stores lag. Auf dem Zielgerät ist Expo Go inzwischen
für SDK 57 installiert, deshalb gilt hier 57 (React Native 0.86, React 19.2,
Reanimated 4.5). Details zu Paketen und Architektur: [TECH_STACK.md](TECH_STACK.md).

**Abweichung von der Tab-Struktur des Lösungskonzepts:** Das Lösungskonzept
nennt die Tabs Bibliothek/Ordner/Suche/Einstellungen, das Handoff-Dokument
Bibliothek/Ordner/Tags/Einstellungen mit Suche als Push-Screen ohne
Tab-Bar. Gebaut wurde die Handoff-Variante — bei Widerspruch gilt das
Handoff-Dokument.

## Supabase

1. Projekt anlegen, unter *Project Settings > API* die URL und den
   Publishable/Anon Key kopieren, in `.env` eintragen.
2. `supabase/schema.sql` im SQL-Editor ausführen.
3. Unter *Authentication > Sign In / Providers* **Anonymous sign-ins**
   aktivieren — die App meldet sich ohne Login-Screen an.

Ohne `.env` startet die App trotzdem und läuft rein lokal. Vollständiges
Schema, Setup-Schritte im Detail und Sync-Strategie:
[DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).

## Struktur

```
app/(tabs)/           Bibliothek, Ordner, Tags, Einstellungen
app/dokument/[id]     Viewer als Push-Screen, ohne Tab-Bar
app/ordner/[name]     Ordner-Detail als Push-Screen
app/alle-dokumente    "Alle Dokumente" — kein Ordner, eigene Route
app/suche.tsx         Suche als Push-Screen, ohne Tab-Bar
app/papierkorb.tsx    Papierkorb, aus den Einstellungen erreichbar
app/darstellung.tsx   Darstellung, aus den Einstellungen erreichbar
app/offline.tsx       "Offline behaltene Dokumente" aus der Gruppe Speicher
app/abnahme.tsx       Abnahmeblätter als Push-Screen
src/theme/            Design-Tokens — einzige Stelle mit Hex-Werten
src/ui/               Basiskomponenten, Kachel und Icon-Register
src/screens/          Screens; jeder in einem eigenen Ordner
src/state/            Zustand, der Screens überdauert (zustand)
src/data/             Typen, Formate, Suchlauf, Import, Dateicache
src/data/db/          Schema und Repository — die einzige Stelle mit SQL
src/dev/              Abnahmeblätter (Tokens, Kacheln, Komponenten)
scripts/lint-tokens   Prüft: keine freihändigen Farb- oder Schriftwerte
scripts/shots.mjs     Screenshots des Viewer-Kernflows
scripts/shots6.mjs    Screenshots der Ordner-/Tag-/Such-/Import-Screens
scripts/shots7.mjs    Screenshots der Einstellungen, inkl. Import
scripts/shots8.mjs    Screenshots der Lade-/Fehler-/Leerzustände
supabase/schema.sql   Datenbankschema für den späteren Sync
```

## Prüfungen

```bash
npm run typecheck     # tsc --noEmit
npm run lint:tokens   # keine freihändigen Hex-Codes ausserhalb des Themes
```

`react-native-web` liegt nur in devDependencies: damit lässt sich der Stand mit
`npx expo start --web` im Browser ansehen und als Bild gegen den Prototyp
halten. Zielplattform bleibt mobile only.

```bash
npx expo export --platform web
cd dist && python3 -m http.server 8099    # die Seite unter / laden, nicht /index.html
node scripts/shots.mjs http://127.0.0.1:8099 /tmp/shots
node scripts/shots6.mjs http://127.0.0.1:8099 /tmp/shots6
node scripts/shots7.mjs http://127.0.0.1:8099 /tmp/shots7
node scripts/shots8.mjs http://127.0.0.1:8099 /tmp/shots8
```

`shots8.mjs` schaltet den Browser-Kontext wirklich offline (`setOffline`) und
löst die Zustände damit aus, statt sie nachzustellen. Zwei davon gibt es im
Browser nur mit Nachhilfe, deshalb kennt `repository.web.ts` zwei
Adressparameter — **nur dort, nie in der App**:

| Parameter | Wirkung |
|---|---|
| `?bestand=leer` | startet ohne Dokumente — Blatt `4a` |
| `?laden=1200` | verzögert das erste Lesen um 1200 ms — Blatt `4b` |

Der Viewer nutzt auf Web nicht `react-native-webview` — das Paket hat dort
keine Umsetzung — sondern über `DocumentView.web.tsx` ein `iframe`. Das
Aus- und Einblenden der Bedienung lässt sich im Web-Bild deshalb nicht
prüfen: der Scrollversatz eines fremden Dokuments ist von außen nicht
lesbar.

Die Abnahmeblätter liegen unter `src/dev/` und sind über **Einstellungen >
Abnahmeblätter** erreichbar: **Tokens** (`1a`), **Kacheln** (`1b`),
**Komponenten** (`2a`).

Vor jeder Übergabe wird dreifach geprüft — Typcheck, Token-Lint, Build —
plus eine echte visuelle Kontrolle per Screenshot gegen `Kompendium.dc.html`.
Wo eine Funktion ohne Gerät prüfbar ist, wird sie wirklich ausgelöst statt
nur bebildert — z. B. der Import über die Zwischenablage mit
`permissions: ['clipboard-read','clipboard-write']`.

## Daten

Wahrheitsquelle ist **expo-sqlite**. Vollständiges Schema (lokal und
Supabase), Sync-Strategie und Import-Wege: siehe
[DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).

`src/data/sampleLibrary.ts` ist nur die **Erstbefüllung**: 247 Dokumente.
Sie wandern beim allerersten Start in die Datenbank und werden danach nicht
mehr gelesen. Was in der App geändert wird, überlebt den Neustart. Die vier
Dokumente der Sektion "Neu" sind nur am Tag des ersten Starts neu — danach
steht die Sektion leer und die Zahl unter "Alle Dokumente" wächst von 243
auf 247 ("Neu" heißt "seit gestern importiert").

### Import und Dateicache

Die drei Wege aus Blatt `3g` wirken (`src/data/importDocument.ts`):

- **Datei wählen** — `expo-document-picker`, dann die Datei lesen
- **Aus Zwischenablage** — `expo-clipboard`
- **Von URL laden** — `fetch`, mit einem Eingabe-Sheet über dem Import-Sheet

Alle drei enden gleich: das HTML geht in den lokalen Dateicache
(`src/data/cache.ts`, eine Datei je Dokument unter `dokumente/`), Titel und
Dokumenttyp werden **einmal** erkannt und persistiert (Auszählen von
`<table>`, `<canvas>`/`<svg>`, `<input>`, `<li>` und der Textmenge), die Zeile
geht in die Datenbank und landet in "Neu".

Der Viewer liest importierte Dokumente aus dem Cache; Dokumente der
Erstbefüllung haben keine Datei und bekommen den erzeugten Beispielinhalt aus
`src/data/sampleDocumentHtml.ts`. Die Suche (`src/data/search.ts`) läuft über
Titel, Ordner, Tags und den Volltext aus beiden Quellen; der Index wird nach
dem Start einmal warmgelaufen.

Nach dem Laden steht ein fremdes Dokument auf **weisser** Fläche
(`documentCanvas`), nicht auf `bg/base`. Die dunkle Bühne gibt es nur, damit
beim Laden nichts weiß aufblitzt.

### Was "Darstellung" wirklich ändert

- **Textgröße** wirkt über `textZoom` der WebView, also die Textzoom-Funktion
  des Systems — kein eingespritztes `font-size`. `textZoom` gibt es nur unter
  Android; im Web-Bild ist der Effekt deshalb nur in der Papier-Vorschau des
  Reglers zu sehen.
- **Dokumente abdunkeln** legt ein Overlay `rgba(0,0,0,0.18)` über die
  Dokumentfläche, keine Farbinvertierung.
- **Bildschirm anlassen** über `expo-keep-awake`, nur solange der Viewer offen
  ist.
- **Standardansicht** und **Sortierung** ändern denselben Zustand, den die
  Bibliothek gerade benutzt — eine getrennte Voreinstellung wäre nicht
  nachvollziehbar.

## Abweichungen vom Handoff-Dokument — Projektentscheidungen

- **Speicherbalken:** Blatt `3i` zeigt "1,4 GB belegt / von 3 GB", also 46 %
  des Balkens. Gerechnet wird stattdessen aus dem Bestand; mit der
  Erstbefüllung sind das rund 98 MB, der Balken bleibt also fast leer. Jedes
  Segment über null wird mindestens 2 dp breit gezeichnet, damit es sichtbar
  bleibt.
- **Sync-Zustand beim Start** ist `pending` ("Änderungen offen"), nicht wie in
  Blatt `1c` `syncing`: es hat noch kein Abgleich stattgefunden. "Jetzt
  synchronisieren" führt den Zustandsverlauf vor — der echte Abgleich mit
  Supabase ist noch offen.
- **"Bewegung reduzieren"** ist in Blatt `6b` ein Schalter, folgt laut
  Untertitel aber der Systemeinstellung. Beides zusammen geht nicht; die Zeile
  zeigt den gelesenen Zustand und ist nicht bedienbar, wie das Farbschema
  darüber.
- **"Papierkorb leeren"** fragt einmal nach — im Muster des Kontextmenüs
  (Komponente 9), nicht als Dialog. Es ist die einzige Aktion der App, die ein
  Toast mit "Rückgängig" nicht absichern kann.
- **Eigene Screens ohne Blatt:** das URL-Eingabe-Sheet (der Prototyp endet bei
  der Auswahlfläche) und "Offline behaltene Dokumente" (das Blatt zeigt nur
  die Zeile mit Chevron). Beide sind ausschließlich aus vorhandenen Teilen
  gebaut.
- Die Zeile **"Abnahmeblätter"** in den Einstellungen ist ergänzt, damit die
  Blätter aus `src/dev` erreichbar bleiben. In einer ausgelieferten Fassung
  fällt sie weg.
- **Netzzustand** wertet nur `isConnected`, nicht `isInternetReachable`:
  Letzteres kostet einen Testabruf gegen eine fremde Adresse, der aus eigenen
  Gründen scheitern kann — dann stünde "Offline" über einer Bibliothek, die
  vollständig lokal liegt.
- **`networkSource.web.ts`** horcht auf `online`/`offline` des Fensters statt
  auf NetInfo: dessen Web-Fassung nutzt, sobald der Browser eine
  `navigator.connection` anbietet, allein deren `change`-Ereignis — das kommt
  beim Abschalten einmal und danach nie wieder.
- **Sync-Fehler** entsteht nur beim Abgleich ohne Netz. Einen anderen Weg
  dorthin gäbe es erst mit dem echten Supabase-Abgleich.
- **Sync-Zustand auf der leeren Bibliothek** ist `idle`, nicht `pending`: ohne
  ein einziges Dokument kann nichts offen sein.
- **Leere Bibliothek ohne Kopf-Schaltflächen:** Ansicht umschalten und
  Sortieren entfallen, es gibt nichts anzuordnen.
- **Spalte `last_opened_at`** (Schema-Version 2, mit Migration für vorhandene
  Datenbanken). Blatt `4d` nennt "Zuletzt geöffnet vor 6 Tagen"; `updated_at`
  wäre dafür die falsche Angabe, denn Lesen ändert nichts. Vorhandene Zeilen
  bekommen `NULL`.
- **"Erneut versuchen"** meldet ohne Netz "Keine Verbindung" als Toast, statt
  eine Ladeanzeige zu zeigen, hinter der nichts passiert.

Design-Abweichungen je Screen (z. B. gestrichene Sektion "Zuletzt geöffnet",
Beschriftungen im Aktionsbalken, ergänztes "Dokumente abdunkeln", ergänztes
"Für offline vormerken"): siehe die jeweilige Screen-Beschreibung in
[DESIGN.md](DESIGN.md).

## Noch offen

- Der Abgleich mit Supabase. Client und Schema stehen, `state/sync.ts` führt
  den Zustandsverlauf nur vor.
- Unter iOS wirkt die Textgröße nicht: `textZoom` ist Android-only.
- Aus dem ursprünglichen Lösungskonzept noch nicht umgesetzt: Push-Sync
  (Outbox), Teilen, PDF-Export, Share-Sheet-Empfang, Hintergrund-Sync,
  eigenes App-Icon (die letzten drei brauchen einen Dev Build statt Expo Go,
  siehe [TECH_STACK.md](TECH_STACK.md)).
