# Design — Kompendium

Quelle der Wahrheit für alle Design-Entscheidungen ist das Handoff-Dokument
`C:\Projekte\HTML-Dokumenten-Ordner\README.md`. Dieses Dokument fasst zusammen,
was davon in `src/theme/` umgesetzt ist und wie im Code damit gearbeitet wird.
Bei Widersprüchen gilt das Handoff-Dokument.

## Grundregel

**Keine freihändigen Hex-Codes oder Schriftgrößen außerhalb von
`src/theme/`.** `npm run lint:tokens` prüft das. Komponenten importieren
ausschließlich benannte Tokens aus `src/theme/`. Einzige erlaubte Ausnahme:
`sampleDocument`-Werte (`colors.ts`) und `sampleDocumentPreview()`
(`typography.ts`) — das sind Beispielinhalte für die Papier-Vorschau, nicht
Teil des Designsystems, und stehen nur deshalb im Theme-Ordner.

Dark Mode ist der einzige Modus (`userInterfaceStyle: "dark"` in `app.json`).

## Farben (`src/theme/colors.ts`)

**Flächen** — vier Stufen, aufsteigend, Tiefe entsteht aus Stufe + 1px
`border/subtle`:

| Token | Hex | Verwendung |
|---|---|---|
| `bg.base` | `#0E1012` | App-Hintergrund |
| `bg.surface` | `#15181B` | Karten, Listenzeilen, Tab-Bar |
| `bg.raised` | `#1C2024` | Angehobene Karten, Eingabefelder, Chips |
| `bg.overlay` | `#23282D` | Bottom-Sheets, Menüs, Dialoge |

**Linien:** `border.subtle` (`#262C31`), `border.strong` (`#343B41`).

**Text:** `text.primary` (`#E8EDF0`, Titel/Fließtext), `text.secondary`
(`#98A3AC`, Metadaten), `text.tertiary` (`#6E7A83`, Platzhalter/deaktiviert).

**Akzent — Mint** (`accent.base` `#34D399`): sparsam, pro Screen genau eine
primäre Aktion. `pressed`, `surface` (12% Fläche), `border` (28%), `on`
(Text auf gefülltem Mint).

