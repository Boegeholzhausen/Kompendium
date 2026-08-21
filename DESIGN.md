# Design — Kompendium

Vollständiges Designsystem der App. Ursprüngliche Quelle der Wahrheit war das
Handoff-Dokument `C:\Projekte\HTML-Dokumenten-Ordner\README.md` (Referenz-HTML:
`Kompendium.dc.html`); sein Inhalt ist hier vollständig übernommen und um die
tatsächliche Umsetzung ergänzt. Bei Zweifeln an der Übertragung gilt weiterhin
das externe Original.

Zielplattform React Native / Expo, Referenzgerät Android 393 × 852 dp,
lauffähig ab 360 dp Breite, **mobile only**. **High-fidelity:** Alle Farben,
Typografie, Abstände, Radien und Zustände sind final und verbindlich, die UI
ist pixelgenau nachzubauen. Ausnahme: Inhalte der Beispieldokumente im Viewer
(helles Papier, Georgia, Balkendiagramm) sind Platzhalterinhalt — echte
Nutzerdokumente bringen ihre eigene Gestaltung mit, die App gestaltet dort
nichts.

Die Referenzdatei ist ein Prototyp, der Aussehen und Verhalten zeigt, **kein
Produktionscode zum Kopieren** — CSS-Techniken haben RN-Entsprechungen:
`repeating-linear-gradient`-Muster der Kacheln als `View`-Kompositionen oder
`react-native-svg`; `linear-gradient` via `expo-linear-gradient`;
`backdrop-filter: blur` via `expo-blur` (`BlurView`); Safe Areas über
`react-native-safe-area-context`, nicht über feste Pixelwerte.

## Produkt & Nutzer

Kompendium sammelt selbst generierte HTML-Dokumente — Analysen, Übersichten,
Rechner, Nachschlagewerke, Reports — an einem Ort, macht sie am Handy lesbar
und lässt sie in Ordner, Tags und Favoriten sortieren.

**Die zentrale Spannung, die das Design lösen muss:** Die Dokumente selbst
sind bunt und individuell gestaltet. Die App drumherum muss deshalb ruhig,
dunkel und zurückhaltend sein — ein Regal, kein Poster. Jede überflüssige
Dekoration konkurriert mit dem Inhalt und verliert.

Ein technisch versierter Einzelnutzer, deutschsprachig, benutzt die App
abends und unterwegs, oft im Dunkeln, 50–500 Dokumente. Er will in dieser
Reihenfolge: **wiederfinden**, **lesen** (ohne dass die App im Weg steht),
**aufräumen** (in kurzen Schüben).

Haltung: sachlich, präzise, erwachsen. Kein Onboarding-Gewitter, keine
Erfolgsanimationen, keine Maskottchen, **keine Emojis** — die Ästhetik eines
gut gemachten Entwickler-Tools, nicht einer Consumer-Social-App. Alle Texte
auf **Deutsch**, Du-Form vermieden, neutral und knapp („Ordner anlegen",
„Für offline laden", „3 ausgewählt").

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
primäre Aktion. `pressed` (`#2BBA85`), `surface` (12 % Fläche,
`rgba(52,211,153,0.12)`), `border` (28 %, `rgba(52,211,153,0.28)`), `on`
(Text auf gefülltem Mint, `#06120D`).

**Semantik:** `semantic.danger` (`#F87171`), `warning` (`#FBBF24`), `info`
(`#60A5FA`), je mit einer `semanticSurface`-Variante bei 14 % Deckkraft (z. B.
Sync-Fehler-Streifen, Wisch-Aktion „Löschen").

**Tag-Palette** — acht Farben (`tagPalette`): `mint #34D399` · `sky #60A5FA`
· `violet #A78BFA` · `rose #FB7185` · `amber #FBBF24` · `teal #2DD4BF` ·
`lime #A3E635` · `slate #94A3B8`. Darstellung immer: 12 %-Fläche
(`rgba(r,g,b,0.12)`) + vollfarbiger Text + 6×6-Punkt. **Ordnerfarben** sind
eine Teilmenge von sechs (`folderColorNames`) — mehr Auswahl macht Ordner
nicht unterscheidbarer, und bei sechs bleiben die Auswahlkacheln 48 dp breit.

**Überlagerungen** (`overlay`): Scrim unter Sheets (`rgba(0,0,0,0.55)`),
Viewer-Kopfzeile (`bg/base` bei 72 % + Blur 14), Dokumente-abdunkeln-Overlay
(`rgba(0,0,0,0.18)`, **keine** Farbinvertierung — invertierte Diagramme
werden unlesbar).

`withAlpha(hex, alpha)` erzeugt aus einem Token eine transparente Variante —
der einzige erlaubte Weg, eine Fläche aus einem Token abzuleiten.

## Typografie (`src/theme/typography.ts`)

Schrift: **Inter** (400/500/600/700), im Projekt lokal eingebunden
(`expo-font`, `@expo-google-fonts/inter`). Skala als benannte Varianten,
keine freien `fontSize`-Werte:

| Variante | Größe/Zeilenhöhe | Gewicht | Tracking | Verwendung |
|---|---|---|---|---|
| `display` | 30/36 | 700 | −0.02em | |
| `titleLg` | 22/28 | 600 | −0.01em | |
| `title` | 18/24 | 600 | 0 | |
| `body` | 16/24 | 400 | 0 | Fließtext, **nie kleiner** |
| `bodySm` | 14/20 | 400 | 0 | |
| `label` | 13/18 | 500 | 0 | |
| `caption` | 12/16 | 500 | +0.01em | Metadaten, **nie kleiner** |
| `overline` | 11/14 | 600 | +0.08em, Großbuchstaben | |
| `button` | 16/24 | 600 | | Beschriftung gefüllter/sekundärer Buttons (abgeleitete Stufe, ergänzt in Schritt 3) |
| `labelStrong` | 13/18 | 600 | | Textbutton (abgeleitete Stufe, ergänzt in Schritt 3) |
| `labelSm` | 11/14 | 500 | | Icon-Beschriftungen im Viewer-Aktionsbalken (abgeleitete Stufe, ergänzt in Schritt 5) |

Harte Regel: Metadaten nie unter 12 px, Fließtext nie unter 16 px.
Zahlenkolonnen (Dateigrößen, Anzahlen, Daten, Prozente, Restfristen) bekommen
`tabularNums` (`fontVariant: ['tabular-nums']`), damit beim Aktualisieren
nichts springt.

## Raster & Maße (`src/theme/layout.ts`)

- **Abstands-Skala:** 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 (`space`).
  Seitenrand 16 durchgehend. Freie Zahlen sind in Komponenten nur für
  Flex-Verhältnisse erlaubt, nie für Abstände.
- **Radien:** `xs` 6 · `sm` 10 · `md` 14 (Karten, Felder, Buttons) · `lg` 20
  (FAB) · `xl` 28 (Sheets, nur oben) · `pill` 999.
- **Icons:** 16 / 20 / 24 (`iconSize.sm/md/lg`). **Phosphor Icons**,
  Strichstärke `regular` (1.5 px), aktive Tab-Icons und Zustandsanzeigen in
  `fill`. In RN: `phosphor-react-native`. Keine Emojis, nirgends.
- **Berührungsflächen:** mindestens 48 dp (`size.touchTarget`), mindestens
  8 dp Abstand zwischen zweien (`size.touchGap`).
- Feste Maße für praktisch jede Komponente stehen als benannte Konstanten in
  `size` (Zeilenhöhen, Button-Höhen, FAB-Position, Sheet-Griff, Slider,
  Switch, `emptyIconRadius` 24, `tabBarHeight` …) — bei einer neuen
  Komponente hier zuerst nachsehen, bevor ein neuer Wert erfunden wird.
- **Einziger erlaubter Schlagschatten** (`floatingShadow`,
  `0 −8 32 rgba(0,0,0,0.45)`): Bottom-Sheets, Kontextmenü, Toast, schwebender
  Aktionsbalken; Sheets zusätzlich über einem Scrim `rgba(0,0,0,0.55)`.
  Überall sonst entsteht Tiefe aus Fläche + Linie, nicht aus Schatten — im
  Dunkeln funktionieren schwere Schlagschatten ohnehin nicht.

Verwendete Icon-Namen: `books`, `folders`, `folder`, `folder-open`, `tag`,
`gear`, `plus`, `magnifying-glass`, `x`, `x-circle`, `arrow-left`,
`arrow-right`, `arrow-up`, `caret-right`, `caret-down`, `arrows-down-up`,
`rows`, `squares-four`, `star`, `share-network`, `info`,
`dots-three-vertical`, `pencil-simple`, `trash`, `download-simple`, `check`,
`cloud-check`, `cloud-slash`, `wifi-slash`, `warning`, `warning-circle`,
`arrow-clockwise`, `arrow-counter-clockwise`, `clock-counter-clockwise`,
`clock-countdown`, `table`, `chart-bar`, `article`, `calculator`,
`list-dashes`, `file-html`, `clipboard-text`, `link-simple`, `tray`,
`text-aa`, `moon`, `calendar-blank`, `backspace`, `hand-tap` (nur im
Flow-Blatt).

## Bewegung (`src/theme/motion.ts`)

- Kein Effekt darf das Layout verschieben.
- Dauerstufen: `micro` 140 ms · `standard` 220 ms (`cubic-bezier(0.2,0,0,1)`)
  · `exit` 160 ms · `sheet` Spring (damping 22, stiffness 260) · `press`
  100 ms (Druckfeedback) · `shimmer` 1600 ms (Skelett) · `syncPulse` 1400 ms.
- Druckfeedback: Skalierung auf 0.97 in 100 ms (`pressScale`).
- Listen-Eintritt: 35 ms Versatz pro Element, maximal acht (`stagger`).
- **„Bewegung reduzieren"** (Systemeinstellung, `AccessibilityInfo.isReduceMotionEnabled`
  / `useReduceMotion()`) schaltet Versatz und Schimmer ab; Zustandswechsel
  bleiben, nur ohne Übergang. In den Einstellungen ist die Zeile deshalb nur
  eine Anzeige, kein Schalter — die Systemeinstellung entscheidet.
