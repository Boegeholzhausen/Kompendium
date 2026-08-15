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
app/(tabs)/           Bibliothek, Ordner, Tags, Einstellungen
app/dokument/[id]     Viewer als Push-Screen, ohne Tab-Bar
app/ordner/[name]     Ordner-Detail als Push-Screen
app/alle-dokumente    "Alle Dokumente" — kein Ordner, eigene Route
app/suche.tsx         Suche als Push-Screen, ohne Tab-Bar
app/papierkorb.tsx    Papierkorb, aus den Einstellungen erreichbar
app/darstellung.tsx   Darstellung, aus den Einstellungen erreichbar
app/offline.tsx       "Offline behaltene Dokumente" aus der Gruppe Speicher
app/abnahme.tsx       Abnahmeblaetter als Push-Screen
src/theme/            Design-Tokens — einzige Stelle mit Hex-Werten
src/ui/               Basiskomponenten, Kachel und Icon-Register
src/screens/          Screens; jeder in einem eigenen Ordner
src/state/            Zustand, der Screens ueberdauert (zustand)
src/data/             Typen, Formate, Suchlauf, Import, Dateicache
src/data/db/          Schema und Repository — die einzige Stelle mit SQL
src/dev/              Abnahmeblaetter (Tokens, Kacheln, Komponenten)
scripts/lint-tokens   Prueft: keine freihaendigen Farb- oder Schriftwerte
scripts/shots.mjs     Screenshots des Viewer-Kernflows
scripts/shots6.mjs    Screenshots der Screens aus Schritt 6
scripts/shots7.mjs    Screenshots der Screens aus Schritt 7, inkl. Import
scripts/shots8.mjs    Screenshots der Zustaende aus Schritt 8
supabase/schema.sql   Datenbankschema fuer den spaeteren Sync
```

## Pruefungen

```bash
npm run typecheck     # tsc --noEmit
npm run lint:tokens   # keine freihaendigen Hex-Codes ausserhalb des Themes
```

`react-native-web` liegt nur in devDependencies: damit laesst sich der Stand mit
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
loest die Zustaende damit aus, statt sie nachzustellen. Zwei davon gibt es im
Browser nur mit Nachhilfe, deshalb kennt `repository.web.ts` zwei
Adressparameter — **nur dort, nie in der App**:

| Parameter | Wirkung |
|---|---|
| `?bestand=leer` | startet ohne Dokumente — Blatt `4a` |
| `?laden=1200` | verzoegert das erste Lesen um 1200 ms — Blatt `4b` |

Der Viewer nutzt auf Web nicht `react-native-webview` — das Paket hat dort
keine Umsetzung — sondern ueber `DocumentView.web.tsx` ein `iframe`. Das
Aus- und Einblenden der Bedienung laesst sich im Web-Bild deshalb nicht
pruefen: der Scrollversatz eines fremden Dokuments ist von aussen nicht
lesbar.

Die Abnahmeblaetter liegen unter `src/dev/` und sind ueber **Einstellungen >
Abnahmeblaetter** erreichbar: **Tokens** (`1a`), **Kacheln** (`1b`),
**Komponenten** (`2a`).

## Daten

Wahrheitsquelle ist seit Schritt 7 **expo-sqlite** (`src/data/db/`). Das Schema
steht in `schema.ts`: `documents`, `tags`, `document_tags`, `folders` und ein
Schluessel-Wert-Paar `settings`. `repository.ts` ist die einzige Stelle im
Projekt mit SQL; die Zustaende lesen beim Start einmal `loadSnapshot()` und
schreiben danach jede Aenderung feldweise zurueck. Kein Screen kennt die
Datenbank.

`src/data/sampleLibrary.ts` ist nur noch die **Erstbefuellung**: 247 Dokumente,
die ersten davon die aus den Blaettern `1c` und `1d`. Sie wandern beim
allerersten Start in die Datenbank und werden danach nicht mehr gelesen. Zwei
Folgen davon:

- Was in der App geaendert wird, ueberlebt den Neustart.
- Die vier Dokumente der Sektion "Neu" sind nur am Tag des ersten Starts neu.
  Danach steht die Sektion leer und die Zahl unter "Alle Dokumente" waechst von
  243 auf 247 — das ist richtig so, "Neu" heisst "seit gestern importiert".

Der Ordner steht als **Name** in `documents.folder_name`, nicht als
Fremdschluessel: der Prototyp zeigt ueberall den Namen. Umbenennen fasst
deshalb beide Tabellen an, in einer Transaktion (`repository.renameFolder`).

**Web-Export:** expo-sqlite laeuft im Browser ueber WebAssembly und braucht
dafuer die Kopfzeilen `Cross-Origin-Opener-Policy` und
`Cross-Origin-Embedder-Policy`, die `python3 -m http.server` nicht schickt.
Deshalb gibt es `repository.web.ts` mit derselben Schnittstelle im
Arbeitsspeicher — dieselbe Ueberlegung wie bei `DocumentView.web.tsx`. Im
Browser faengt jeder Seitenaufruf also mit dem Beispiel-Bestand an, und genau
das will die Bildkontrolle auch.

### Import und Dateicache

Die drei Wege aus Blatt `3g` wirken (`src/data/importDocument.ts`):

- **Datei wählen** — `expo-document-picker`, dann die Datei lesen
- **Aus Zwischenablage** — `expo-clipboard`
- **Von URL laden** — `fetch`, mit einem Eingabe-Sheet ueber dem Import-Sheet

Alle drei enden gleich: das HTML geht in den lokalen Dateicache
(`src/data/cache.ts`, eine Datei je Dokument unter `dokumente/`), Titel und
Dokumenttyp werden **einmal** erkannt und persistiert (Auszaehlen von
`<table>`, `<canvas>`/`<svg>`, `<input>`, `<li>` und der Textmenge), die Zeile
geht in die Datenbank und landet in "Neu".

Der Viewer liest importierte Dokumente aus dem Cache; Dokumente der
Erstbefuellung haben keine Datei und bekommen weiterhin den erzeugten
Beispielinhalt aus `src/data/sampleDocumentHtml.ts`. Die Suche
(`src/data/search.ts`) laeuft ueber Titel, Ordner, Tags und den Volltext aus
beiden Quellen; der Index wird nach dem Start einmal warmgelaufen.

Nach dem Laden steht ein fremdes Dokument auf **weisser** Flaeche
(`documentCanvas`), nicht auf `bg/base`. Die dunkle Buehne gibt es nur, damit
beim Laden nichts weiss aufblitzt — ein Dokument ohne eigenen Hintergrund
dunkel stehen zu lassen waere ein Stylesheet ueber fremdem HTML, und schwarzer
Text darauf nicht lesbar.

### Was "Darstellung" wirklich aendert

- **Textgroesse** wirkt ueber `textZoom` der WebView, also die Textzoom-Funktion
  des Systems — kein eingespritztes `font-size`. `textZoom` gibt es nur unter
  Android; das Projekt ist Android-first. Im Web-Bild ist der Effekt deshalb
  nur in der Papier-Vorschau des Reglers zu sehen, und genau dafuer ist sie da.
- **Dokumente abdunkeln** legt ein Overlay `rgba(0,0,0,0.18)` ueber die
  Dokumentflaeche, keine Farbinvertierung.
- **Bildschirm anlassen** ueber `expo-keep-awake`, nur solange der Viewer offen
  ist.
- **Standardansicht** und **Sortierung** aendern denselben Zustand, den die
  Bibliothek gerade benutzt — eine getrennte Voreinstellung waere nicht
  nachvollziehbar.

## Stand

- [x] Projektgeruest, Supabase-Schema und -Client
- [x] Schritt 1 — Theme-Modul mit allen Tokens, Inter, Phosphor, Token-Uebersicht
- [x] Schritt 2 — Kachel-Komponente `DocTile` mit Hash-Farbton und fuenf Mustern
- [x] Schritt 3 — 18 Basiskomponenten aus Blatt `2a`, Abnahmeblatt "Komponenten"
- [x] Schritt 4 — Bibliothek in Liste und Kacheln, Sektion "Neu", kollabierender
      Header, Tab-Rahmen mit Platzhaltern fuer Ordner, Tags und Einstellungen
- [x] Schritt 5 — Viewer mit WebView, Chrome-Autohide und schwebendem
      Aktionsbalken; Info-Sheet und Tag-Sheet als Kernflow, Toast mit
      "Rueckgaengig"
- [x] Schritt 6 — Ordner-Uebersicht und -Detail, Tag-Verwaltung mit
      Wischaktionen, Suche in drei Zustaenden, Import-Sheet, Mehrfachauswahl;
      dazu die Sheets "Ordner anlegen", "Umbenennen" und "Verschieben"
- [x] Schritt 7 — Einstellungen mit Papierkorb und Darstellung; dazu die
      Datenschicht: expo-sqlite als Wahrheitsquelle, lokaler Dateicache und die
      drei wirksamen Import-Wege
- [x] Schritt 8 — Zustaende: leer, laden, offline, Sync-Fehler, kein Cache;
      dazu der Netzzustand ueber NetInfo und `last_opened_at` in der Datenbank

### Die fuenf Zustaende (Schritt 8)

| Blatt | Zustand | Woran er haengt |
|---|---|---|
| `4a` | leere Bibliothek | Datenbank gelesen und kein Dokument darin |
| `4b` | Ladezustand | `hydrated` im Dokument-Zustand ist noch `false` |
| `4c` | Offline | `isOnline` aus NetInfo (`state/network.ts`) |
| `4c` | Sync-Fehler | `status === 'error'` — ein Abgleich ohne Netz |
| `4d` | kein Cache | `!cached && !isOnline` (`isUnavailable` in `data/library.ts`) |

Der 36-px-Hinweisstreifen (`ui/NoticeStrip.tsx`) **ersetzt** den
2-px-Sync-Indikator, statt sich darunter zu stapeln; welcher von beiden
gilt, entscheidet `useNotice()` in `state/notice.ts` — Offline geht dabei vor
Sync-Fehler, weil "Wiederholen" ohne Netz sicher wieder fehlschlaegt.

Die Wurzel wartet nicht mehr auf die Datenbank, sondern nur noch auf die
Schrift: die Bibliothek zeigt ihre Skelett-Zeilen und tauscht sie gegen die
echten. Kopfzeile, Suchfeld und Tab-Bar stehen dabei an derselben Stelle wie
in der fertigen Liste, damit beim Eintreffen der Daten nichts springt.

### Abweichungen aus Schritt 7

- **Speicherbalken:** Blatt `3i` zeigt "1,4 GB belegt / von 3 GB", also 46 % des
  Balkens. Gerechnet wird stattdessen aus dem Bestand; mit der Erstbefuellung
  sind das rund 98 MB, der Balken bleibt also fast leer. Ein Balken, der mehr
  anzeigt als belegt ist, waere die schlechtere Loesung. Jedes Segment ueber
  null wird mindestens 2 dp breit gezeichnet, damit es sichtbar bleibt.
- **Sync-Zustand beim Start** ist `pending` ("Änderungen offen"), nicht wie in
  Blatt `1c` `syncing`: es hat noch kein Abgleich stattgefunden. Der
  Sync-Indikator zeigt das als durchgehende `warning`-Leiste, so wie Komponente
  15 es vorschreibt. "Jetzt synchronisieren" fuehrt den Zustandsverlauf vor —
  der echte Abgleich mit Supabase ist eine eigene Aufgabe.
- **"Bewegung reduzieren"** ist in Blatt `6b` ein Schalter, folgt laut
  Untertitel aber der Systemeinstellung. Beides zusammen geht nicht; die Zeile
  zeigt den gelesenen Zustand und ist nicht bedienbar, wie das Farbschema
  darueber.
- **"Papierkorb leeren"** fragt einmal nach — im Muster des Kontextmenues
  (Komponente 9), nicht als Dialog. Es ist die einzige Aktion der App, die ein
  Toast mit "Rueckgaengig" nicht absichern kann.
- **Eigene Screens ohne Blatt:** das URL-Eingabe-Sheet (der Prototyp endet bei
  der Auswahlflaeche) und "Offline behaltene Dokumente" (das Blatt zeigt nur
  die Zeile mit Chevron). Beide sind ausschliesslich aus vorhandenen Teilen
  gebaut.
- Die Zeile **"Abnahmeblätter"** in den Einstellungen ist ergaenzt, damit die
  Blaetter aus `src/dev` erreichbar bleiben. In einer ausgelieferten Fassung
  faellt sie weg.

### Abweichungen aus Schritt 8

- **Netzzustand** wertet nur `isConnected`, nicht `isInternetReachable`:
  Letzteres kostet einen Testabruf gegen eine fremde Adresse, der aus eigenen
  Gruenden scheitern kann — dann stuende "Offline" ueber einer Bibliothek, die
  vollstaendig lokal liegt. Der Fall "verbunden, aber nichts zu erreichen"
  zeigt sich stattdessen am scheiternden Abgleich, also am `error`-Streifen.
- **`networkSource.web.ts`** horcht auf `online`/`offline` des Fensters statt
  auf NetInfo: dessen Web-Fassung nutzt, sobald der Browser eine
  `navigator.connection` anbietet, allein deren `change`-Ereignis — das kommt
  beim Abschalten einmal und danach nie wieder. Dritte Datei dieser Art nach
  `DocumentView.web.tsx` und `repository.web.ts`.
- **Sync-Fehler** entsteht nur beim Abgleich ohne Netz. Einen anderen Weg
  dorthin gaebe es erst mit dem echten Supabase-Abgleich; einen Fehler
  vorzufuehren, den es nicht gibt, waere dasselbe wie den Abgleich
  vorzutaeuschen.
- **Sync-Zustand auf der leeren Bibliothek** ist `idle`, nicht `pending`: ohne
  ein einziges Dokument kann nichts offen sein, und die gelbe Leiste stuende
  ausgerechnet auf dem Erststart-Screen (Ergaenzung zur Abweichung aus
  Schritt 7).
- **Leere Bibliothek ohne Kopf-Schaltflaechen:** Ansicht umschalten und
  Sortieren entfallen, es gibt nichts anzuordnen. Blatt `4a` zeigt dort nur
  den Titel.
- **Neue Spalte `last_opened_at`** (Schema-Version 2, mit Migration fuer
  vorhandene Datenbanken). Blatt `4d` nennt "Zuletzt geöffnet vor 6 Tagen";
  `updated_at` waere dafuer die falsche Angabe, denn Lesen aendert nichts.
  Vorhandene Zeilen bekommen `NULL` — wann sie zuletzt offen waren, weiss
  niemand mehr, und ein erfundenes Datum waere schlechter als keins.
- **"Erneut versuchen"** meldet ohne Netz "Keine Verbindung" als Toast, statt
  eine Ladeanzeige zu zeigen, hinter der nichts passiert.

### Noch offen

- Der Abgleich mit Supabase. Client und Schema stehen, `state/sync.ts` fuehrt
  den Zustandsverlauf nur vor.
- Unter iOS wirkt die Textgroesse nicht: `textZoom` ist Android-only.