**Semantik:** `semantic.danger` (`#F87171`), `warning` (`#FBBF24`), `info`
(`#60A5FA`), je mit einer `semanticSurface`-Variante bei 14% Deckkraft (z. B.
Sync-Fehler-Streifen, Wisch-Aktion „Löschen").

**Tag-Palette** — acht Farben (`tagPalette`: mint, sky, violet, rose, amber,
teal, lime, slate). Darstellung immer: 12%-Fläche + vollfarbiger Text +
6×6-Punkt. **Ordnerfarben** sind eine Teilmenge von sechs
(`folderColorNames`) — mehr Auswahl macht Ordner nicht unterscheidbarer, und
bei sechs bleiben die Auswahlkacheln 48dp breit.

**Überlagerungen** (`overlay`): Scrim unter Sheets (`rgba(0,0,0,0.55)`),
Viewer-Kopfzeile (`bg/base` bei 72% + Blur 14), Dokumente-abdunkeln-Overlay
(`rgba(0,0,0,0.18)`, **keine** Farbinvertierung).

`withAlpha(hex, alpha)` erzeugt aus einem Token eine transparente Variante —
der einzige erlaubte Weg, eine Fläche aus einem Token abzuleiten.

## Typografie (`src/theme/typography.ts`)

Schrift: **Inter** (400/500/600/700). Skala als benannte Varianten, keine
freien `fontSize`-Werte:

| Variante | Größe/Zeilenhöhe | Gewicht | Verwendung |
|---|---|---|---|
| `display` | 30/36 | 700, -0.02em | |
| `titleLg` | 22/28 | 600, -0.01em | |
| `title` | 18/24 | 600 | |
| `body` | 16/24 | 400 | Fließtext, **nie kleiner** |
| `bodySm` | 14/20 | 400 | |
| `label` | 13/18 | 500 | |
| `caption` | 12/16 | 500, +0.01em | Metadaten, **nie kleiner** |
| `overline` | 11/14 | 600, +0.08em, Großbuchstaben | |
| `button` | 16/24 | 600 | Beschriftung gefüllter/sekundärer Buttons |
| `labelStrong` | 13/18 | 600 | Textbutton |
| `labelSm` | 11/14 | 500 | Icon-Beschriftungen im Viewer-Aktionsbalken |

Harte Regel: Metadaten nie unter 12px, Fließtext nie unter 16px.
Zahlenkolonnen (Dateigrößen, Anzahlen, Daten, Prozente) bekommen
`tabularNums`, damit beim Aktualisieren nichts springt.

## Raster & Maße (`src/theme/layout.ts`)

- **Abstands-Skala:** 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 (`space`).
  Freie Zahlen sind in Komponenten nur für Flex-Verhältnisse erlaubt, nie für
  Abstände.
- **Radien:** `xs` 6 · `sm` 10 · `md` 14 (Karten, Felder, Buttons) · `lg` 20
  (FAB) · `xl` 28 (Sheets, nur oben) · `pill` 999.
- **Icons:** 16 / 20 / 24 (`iconSize.sm/md/lg`).
- **Berührungsflächen:** mindestens 48dp (`size.touchTarget`), mindestens
  8dp Abstand zwischen zweien (`size.touchGap`).
- Feste Maße für praktisch jede Komponente stehen als benannte Konstanten in
  `size` (Zeilenhöhen, Button-Höhen, FAB-Position, Sheet-Griff, Slider,
  Switch …) — bei einer neuen Komponente hier zuerst nachsehen, bevor ein
  neuer Wert erfunden wird.
- **Einziger erlaubter Schlagschatten** (`floatingShadow`): Bottom-Sheets,
  Kontextmenü, Toast, schwebender Aktionsbalken. Überall sonst entsteht
  Tiefe aus Fläche + Linie, nicht aus Schatten.

## Bewegung (`src/theme/motion.ts`)

- Kein Effekt darf das Layout verschieben.
- Dauerstufen: `micro` 140ms · `standard` 220ms · `exit` 160ms · `press`
  100ms (Druckfeedback) · `shimmer` 1600ms (Skelett) · `syncPulse` 1400ms.
- Standard-Easing: `Easing.bezier(0.2, 0, 0, 1)`.
- Druckfeedback: Skalierung auf 0.97 in 100ms (`pressScale`).
- Listen-Eintritt: 35ms Versatz pro Element, maximal acht (`stagger`).
- **„Bewegung reduzieren"** (Systemeinstellung, `useReduceMotion()`) schaltet
  Versatz und Schimmer ab; Zustandswechsel bleiben, nur ohne Übergang. In den
  Einstellungen ist die Zeile deshalb nur eine Anzeige, kein Schalter — die
  Systemeinstellung entscheidet.

## Kacheln (`src/theme/tile.ts`, `DocTile`)

Da echte HTML-Thumbnails in Expo Go kein natives Rendering bekommen können,
zeigt jede Dokumentkachel stattdessen eine **generierte** Kachel: Farbton
deterministisch aus der Dokument-ID gehasht, plus die ersten Wörter des
Titels und ein Typ-Icon (Tabelle / Diagramm / Text / Rechner / Liste — beim
Import einmal erkannt und persistiert, ändert sich zwischen Sitzungen nicht).
Fünf Muster stehen zur Auswahl, ebenfalls deterministisch aus der ID
abgeleitet — sieht bewusst gestaltet aus, kostet nichts, und Dokumente werden
über die Farbe wiedererkennbar.

## Fremde Dokumente im Viewer

Ein importiertes HTML-Dokument bekommt **kein** eigenes Stylesheet
übergestülpt: Nach dem Laden steht es auf `documentCanvas` (`#FFFFFF`), nicht
auf `bg/base`. Die dunkle Bühne davor verhindert nur weißes Aufblitzen beim
Laden — ein Dokument ohne eigenen Hintergrund dunkel zu lassen wäre ein
Stylesheet über fremdem HTML, und schwarzer Text darauf wäre nicht lesbar.
„Dokumente abdunkeln" legt deshalb ein Overlay über die Fläche, keine
Farbinvertierung.

## Navigation & Screens

Expo Router, Bottom-Tabs mit vier Einträgen: **Bibliothek · Ordner · Tags ·
Einstellungen**. Favoriten sind bewusst kein eigener Tab, sondern ein Filter
innerhalb der Bibliothek — sonst gibt es vier Wege zum selben Dokument.

Wichtige Screens als Push (ohne Tab-Bar): Viewer (`dokument/[id]`),
Ordner-Detail (`ordner/[name]`), Suche, Papierkorb, Darstellung, Abnahme.

Details zu allen Screens, Komponenten und Zuständen: Handoff-Dokument,
Abschnitt „Screens & Navigation", sowie [README.md](README.md) für bereits
umgesetzte Abweichungen (z. B. Speicherbalken, Sync-Zustände,
„Papierkorb leeren").

## Abnahmeblätter

Unter `src/dev/`, erreichbar über **Einstellungen > Abnahmeblätter**:
**Tokens** (`TokenSheet`), **Kacheln** (`TileSheet`), **Komponenten**
(`ComponentSheet`). Dienen dem Soll-Ist-Vergleich gegen das Handoff-Dokument
und fallen in einer ausgelieferten Fassung weg.

## Prüfung

```bash
npm run lint:tokens   # keine freihaendigen Hex-Codes/Schriftgroessen ausserhalb src/theme
```

Für den visuellen Soll-Ist-Vergleich per Screenshot siehe
[README.md](README.md) (`npx expo export --platform web` +
`scripts/shots*.mjs`).