- Basiskomponenten animieren über die eingebaute Animated-API
  (Druckfeedback, Schimmer, Sheet-Auftritt); Reanimated bleibt den Gesten-
  und Scroll-Effekten der Screens vorbehalten (z. B. kollabierender Header).
  Die RN-Kurven liegen als `easingNative` in `theme/motion.ts`.

## Die Kachel — generierte Vorschau (`src/theme/tile.ts`, `DocTile`)

Es gibt **keine echten Thumbnails** der HTML-Dokumente — technisch in
Expo Go nicht möglich (kein natives Rendering). Jedes Dokument bekommt
stattdessen eine deterministisch generierte Kachel:

1. **Farbton aus der Dokument-ID.** Stabiler Hash der ID → Hue 0–360.
   Verlauf `150deg`, zwei Stopps: `hsl(H 13% 19%)` → `hsl(H 9% 10%)`.
   Sättigung zwischen 8 % und 14 %, damit viele Kacheln nebeneinander eine
   ruhige Fläche bleiben. Dasselbe Dokument hat immer dieselbe Farbe.
2. **Muster aus dem erkannten Dokumenttyp** — fünf abstrakte Geometrien in
   `rgba(232,237,240,α)`, keine Illustrationen:
   - **Tabelle** — Raster aus 1-px-Linien (α .16), Kopfzeile als Fläche α .09
     über den oberen 22 %.
   - **Diagramm** — fünf bis sechs Balken (α .22, Höhen 38/64/48/88/56/72 %)
     auf einer Grundlinie (α .20).
   - **Fließtext** — Überschriftbalken 42 % Breite (α .30), darunter vier
     Textlinien 2 px (α .17, Breiten 100/94/100/66 %).
   - **Rechner** — Anzeigefeld (α .26) über einem 3×3-Tastenraster (α .16),
     auf 56 % der Breite zentriert.
   - **Liste** — vier Zeilen aus 4-px-Punkt (α .34) und 2-px-Linie (α .17),
     letzte Zeile 60 % Breite.
3. **Typ-Icon** unten links (16 px bzw. 14 px auf der Karte) in
   `text/secondary`.

Größen: **44 × 44** mit `radius sm 10` in Listenzeilen — hier **ohne**
Typ-Icon, weil es bei dieser Größe mit dem Muster kollidiert; Muster und
Innenabstände entsprechend verkleinert (α leicht erhöht auf .18–.36).
**16:10** mit `radius sm 10` in Karten und Ergebnislisten, dort mit Icon.

Im Papierkorb (`6a`) werden Kacheln gedämpft: Sättigung auf 9 %/6 %,
Muster-α auf .10–.18 — wiedererkennbar, aber sichtbar außer Dienst.

Der Dokumenttyp wird beim Import einmal erkannt (Auszählen von `<table>`,
`<canvas>`/`<svg>`, `<input>`, `<ul>/<ol>`, Textmenge) und persistiert — die
Kachel darf sich nicht zwischen zwei Sitzungen ändern. Der Kachel-Farbton
wird nicht gespeichert, sondern aus der ID gerechnet.

## Fremde Dokumente im Viewer

Ein importiertes HTML-Dokument bekommt **kein** eigenes Stylesheet
übergestülpt: Nach dem Laden steht es auf `documentCanvas` (`#FFFFFF`), nicht
auf `bg/base`. Die dunkle Bühne davor verhindert nur weißes Aufblitzen beim
Laden — ein Dokument ohne eigenen Hintergrund dunkel zu lassen wäre ein
Stylesheet über fremdem HTML, und schwarzer Text darauf wäre nicht lesbar.
„Dokumente abdunkeln" legt deshalb ein Overlay über die Fläche, keine
Farbinvertierung.

## Komponenten-Inventar

Alle 18 Komponenten in allen Zuständen (Ruhe, gedrückt, ausgewählt,
deaktiviert): Abnahmeblatt `2a`. **Gedrückt** ist immer Skalierung `0.97`
plus eine Flächenstufe höher. **Deaktiviert** ist ein Farbwechsel auf
`text/tertiary`, **nie** Deckkraft — 40 % Opacity drückt den Kontrast unter
4.5:1.

1. **Dokumentzeile** — Höhe 64 (Innenabstand 10 vertikal), Kachel 44 × 44,
   `gap 12`. Titel `body` in `text/primary`, maximal zwei Zeilen
   (`maxHeight 48`, danach Ellipse). Metazeile `caption` in `text/secondary`,
   Format „vor 3 Tagen · 240 KB". Tag-Punkte 6 × 6 rechts, `gap 6`.
   Favoriten-Stern als eigenes 48 × 48-Ziel, gesetzt `star` in `fill` +
   `accent`, ungesetzt `regular` + `text/tertiary`. Trennlinie
   `border/subtle` unten. Gedrückt: `bg/surface`, Radius 10, Rand ±8
   überzogen. Ausgewählt: `accent/surface` + `accent/border`,
   Mint-Checkbox 24 × 24 links. Deaktiviert (offline nicht geladen): Kachel
   entsättigt, Titel und Meta `text/tertiary`, Meta mit `cloud-slash` +
   „nicht geladen".
2. **Dokumentkarte** (2 Spalten, `gap 16 / 12`) — Kachel 16:10, Titel `label`
   unter der Kachel mit fester Höhe 36 (zwei Zeilen), darunter Ordner-Chip:
   Höhe 24, `radius xs`, `bg/raised`, `folder`-Icon 14 + `caption` in
   `text/secondary`; nicht einsortierte Dokumente zeigen `tray` + „Nicht
   einsortiert". Favoriten-Stern liegt oben rechts **auf** der Kachel.
3. **Ordner-Kachel** — `bg/surface`, `radius md`, Innenabstand 14;
   `folder`-Icon 24 in `fill` in der Ordnerfarbe, Name `title`, Anzahl
   `caption` in `text/secondary`. „Ordner anlegen" als letzte Kachel: 1 px
   **gestrichelt** `border/strong`, kein Hintergrund, `plus` 24 + `label`,
   zentriert.
4. **Tag-Chip** — Höhe 28 (32 im Sheet), `radius pill`, Fläche 12 %, Punkt
   6 × 6 + Name `label` in Tag-Farbe. Entfernbare Variante mit `x` 14
   rechts. Deaktiviert: `bg/raised`, Punkt `border/strong`, Text
   `text/tertiary`.
5. **Filter-Chip** — Höhe 40 (36 im kollabierten Header), `radius pill`,
   Innenabstand 16. Inaktiv `bg/raised` + `border/subtle` + `text/primary`;
   aktiv `accent/surface` + `accent/border` + `accent`; gedrückt
   `bg/overlay` + `border/strong` + `scale 0.97`.
6. **Suchfeld** — Höhe 48, `radius md`, `bg/raised`. Ruhe: 1 px
   `border/subtle`, `magnifying-glass` 20 in `text/tertiary`, Platzhalter
   „Titel, Inhalt, Tag" in `text/tertiary`. Fokus: 2 px `accent/border`
   (Innenabstand um 1 reduziert, damit nichts springt), Lupe
   `text/secondary`, Cursor 1 × 20 in `accent`, `x-circle` 20 rechts. Ein
   gefülltes, aber nicht fokussiertes Feld trägt den ruhenden Rahmen und nur
   das Löschen-Symbol — der 2-px-Mint-Rahmen gehört allein zum Fokus.
7. **Sektionskopf** — `overline` in `text/tertiary`; optional Anzahl-Badge
   (Mint gefüllt, `on-accent`-Text, Höhe 20, min. Breite 20, `radius pill`)
   oder rechte Zahl in `text/tertiary`; optional „Alle anzeigen" als
   Mint-Textbutton.
8. **Bottom-Sheet** — `bg/overlay`, `radius xl` nur oben, 1 px
   `border/strong` oben, Schatten `0 −8 32 rgba(0,0,0,0.45)`, Scrim
   `rgba(0,0,0,0.55)`. Griff 36 × 4 `border/strong` zentriert, Titelzeile
   `title` mit `x` als 48 × 48-Ziel rechts. Innenabstand seitlich 16.
9. **Kontextmenü** (langer Druck) — `bg/overlay`, `radius md`, 1 px
   `border/strong`, Innenabstand 6; Einträge Höhe 48 mit Icon 20 + `body`,
   gedrückt `bg/raised` + `radius sm`. Destruktiver Eintrag in `danger`
   (Icon + Text), **immer unten** und durch 1-px-Linie mit 6/10 Abstand
   abgesetzt.
10. **Primärer Button** — Höhe 52, `radius md`, `accent`, Text `title`/600
    16 in `on-accent`. Gedrückt `accent/pressed` + `scale 0.97`.
    Deaktiviert `bg/raised` + `border/subtle` + `text/tertiary`.
11. **Sekundärer Button** — Höhe 52 (44 in kompakten Zeilen), `radius md`,
    `bg/raised`, 1 px `border/strong`, Text in `text/primary`. Kompakt
    trägt `label` 13/500 + Icon 18, nicht `button` 16/600, damit zwei
    Aktionen nebeneinander passen.
12. **Textbutton** — nur `accent`-Text in `label`/600 13; Berührungsfläche
    mindestens 48 hoch.
13. **FAB** — 56 × 56, `radius lg`, `accent`, `plus` 24 in `on-accent`,
    unten rechts 16 vom Rand, 112 über der Unterkante (über der Tab-Bar,
    `withTabBar`). Entfällt im Auswahlmodus und auf leerer Bibliothek.
14. **Tab-Bar** — `bg/surface`, 1 px `border/subtle` oben, vier gleiche
    Spalten, Icon 24 + Label `caption`, `gap 4`, Innenabstand oben 8 /
    unten 8 plus Safe Area. Aktiv `accent` + `fill`-Icon, inaktiv
    `text/secondary` + `regular`.
15. **Sync-Indikator** — 2 px hohe Leiste direkt unter dem Header, Spur
    `bg/surface`. Sync läuft: Mint-Segment 38 % Breite, Opacity
    0.25 → 1 → 0.25 in 1400 ms. Ausstehende Änderungen: durchgehend
    `warning`. Synchron: nur Spur, unsichtbar. Bei Offline oder Sync-Fehler
    **ersetzt** der 36-px-Streifen (siehe Zustände) diese Leiste, er
    stapelt sich nicht darunter.
16. **Toast** — `bg/overlay`, `radius md`, 1 px `border/strong`, Höhe 56,
    Icon 20 links, `body`-Text, „Rückgängig" als Mint-Textbutton rechts
    (Höhe 40, Innenabstand 12). Schatten wie Sheets. Standzeit 5 s.
17. **Auswahl-Aktionsleiste** — ersetzt die Tab-Bar. `bg/raised` + 1 px
    `border/strong` (eine Flächenstufe höher als die Tab-Bar, damit der
    Modus auch unten sichtbar ist), vier Spalten Icon 24 + `caption`:
    Verschieben, Taggen, Favorit in `text/primary`, Löschen in `danger`.
18. **Skelett-Platzhalter** — Grundfläche `bg/surface`, `radius` wie das
    echte Element; Schimmer `linear-gradient(90deg, transparent, #1C2024,
    transparent)` von links nach rechts in 1600 ms linear. Zeile: Kachel
    44 × 44 + zwei Balken (14 px / 10 px, `radius xs`). Karte: 16:10-Fläche
    + zwei Balken. Nur die oberen drei Zeilen schimmern; weiter unten
    ruhige Platzhalter mit Opacity 1 → 0.6 → 0.3.

Zwei weitere Bausteine, in den Screen-Beschreibungen erkannt, ohne eigene
Inventar-Nummer: **`IconButton`** (48 × 48) und **`Switch`** (48 × 28,
Radius `pill`, Knopf 22 × 22, Innenabstand 3; an `accent` mit Knopf
`on-accent`, aus `border/strong` mit Knopf `text/secondary`).

Rahmen sind in allen Komponenten immer vorhanden und im Ruhezustand
durchsichtig (Zeile, Buttons), damit Auswählen oder Deaktivieren die Höhe
nicht um 2 ändert.

Geteilte Bausteine ohne eigenes Blatt, aus vorhandenen Teilen gebaut:
`ChoiceSheet`, `ScreenHeader` (`TitleHeader`/`CompactHeader`),
`HighlightedText`, `RenameSheet`, `SwipeRow`, `PillButton`, `SettingsList`,
`Slider` (PanResponder, keine Fremdbibliothek).

## Navigation & Screens

Expo Router, Bottom-Tabs mit vier Einträgen: **Bibliothek · Ordner · Tags ·
Einstellungen** (in `Tabs` aus `expo-router/js-tabs` mit eigener TabBar als
`tabBar` — in SDK 57 hängt `expo-router` nicht mehr an `@react-navigation`,
`Tabs` aus `expo-router` ist zugunsten von `js-tabs` abgekündigt). Favoriten
sind bewusst kein eigener Tab, sondern ein Filter innerhalb der Bibliothek —
sonst gibt es vier Wege zum selben Dokument.

Wichtige Screens als Push (ohne Tab-Bar): Viewer (`app/dokument/[id]`,
außerhalb von `(tabs)`), Ordner-Detail (`app/ordner/[name]`), Suche,
Papierkorb, Darstellung, Abnahme.

Jeder Screen unten mit Zweck, Aufbau und getroffenen Entscheidungen.
Referenz-ID = Anker im HTML-Prototyp `Kompendium.dc.html`.

### 1 · Bibliothek — Listenansicht (`1c`)

**Zweck:** Startbildschirm; Wiederfinden ist die häufigste Aufgabe.

**Aufbau von oben:**
- Header, Innenabstand 16 seitlich: „Bibliothek" als `display`, rechts zwei
  48 × 48-Icon-Buttons — Ansicht umschalten (`rows`/`squares-four`, aktive
  Ansicht mit `bg/raised` + `border/subtle` + `radius md` hinterlegt) und
  Sortieren (`arrows-down-up`).
- Sync-Indikator (2 px).
- Suchfeld, Abstand 16 nach oben. Tippen navigiert auf den Suchscreen (kein
  Inline-Fokus).
- Filter-Chip-Zeile, horizontal scrollbar, `gap 8`: „Alle" (aktiv) ·
  „★ Favoriten" (mit `star` 16) · die drei meistgenutzten Tags mit Farbpunkt,
  gezählt über den echten Bestand (siehe README). Ist der aktive Filter ein
  Tag außerhalb der drei, hängt er zusätzlich hinten an.
- **Sektion „Neu"** — eigener Rahmen: `accent/surface`, 1 px
  `accent/border`, `radius md`, Innenabstand 12. Kopf: `overline` in
  `accent` + Anzahl-Badge Mint + „Einsortieren" als Mint-Textbutton (wählt
  alle neuen Dokumente aus und öffnet das Verschieben-Sheet). Darunter
  horizontal scrollende Karten, Breite 148, `gap 10`; die dritte Karte ragt
  als 60 px breiter Anschnitt in den Rand, damit die Scrollbarkeit sichtbar
  ist. Dies ist der einzige Ort in der App, der Handlungsdruck erzeugen
  darf.
- **Sektion „Alle Dokumente"** — Sektionskopf mit Gesamtzahl rechts,
  darunter die vertikale Liste aus Dokumentzeilen.
- FAB unten rechts; Liste braucht unten 88 Innenabstand, damit nichts unter
  FAB und Tab-Bar liegt.

**Abweichung (Handoff):** Die Sektion „Zuletzt geöffnet" ist gestrichen.
Direkt über einer chronologisch sortierten Liste zeigte sie dieselben
Dokumente ein zweites Mal; „Alle Dokumente" führt jetzt mit Gesamtzahl.

**Umsetzung:** Der Bibliothek-Kopf schwebt als absolute Ebene über der
Liste, statt in ihr zu stehen: er schrumpft beim Scrollen von 68 auf 56 (s.
Screen 2), im Inhalt würde jeder Schrumpfschritt die Liste unter dem Finger
verschieben. Die Liste hält stattdessen einen festen oberen Innenabstand.
Alle Höhen des Kopfs stehen in `src/screens/library/metrics.ts`. Die
Filterleiste klebt nicht über `stickyHeaderIndices`, sondern über
`translateY` mit derselben Rechnung wie der mitgescrollte Inhalt
(`COLLAPSE_DISTANCE` = Suchfeld + Abstand + Schrumpfweg des Kopfs). Läuft
über Reanimated (`useAnimatedScrollHandler` + `useAnimatedStyle`). Die
2-px-Sync-Leiste bleibt in beiden Zuständen direkt unter der Kopfzeile,
nicht unter der geklebten Filterleiste (Abweichung von Blatt `1d`). Abstand
der beiden Kopf-Schaltflächen ist 8 statt 4 (Abweichung von Blatt `1c`) —
die harte Regel „mindestens 8 dp zwischen Berührungsflächen" wiegt
schwerer.

### 2 · Bibliothek — Kachelansicht, kollabierter Header (`1d`)

Zeigt zugleich den kollabierten Zustand: beim Scrollen wandert der Titel in
eine 56 px hohe Kopfzeile in `bg/surface` mit 1 px `border/subtle` unten,
`title` statt `display`; die Filterleiste klebt darunter mit (Chips auf
Höhe 36, dazwischen keine Stufe — schalten per React-Zustand von 40 auf 36).
Der Titelwechsel `display` → `title` ist eine Überblendung in einem
10-%-Fenster um die Hälfte des Scrollwegs.

Raster: zwei Spalten, `gap 16 / 12`, Seitenrand 16. Karten wie Komponente 2.
Die Sektion „Neu" erscheint hier nicht — sie gehört zur Listenansicht mit
ihrem großen Kopfbereich.

### 3 · Ordner-Übersicht (`3a`)

Kopf „Ordner" als `display` + Sortieren-Button. Darunter als **volle Zeile**
(Höhe 64, `bg/surface`, `radius md`, 1 px `border/subtle`): `books`-Icon 24,
„Alle Dokumente", Anzahl 247 als `caption`, `caret-right`. Es ist kein
Ordner und soll nicht wie einer aussehen.

Dann 2-Spalten-Raster der Ordner-Kacheln, `gap 12`, letzte Kachel
gestrichelt „Ordner anlegen". Die Ordnerfarbe trägt nur das Icon; ein
farbiger Kachelhintergrund würde mit den Dokumentkacheln konkurrieren.

Ordner haben keinen eigenen Ausweis: der Name IST der Ausweis — Umbenennen
muss deshalb zwei Speicher treffen (siehe [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md)).

### 4 · Ordner-Detail (`3b`)

Zurück-Pfeil und Überlauf-Menü in einer 56-px-Zeile ohne Titel. Darunter:
`folder` 32 in Ordnerfarbe, Name als `display`, „38 Dokumente · 12 MB" als
`caption`. Zwei kompakte Aktionen (Höhe 44, sekundär): „Für offline laden"
nimmt die breitere Fläche, „Bearbeiten" 100 px fest.

Beide Aktionen sind **sekundär** — der Ordner hat keine primäre Aktion, ein
Mint-Button für „Offline laden" hätte mehr Gewicht als die Sache verdient.
Offline gehaltene Dokumente zeigen es in der Metazeile mit `cloud-check` in
`accent` + „offline", nie durch Farbe allein.

Ergänzt (siehe README): darunter ein Suchfeld in der Form der Bibliothek —
nicht bedienbar, ein Tipp schiebt die Suche auf und setzt vorher den
Ordnerfilter. Der Filter-Chip in der Suche nennt dann den Ordnernamen und
bleibt abwählbar; „Alle Dokumente" setzt keinen Filter.

Dann der Sektionskopf mit der Bezeichnung der geltenden Sortierung („Zuletzt
geändert", „Titel", „Größe" oder „Zuletzt geöffnet") und rechts zwei
Schaltflächen: Ansichtsumschalter und `arrows-down-up`, das dasselbe
Sortier-Sheet öffnet wie in der Bibliothek. Darunter dieselbe Liste.

Ergänzt (siehe README): langer Druck auf eine Zeile öffnet dasselbe
Kontextmenü wie in der Bibliothek (Auswählen · Verschieben · Taggen · Favorit ·
Papierkorb). Im Auswahlmodus liegt die Auswahl-Kopfzeile über der 56-px-Zeile,
und die Auswahl-Aktionsleiste (Komponente 17) schwebt über dem unteren Rand —
hier gibt es keine Tab-Bar, die sie ersetzen könnte. Sonst steht dort ein FAB
„Dokument importieren"; ein Import aus einem Ordner heraus landet in diesem
Ordner, „Alle Dokumente" behält den Weg über „Neu".

Das Überlauf-Menü führt drei Einträge: „Ordner umbenennen", „Inhalt offline
behalten" und — ergänzt, siehe README — **„Ordner löschen"** mit `trash` in
`danger`. Gelöscht wird nur der Ordner; seine Dokumente landen in „Nicht
einsortiert". Danach schließt der Screen, und der Toast mit „Rückgängig" steht
in der Ordner-**Übersicht**, weil dieser Screen im selben Moment weg ist.

### 5 · Viewer — Bedienung eingeblendet (`2b`)

**Zweck:** Lesen; die App muss verschwinden.

- Dokument füllt den Bildschirm randlos, Bühne auf `bg/base` (verhindert
  weißes Aufblitzen beim Laden).
- **Header** 80 px hoch (inkl. Statusleiste), `rgba(14,16,18,0.72)` + Blur
  14, 1 px `rgba(38,44,49,0.8)` unten: Zurück-Pfeil, Titel `title`
  einzeilig mit Ellipse, Überlauf-Menü. Blendet beim Runterscrollen aus,
  kommt bei der ersten Aufwärtsbewegung zurück.
- **Schwebender Aktionsbalken** unten, 16 über der Safe Area zentriert:
  Höhe 60, `radius pill`, `rgba(35,40,45,0.92)` + Blur 14, 1 px
  `border/strong`, Schatten `0 −8 32 rgba(0,0,0,0.45)`. Vier Spalten je 64
  breit: Favorit · Tags · Teilen · Info, Icon 22 + Label 11/14
  (`labelSm`-Stufe).

**Abweichung (Handoff):** Der Balken trägt **Beschriftungen** unter den
Icons. Vier Symbole ohne Text sind im Dunkeln Ratearbeit, und die Regel
„jedes Bedienelement braucht eine sichtbare Beschriftung" gilt auch hier.
Favorit zeigt seinen Zustand doppelt: `fill`-Stern **und** Mint.

**Umsetzung:** Der Viewer liegt als Push-Screen unter
`app/dokument/[id].tsx`, außerhalb von `(tabs)` — er zeigt keine Tab-Bar.
Chrome-Autohide hängt am `onScroll` der WebView, Schwelle 8 px
(`theme/motion.scrollThreshold`); Kopfzeile und Balken fahren aus dem Bild
**und** werden durchsichtig — halbtransparent stehenbleiben wäre ein
dunkler Streifen auf hellem Papier. Web-Export: `react-native-webview` hat
keine Web-Umsetzung, deshalb `src/screens/viewer/DocumentView.web.tsx` mit
einem `iframe`; Chrome-Autohide ist im Web-Bild folglich nicht prüfbar.

**Teilen** gibt die Datei aus dem Cache weiter (`expo-sharing`), nicht den
Titel. Dokumente der Erstbefüllung haben keine Datei — dort öffnet weiter das
System-Sheet mit dem Titel, und der Toast sagt warum. **Links im Dokument**
gehen bei `http`/`https` in den Systembrowser; das Dokument bleibt stehen, wo
es steht. Schlägt das fehl, meldet es derselbe Toast — beides ohne
„Rückgängig", denn es gibt nichts zurückzunehmen.

**Überlaufmenü:** „Im Dokument suchen" (`magnifying-glass`) · „Umbenennen" ·
„Verschieben" · „Informationen" · Trenner · „In den Papierkorb"
(destruktiv). Der erste Eintrag ist eine Abweichung — kein Blatt sieht ihn
vor, aber bei einem 40-Seiten-Nachschlagewerk ist die Suche im geöffneten
Dokument die naheliegendste Erwartung.

**Suchen-Sheet** (`FindSheet`, Ebene über dem Dokument): dieselbe Form wie
das URL-Sheet aus dem Import — Titelzeile „Im Dokument suchen", fokussiertes
Feld mit 2 px `accent/border`, darunter eine Statuszeile mit der Zählung
„3 / 17" in Tabellenziffern und zwei 48er Icon-Buttons (`caret-up`,
`caret-down`) für Zurück und Weiter. Ohne Fundstelle steht dort „Nicht im
Dokument gefunden" — im Sheet selbst, nicht als Toast: die Antwort gehört zur
Eingabe, die noch dasteht. Das Sheet bleibt beim Blättern offen; Schließen
hebt die Hervorhebung auf.

Kommt der Viewer aus einem Suchtreffer (`/dokument/<id>?suche=…`), steht das
Sheet **eingeklappt** da: nur Zählung, Weiter/Zurück und der Textbutton
„Suchbegriff ändern". So ist erkennbar, warum das Dokument nicht oben
beginnt. Der Begriff gewinnt in diesem Fall gegen die gemerkte Leseposition;
gespeichert bleibt sie trotzdem.

Hervorgehoben wird die Fundstelle, die die WebView selbst zeichnet (Auswahl
über `window.find`) — kein eingespritztes Stylesheet, dieselbe Regel wie bei
der Textgröße.

### 6 · Viewer — reiner Lesemodus (`2c`)

Kopfzeile und Aktionsbalken verschwinden **vollständig**, nicht
halbtransparent — sonst bleibt ein dunkler Streifen über einem hellen
Dokument stehen. Der Griffbalken der Gestensteuerung wechselt auf
`rgba(26,26,26,0.35)`, weil er auf hellem Grund liegt.

### 7 · Info-Sheet (`2d`)

Bottom-Sheet über dem Viewer, Höhe 639 (≈ 75 %). Reihenfolge nach
Häufigkeit: **Titel** (echtes Eingabefeld mit `pencil-simple` — kein Sprung
in ein separates Umbenennen-Sheet, Umbenennen ist die häufigste Änderung),
**Ordner** (Zeile mit farbigem `folder` + `caret-right`), **Tags** (Chips
mit `x` + „+ Tag"-Chip), **Notiz** (Feld, min. 56, Platzhalter „Notiz
hinzufügen"), **Schalter „Offline behalten"** mit Untertitel „240 KB im
Cache", **Metadaten** (Importiert am, Größe, Geöffnet 12×, Zuletzt geöffnet,
Quelle) als
Label-Wert-Paare `label`, Werte in `text/primary`.

„In den Papierkorb" sitzt in `danger` (Icon + Text) hinter einer eigenen
Trennlinie am Fuß, **außerhalb** des scrollenden Bereichs — es darf nie
unter dem Daumen auftauchen, während man Tags setzt.

Schalter (Komponente `Switch`): 48 × 28, `radius pill`; an `accent` mit
Knopf `on-accent`, aus `border/strong` mit Knopf `text/secondary`; Knopf
22 × 22, Innenabstand 3.

**Umsetzung:** Titel und Notiz führen einen eigenen Zustand im Sheet und
melden gedrosselt nach außen (frühestens alle 600 ms, in jedem Fall beim
Verlassen des Feldes und beim Schließen) — sonst ging jeder Buchstabe in die
Datenbank und der Titel wanderte beim Tippen live in „Zuletzt geändert" nach
oben (siehe README).

**Umsetzung:** Info- und Tag-Sheet sind **keine** Modals, sondern absolute
Ebenen im Viewer (`SheetLayer` in `ui/BottomSheet.tsx`) — das Tag-Sheet
muss sich über das Info-Sheet legen, ohne es zu ersetzen, und der Toast muss
über beiden liegen; über Modal-Grenzen hinweg lässt sich das nicht
anordnen. `BottomSheet` (mit Modal) bleibt für eigenständige Screens.

### 8 · Suche — leer (`3c`)

Eigener Screen **ohne Tab-Bar**: die Tastatur belegt die untere Hälfte, eine
Navigationsleiste darunter wäre nur verdeckte Fläche.

Zurück-Pfeil + fokussiertes Suchfeld in einer Zeile. Darunter Sektion
„Zuletzt gesucht" — Chips Höhe 40 mit `clock-counter-clockwise` 16 + Begriff
in `body`, darunter der Textbutton „Verlauf leeren" (kompakt, linksbündig);
dann „Nach Tag suchen" mit Tag-Chips.

Der Verlauf ist echte Nutzung und überdauert den Neustart; er startet leer.
Die Sektion samt „Verlauf leeren" entfällt deshalb beim ersten Start
vollständig — der Screen beginnt dann direkt mit „Nach Tag suchen". Die drei
Begriffe der Zeichnung („annuität", „kündigungsfrist", „cloud") sind
Beispielbeschriftung, kein Startbestand.

Tastatur: `bg/raised` mit 1 px `border/subtle` oben, Vorschlagszeile 36
(mittlerer Vorschlag in `text/primary`, Trenner 1 × 16 `border/strong`),
Tasten Höhe 44 `radius xs` in `bg/overlay`, Funktionstasten `bg/raised` +
1 px `border/strong`. Die Absendetaste (`magnifying-glass` in `on-accent`)
ist die **einzige** Mint-Fläche; die Tastatur bleibt sonst neutral. In der
App ist dies die native Tastatur; die Zeichnung dokumentiert nur die
belegte Höhe (284 px) und die Absendetaste.

### 9 · Suche — Ergebnisse (`3d`)

Suchfeld gefüllt mit `x-circle`. Filterzeile: Ordner (aktiv, mit `x`), Tags
und Zeitraum als Dropdown-Chips mit `caret-down`. Dann Sektionskopf
„7 Treffer" mit Sortierhinweis „Relevanz" rechts.

Trefferzeile: Kachel 44 × 44, Titel `body` mit hervorgehobener Fundstelle,
Textausschnitt `body-sm` in `text/secondary` (maximal zwei Zeilen),
Fußzeile „Finanzen · vor 1 Woche" als `caption` in `text/tertiary`.

**Fundstellen sind mint hinterlegt** (`accent/surface`, `radius xs`,
Innenabstand 3) und mint gefärbt — auf dunklem Grund ist reine Textfarbe im
Fließtext schwer zu finden. Die Tastatur wird beim Absenden geschlossen,
damit drei vollständige Treffer sichtbar sind; der Begriff bleibt editierbar
im Feld.

**Umsetzung:** Die Suche geht über Titel, Ordner, Tag **und** den
Dokumenttext, damit die Trefferzeile einen echten Textausschnitt zeigen
kann.

Die Abfrage darf **mehrere Begriffe** tragen: an Leerzeichen zerlegt, alle
müssen zutreffen, jeder für sich in Titel, Ordner, Tag oder Text. Was in
Anführungszeichen steht, bleibt eine Wortgruppe. Umlaute werden gefaltet
(`ß→ss`, danach Akzente entfernt), „annuitat" findet also „Annuität" — die
Hervorhebung liegt trotzdem exakt auf dem Originalwort, weil die Faltung eine
zeichenweise Abbildung mitführt. Die Rangfolge bleibt Titel vor Tag/Ordner
vor reinem Text; bei mehreren Begriffen zählt der beste erreichte Rang.

Ein Tipp auf die Trefferzeile öffnet `/dokument/<id>?suche=<begriff>`: der
Viewer springt zur ersten Fundstelle, statt oben zu beginnen (siehe Screen 5).

### 10 · Suche — nichts gefunden (`3e`)

Aktive Filter bleiben oben sichtbar. Zentriert: Fläche 88 × 88
(`bg/surface`, `radius 24`, 1 px `border/subtle`) mit `magnifying-glass` 36
in `border/strong`; „Keine Treffer für „annuität"" als `title`; darunter
die Ursache in `body`/`text/secondary`: „Zwei Filter sind aktiv. Ohne
Ordner- und Zeitfilter gibt es 7 Treffer."; primärer Button „Filter
zurücksetzen".

Die Leerdarstellung nennt Ursache und Trefferzahl ohne Filter — „Nichts
gefunden" allein lässt offen, ob das Dokument fehlt oder der Filter zu eng
ist.

Bei **mehreren Begriffen** steht darunter ein zweiter Satz in derselben
Schrift: „„annuität" allein: 12 Treffer". Er beantwortet die Frage, die sich
sonst stellt — welches Wort war zu viel? Nur dieser eine Zusatz, keine eigene
Fläche.

### 11 · Tag-Verwaltung (`3f`)

Kopf „Tags" als `display`; „+ Neuer Tag" als **sekundäre Pille** (Höhe 40)
im Kopf, nicht als FAB — Tags entstehen beim Zuweisen (siehe Kernflow), ein
Mint-FAB gäbe diesem Screen falsches Gewicht.

Zeilen Höhe 60, ganze Breite, Trennlinie unten: Farbpunkt 10 × 10, Name
`body`, Anzahl `caption`, `caret-right`. Wischen nach links legt zwei
Aktionen frei: „Umbenennen" 88 breit in `bg/raised`, „Löschen" 72 breit in
`rgba(248,113,113,0.14)` mit `danger`-Icon und -Label; beide mit Icon
**und** Wort (88 statt 48, weil das Label sonst umbricht). Die freigelegte
Zeile bleibt auf `bg/base`.

Wischen ist nur eine Abkürzung — dieselben Aktionen liegen hinter dem
Chevron. Hinweiszeile am Listenende sagt das explizit.

### 12 · Import-Sheet (`3g`)

Drei gleichwertige Auswahlflächen untereinander, `gap 12`: `bg/raised`,
`radius md`, 1 px `border/strong`, Innenabstand 18/16; Icon 24 in `accent`,
Titel `title`, Erklärung `body-sm` in `text/secondary`, `caret-right`.

- **Datei wählen** — „HTML-Datei vom Gerät" (`file-html`)
- **Aus Zwischenablage** — „HTML-Code einfügen" (`clipboard-text`)
- **Von URL laden** — „Adresse eingeben" (`link-simple`)

Keine der drei ist als Mint-Button ausgezeichnet — sie sind gleichwertige
Wege, eine Vorauswahl wäre geraten. Mint trägt nur das Icon. Fußnote:
„Importierte Dokumente landen in „Neu", bis sie einsortiert sind."

**Umsetzung:** Die drei Wege wirken vollständig (`expo-document-picker`,
`expo-clipboard`, `fetch` mit eigenem Eingabe-Sheet für die URL). Der
Prototyp endet bei der Auswahlfläche, das URL-Eingabe-Sheet ist eine eigene
Ergänzung aus vorhandenen Teilen. Ergänzt ist außerdem eine Rückfrage bei
einem Duplikat (gleicher Titel und gleiche Größe in Bytes): im
Kontextmenü-Muster wie „Papierkorb leeren", oben die Hinweiszeile mit dem
Titel des vorhandenen Dokuments (`warning-circle`, nicht bedienbar), darunter
„Trotzdem importieren". Abbrechen schließt ohne Meldung (siehe README).

### 13 · Mehrfachauswahl (`3h`)

Header wird zu `bg/surface` mit 1 px `border/subtle` unten: „3 ausgewählt"
als `title` mit Tabellenziffern, rechts zwei Mint-Textbuttons — ergänzt (siehe
README) „Alle auswählen" (bzw. „Auswahl aufheben", sobald alles gewählt ist)
und daneben „Abbrechen". Der Sammelgriff wirkt nur auf die gerade sichtbare,
gefilterte Liste.

Zeilen mit Mint-Checkbox 24 × 24 links (`radius xs`); ausgewählte Zeilen
`accent/surface` + `accent/border`. **Nicht** gewählte Zeilen behalten ein
leeres Kästchen (2 px `border/strong`), damit erkennbar bleibt, dass sie
auswählbar sind. Tab-Bar wird durch die Auswahl-Aktionsleiste ersetzt; der
FAB verschwindet, weil Importieren hier keine sinnvolle Aktion ist.

**Umsetzung:** Die Auswahl-Aktionsleiste lebt im Tab-Rahmen
(`app/(tabs)/_layout.tsx`), die Sheets und der Toast aber in der
Bibliothek; verbunden über `request` im Bibliothek-Zustand — die Leiste legt
einen Wunsch ab, die Bibliothek führt ihn aus und räumt ihn weg. Die
sichtbaren Ausweise für „Alle auswählen" gibt der Screen von außen in die
Kopfzeile; dieselbe Kopfzeile benutzt das Ordner-Detail.

### 14 · Einstellungen (`3i`)

Gruppierte Liste; Gruppen als `bg/surface`-Blöcke mit `radius md`, 1 px
`border/subtle`, interne Trennlinien `border/subtle`, Zeilenhöhe 56–60,
Innenabstand 14. Gruppenüberschriften als `overline`.

- **Synchronisierung** — Statuszeile (`cloud-check` in `accent`,
  „Synchron", „zuletzt 21:44"), darunter „Jetzt synchronisieren" als
  Mint-Textzeile.
- **Speicher** — „1,4 GB belegt / von 3 GB", darunter ein 8 px hoher Balken
  (`radius pill`, Spur `bg/raised`) aus zwei Segmenten: 38 % `accent` =
  offline behalten, 8 % `border/strong` = Cache, mit Legende. Ohne diese
  Trennung wirkt „Cache leeren" wie Datenverlust. Dann „Offline behaltene
  Dokumente: 12" mit Chevron und „Cache leeren" als Mint-Textzeile.
- **Papierkorb** (mit Anzahl), **Darstellung**, **Über** (Version 1.4.0)
  stehen ohne Gruppenüberschrift zusammen — drei Einzelziele brauchen keine
  drei Überschriften.

Aktionen sind Mint-**Text**, keine Buttons, damit die Liste eine Liste
bleibt.

**Umsetzung:** Der Speicherbalken zeigt echte Zahlen aus dem Bestand
gerechnet statt der 46 % aus dem Blatt (siehe [README.md](README.md),
Abweichungen).

### 15 · Papierkorb (`6a`)

Erreichbar aus Einstellungen. Kopfzeile 56 mit Zurück-Pfeil, „Papierkorb"
als `title`, „Auswählen" als Mint-Textbutton. Darunter ein
36-px-Hinweisstreifen (`bg/raised`, Linien oben und unten) mit
`clock-countdown`: „Wird nach 30 Tagen endgültig gelöscht".

Sektionskopf „6 Dokumente" mit Gesamtgröße rechts. Zeilen wie die
Dokumentzeile, aber: Kachel gedämpft, Titel in `text/secondary`, Metazeile
„gelöscht vor 2 Tagen · 28 Tage übrig". Restfrist unter drei Tagen wechselt
auf `warning` **mit** `warning`-Icon. Rechts je Zeile „Wiederherstellen"
(`arrow-counter-clockwise` in `accent`) als eigenes 48 × 48-Ziel — Wischen
wäre hier zu riskant.

Am Fuß der Liste „Papierkorb leeren" als sekundärer Button mit
`danger`-Icon und -Text, nicht als roter Block: die Aktion ist unumkehrbar
und soll nicht der auffälligste Punkt des Screens sein.

### 16 · Darstellung (`6b`)

Erreichbar aus Einstellungen. Drei Gruppen:

- **Bibliothek** — „Standardansicht" als Zweier-Segment (Liste/Kacheln,
  Höhe 44, `radius sm`; aktiv `accent/surface` + `accent/border` +
  `fill`-Icon), darunter „Sortierung" als Vierer-Segment („Zuletzt", „Titel",
  „Größe", „Geöffnet")
  (Zuletzt/Titel/Größe).
- **Lesen** — „Textgröße im Viewer" mit Wert 110 % rechts, Regler (Spur 4
  px `bg/raised`, Füllung `accent`, Knopf 24 mit 3 px `bg/surface`-Ring),
  Skalenenden 90 %/150 %, darunter eine **echte Vorschau** auf hellem
  Papier (`#F6F5F1`, Georgia 17/27, `radius sm`) — der Regler wirkt in
  fremden Dokumenten, nicht in der App. Dann Schalter „Dokumente abdunkeln
  — Helle Seiten leicht dämpfen" und „Bildschirm anlassen — Beim Lesen
  nicht sperren".
- **App** — „Farbschema / Dunkel — einziger Modus" als **nicht bedienbare**
  Zeile mit `moon`-Icon in `text/tertiary`, damit niemand den Schalter
  sucht. „Bewegung reduzieren — Folgt der Systemeinstellung".

**Abweichung (Handoff):** „Dokumente abdunkeln" ist eine Ergänzung. Bei
Nutzung im Dunkeln ist die weiße Dokumentseite die eigentliche Belastung;
ein globales Dämpfen ist ehrlicher als eine Einstellung pro Dokument.
Umgesetzt als Overlay `rgba(0,0,0,0.18)` über der WebView, keine
Farbinvertierung.

### 17 · Sheet — Ordner anlegen (`6c`)

Aus der Ordner-Übersicht (gestrichelte Kachel). Sheet-Aufbau: Titelzeile
„Ordner anlegen", **Name** (fokussiertes Feld), **Farbe** — sechs Kacheln
48 × 48 (`radius md`) mit `folder` 22 in der jeweiligen Farbe; ausgewählt
doppelt markiert durch 12 %-Fläche **und** 2 px Rand in 50 % der Farbe,
nicht durch Farbe allein. Sechs statt acht Farben: mehr Auswahl macht
Ordner nicht unterscheidbarer, und in dieser Zahl bleiben die Kacheln
48 dp breit.

Dann Schalter „Inhalt offline behalten — Gilt für alles in diesem Ordner"
zwischen zwei Linien, primärer Button „Anlegen", darunter „Abbrechen" als
sekundärer Textbutton (Höhe 56). Im Betrieb schiebt die Tastatur über den
Fuß; „Anlegen" scrollt darum als letztes Element im Sheet mit.

### 18 · Sheet — Umbenennen (`6d`)

Aus der Tag-Verwaltung (Wischen oder Chevron); identisch für „Ordner
bearbeiten". Das Sheet sitzt **über** der Tastatur (Unterkante 284) und
bleibt vollständig sichtbar — kein verdeckter „Speichern"-Button.

Aufbau: Titelzeile „Tag umbenennen", darunter eine unveränderliche
Kontextzeile (Höhe 44, `bg/raised`, 1 px `border/strong`) mit Farbpunkt,
altem Namen und „12 Dokumente" — damit erkennbar bleibt, was umbenannt wird
und wie viele Dokumente betroffen sind. Dann „Neuer Name" als fokussiertes
Feld mit `x-circle`, Hinweiszeile mit `info` 14: „Wirkt auf alle 12
Dokumente mit diesem Tag". Fuß: „Abbrechen" (120 breit, sekundär) **neben**
„Speichern" (Rest, primär) — bei aufgeschlagener Tastatur ist Höhe knapp.
Die Absendetaste der Tastatur zeigt `check`.

### 19 · Leere Bibliothek — Erststart (`4a`)

Zentriert: eine gezeichnete Leerdarstellung — ein leeres Regal aus einer
Bodenplatte (132 × 10, `bg/raised`, 1 px `border/subtle`) und vier
stehenden „Bänden" (22 breit, Höhen 56/72/46/64, `bg/surface`, 1 px
`border/subtle`, einer um 6° gekippt). Sie besteht aus denselben Flächen
und Linien wie die App, hat also keine eigene Bildsprache.

Darunter „Noch keine Dokumente" als `title-lg`, ein Satz Erklärung in
`body`/`text/secondary`, primärer Button „Erstes Dokument importieren".
Kein FAB (der Button trägt dieselbe Aktion). Ordner und Tags in der Tab-Bar
auf `text/tertiary` — ohne Dokumente führen sie nur in weitere leere
Screens; Kopf ohne Ansicht- und Sortier-Schaltfläche, ohne Chips.

### 20 · Ladezustand (`4b`)

Kopfzeile, Suchfeld und Tab-Bar stehen bereits; nur die Liste lädt, das
Layout springt beim Eintreffen der Daten nicht. Filter-Chips als graue
Pillen ohne Text, Sektionskopf als 12 × 120-Balken. Sechs Skelett-Zeilen,
Abstand 20; Schimmer nur auf den oberen drei, danach Opacity
1 → 0.6 → 0.3, damit die Bewegung nicht den ganzen Screen erfasst. Kein
Vollbild-Spinner. Sync-Indikator pulsiert.

**Umsetzung:** LibraryScreen hat drei Betriebsarten (loading/empty/ready)
mit identischem Aufbau, damit nichts springt; `metrics.contentTop(hasNotice)`
hält den oberen Innenabstand nach. `app/_layout.tsx` wartet nur noch auf die
Schrift, nicht mehr auf die Datenbank — die Bibliothek zeigt ihren
Ladezustand über `hydrated`.

### 21 · Offline und Sync-Fehler (`4c`)

Ein 36 px hoher Streifen direkt unter dem Header, Linien oben und unten,
**ersetzt** den 2-px-Sync-Indikator (zwei Leisten übereinander wären ein
Bruch).

- **Offline:** `bg/raised`, `wifi-slash` 16 + „Offline — 12 Dokumente
  verfügbar" in `text/secondary`. Neutral, weil Offline kein Fehler ist.
- **Sync-Fehler:** `rgba(251,191,36,0.14)`, `warning` in `fill` + „Sync
  fehlgeschlagen" in `warning`, rechts „Wiederholen" als Mint-Textbutton.

Nicht geladene Dokumente bleiben in der Liste sichtbar und deaktiviert
(Kachel entsättigt, Meta „nicht geladen" mit `cloud-slash`), statt zu
verschwinden.

**Umsetzung:** `ui/NoticeStrip.tsx` (36 px) plus `useNotice()` in
`state/notice.ts` entscheiden, welcher der beiden Streifen gilt — Offline
geht vor Sync-Fehler. `isUnavailable(document, isOnline)` in
`data/library.ts` ist die eine Regel für „nicht zu öffnen":
`!cached UND !isOnline`; vier Listen und der Viewer lesen sie.

### 22 · Dokument nicht im Cache und offline (`4d`)

Eigene Ansicht **im Viewer** statt weißer WebView: Screen bleibt auf
`bg/base`, Kopfzeile behält Titel und Zurück-Pfeil, damit klar ist, welches
Dokument gemeint ist. Zentriert: Fläche 88 × 88 mit `cloud-slash` 36,
„Offline nicht verfügbar" als `title-lg`, Erklärung in `body`, dann
primärer Button „Erneut versuchen" (`arrow-clockwise`) und sekundärer „Für
offline vormerken" (`download-simple`); unten eine Metazeile „Zuletzt
geöffnet vor 6 Tagen · 88 KB".

**Abweichung (Handoff):** „Für offline vormerken" ist ergänzt. Ohne diese
zweite Aktion wiederholt sich derselbe Fehlschlag bei jedem
Offline-Versuch, ohne dass der Nutzer etwas dagegen tun kann. Die Metazeile
zeigt, dass das Dokument existiert und nur der Inhalt fehlt.

Screen 4d ist nur erreichbar, indem ein ungecachtes Dokument mit Netz
geöffnet wird und die Verbindung danach ausfällt — aus der Liste heraus ist
eine nicht geladene Zeile absichtlich gesperrt. Ein Viewer-Aufruf, der nur
die Fehlermeldung zeigt, zählt **nicht** als Öffnen (wirkt sich also nicht
auf `open_count`/`last_opened_at` aus).

---

## Interactions & Behavior

**Navigation**
- Tab-Bar mit vier Zielen: Bibliothek, Ordner, Tags, Einstellungen.
  Suchscreen, Viewer, Ordner-Detail, Papierkorb und Darstellung liegen als
  Push-Screens darüber; Suche und Viewer zeigen **keine** Tab-Bar.
- Bibliothek → Dokumentzeile antippen: Zeile skaliert 100 ms auf 0.97, dann
  schiebt der Viewer von rechts ein (`standard`).
- Suchfeld in der Bibliothek antippen: Push auf den Suchscreen, Feld dort
  sofort fokussiert.
- Zurück überall über Pfeil links oben plus System-Zurück.

**Viewer**
- Header und Aktionsbalken blenden beim Runterscrollen aus (`exit`), kommen
  bei der ersten Aufwärtsbewegung zurück (`standard`). Schwelle: 8 px
  Scrolldelta, damit Mikrobewegungen nichts auslösen.
- Favorit im Balken schaltet sofort um, ohne Toast (Zustand ist am Icon
  sichtbar). Tags und Info öffnen Sheets, Teilen das System-Share-Sheet.

**Sheets**
- Öffnen mit Spring (damping 22, stiffness 260), Scrim blendet über 220 ms
  ein. Schließen per `x`, Scrim-Tap oder Nach-unten-Wischen.
- Das Tag-Sheet legt sich **über** das Info-Sheet, ersetzt es nicht: beim
  Schließen liegt der Nutzer wieder in den Dokumentdaten, nicht im Viewer.

**Mehrfachauswahl**
- Start: langer Druck auf eine Zeile (öffnet zunächst das Kontextmenü mit
  „Auswählen") oder „Auswählen" im Papierkorb-Header. Header und Tab-Bar
  wechseln in 220 ms per Crossfade, ohne Layoutversatz.
- Aktionen wirken sofort, Toast mit „Rückgängig" (5 s). Löschen verschiebt
  in den Papierkorb, keine Bestätigung.

**Tag zuweisen (Kernflow, `4e`)**
1. Bibliothek: Zeile antippen → Viewer.
2. Viewer: „Info" im Aktionsbalken → Info-Sheet federt auf 75 %.
3. Info-Sheet: „+ Tag" → Tag-Sheet mit Suchfeld und Fokus.
4. Tippen filtert die Tag-Liste, Fundstellen mint hinterlegt; Antippen
   setzt das Tag sofort (Checkbox füllt sich), Toast „Tag „Quartal" gesetzt"
   mit „Rückgängig". Erster Eintrag unter den Treffern ist immer
   „„…" als neuen Tag anlegen" — hier entstehen neue Tags.

Vier Tipps, **kein Bestätigungsdialog**: Zuweisen ist reversibel, also
trägt der Toast die Absicherung statt eines „Speichern"-Buttons.

**Wischgesten** sind immer nur Abkürzungen: In der Tag-Verwaltung liegen
„Umbenennen" und „Löschen" zusätzlich hinter dem Chevron.

**Ladeverhalten**
- Liste: Skelett-Zeilen, kein Vollbild-Spinner. Eintritt der echten Zeilen
  versetzt um 35 ms, maximal acht Elemente.
- Viewer: Bühne bleibt `bg/base`, bis das HTML gerendert ist.

**Fehler und Leere**
- Offline: Streifen unter dem Header; nicht gecachte Dokumente deaktiviert,
  aber sichtbar.
- Sync-Fehler: derselbe Streifen in `warning` mit „Wiederholen".
- Suche ohne Treffer: Ursache benennen, „Filter zurücksetzen" als primäre
  Aktion.
- Leere Bibliothek: Regal-Zeichnung, ein Satz, ein Button.

**Responsives Verhalten**
Nur Breite 360–430 dp. Alles skaliert über Flex; feste Werte sind nur
Kachelgrößen (44), Berührungsflächen (48) und der FAB (56). Bei 360 dp
bleiben die zweispaltigen Karten ≥ 160 breit. Keine Landscape-Optimierung;
Tabletlayouts sind ausdrücklich nicht Teil des Auftrags.

## State Management

Zustände, die die UI braucht:

- **Bibliothek:** `viewMode: 'list' | 'grid'`, `sort: 'recent' | 'title' | 'size'`,
  `activeFilter: 'all' | 'favorites' | tagId`, `headerCollapsed: boolean`
  (aus Scrolloffset), `selectionMode: boolean`, `selectedIds: Set<string>`.
- **Dokument:** `id`, `title`, `folderId | null`, `tagIds[]`, `note`,
  `isFavorite`, `keepOffline`, `isCached`, `sizeBytes`, `importedAt`,
  `updatedAt`, `openCount`, `lastOpenedAt`, `source: 'file' | 'clipboard' | 'url'`,
  `docType: 'table' | 'chart' | 'text' | 'calculator' | 'list'`, `deletedAt | null`.
- **Sync:** `status: 'idle' | 'syncing' | 'pending' | 'error'`, `lastSyncedAt`
  — steuert Sync-Indikator und Streifen.
- **Netz:** `isOnline` (NetInfo) — steuert Offline-Streifen und die
  Viewer-Ansicht ohne Cache.
- **Suche:** `query`, `recentQueries[]`, `filters: { folderId, tagIds[], period }`,
  `results[]` mit Trefferausschnitten und Fundstellen-Offsets,
  `state: 'empty' | 'results' | 'none'`.
- **Viewer:** `chromeVisible: boolean`, `scrollPosition` (pro Dokument
  persistieren und beim Öffnen wiederherstellen), `activeSheet: null | 'info' | 'tags' | 'move'`.
- **Darstellung:** `viewerTextScale: 0.9–1.5`, `dimDocuments: boolean`,
  `keepScreenOn: boolean`, `reduceMotion` (System).
- **Speicher:** `cacheBytes`, `offlineBytes`, `quotaBytes`, `offlineCount`,
  `trashCount`.

Datenfetching: lokale Datenbank ist die Wahrheitsquelle (Liste, Metadaten,
Tags, Ordner), Sync läuft im Hintergrund; die Liste rendert immer aus dem
lokalen Bestand, damit sie offline vollständig funktioniert. Details zum
Schema: [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).

## Harte Regeln (Abnahmekriterien)

- Berührungsflächen mindestens **48 × 48 dp**, mindestens 8 dp Abstand
  zueinander.
- Fließtext nie unter **16 px**, Metadaten nie unter 12 px.
- Kontrast gegen die **jeweilige Flächenstufe** geprüft, nicht gegen
  `bg/base`: `text/primary` und `text/secondary` ≥ 4.5:1, Icons ≥ 3:1.
- Farbe trägt **nie** allein Bedeutung: Favorit = Stern *und* Mint; Fehler =
  Icon *und* Rot; offline = Wolkensymbol *und* Text; ausgewählt = Häkchen
  *und* Fläche.
- Safe Areas oben und unten respektieren; feste Leisten dürfen niemals
  Inhalt verdecken — Listen brauchen unten 88 Innenabstand (FAB + Tab-Bar).
- Genau **eine** primäre Aktion pro Screen.
- Alle Bedienelemente brauchen eine sichtbare oder vorgelesene Beschriftung
  (`accessibilityLabel`). Wischgesten sind immer nur Abkürzung.
- Keine Illustration, kein Verlauf, keine Animation ohne
  Ursache-Wirkung-Bezug. Keine Emojis.

## Assets

Keine Bilddateien. Alles ist Typografie, Fläche, Linie und Icon-Font:

- **Inter** (400/500/600/700) — lokal eingebunden (`expo-font`,
  `@expo-google-fonts/inter`).
- **Phosphor Icons**, `regular` und `fill` — im Projekt `phosphor-react-native`.
- **Kachelmuster** werden generiert (siehe „Die Kachel"), keine Assets.
- **Beispieldokumente** im Viewer sind Platzhalterinhalt (helles Papier
  `#F6F5F1`, Georgia, Akzent `#9A7B2F`, `src/data/sampleDocumentHtml.ts`) und
  **nicht** Teil des Designsystems.

## Referenz — Anker im Original-Prototyp

`Kompendium.dc.html`, sechs Abschnitte, neueste Runde oben; Anker-IDs
entsprechen den Referenz-IDs in den Screen-Beschreibungen oben:

| ID | Inhalt |
|---|---|
| `1a` | Token-Übersicht (Farben, Typo, Abstände, Radien, Icons, Bewegung) |
| `1b` | Kachel-System — 5 Typ-Muster × 3 Farbtöne, 44-dp-Variante |
| `1c` `1d` | Bibliothek — Liste / Kacheln mit kollabiertem Header |
| `2a` | Komponenten-Blatt — alle 18 Komponenten in allen Zuständen |
| `2b` `2c` | Viewer — mit Bedienung / reiner Lesemodus |
| `2d` | Info-Sheet |
| `3a` `3b` | Ordner-Übersicht / Ordner-Detail |
| `3c` `3d` `3e` | Suche — leer / Ergebnisse / nichts gefunden |
| `3f` | Tag-Verwaltung |
| `3g` | Import-Sheet |
| `3h` | Mehrfachauswahl |
| `3i` | Einstellungen |
| `4a`–`4d` | Zustände — leer, laden, offline und Sync-Fehler, kein Cache |
| `4e` | Flow-Blatt — Bibliothek → öffnen → Info-Sheet → Tag zuweisen |
| `5a` `5b` | Register und Sammlung der Abweichungen |
| `6a`–`6d` | Papierkorb, Darstellung, Sheet „Ordner anlegen", Sheet „Umbenennen" |

## Prüfung

```bash
npm run lint:tokens   # keine freihaendigen Hex-Codes/Schriftgroessen ausserhalb src/theme
```

Für den visuellen Soll-Ist-Vergleich per Screenshot siehe
[README.md](README.md) (`npx expo export --platform web` + `scripts/shots*.mjs`).
