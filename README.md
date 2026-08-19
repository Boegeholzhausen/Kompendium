# Kompendium — App

Persönliche Bibliothek für selbstgebaute HTML-Dokumente.
React Native / Expo SDK 57 (React Native 0.86), Android-first, mobile only,
Dark Mode only.

## Über die App

Der Nutzer lässt sich am PC laufend HTML-Dateien generieren — Analysen,
Übersichten, Rechner, Nachschlagewerke, Reports —, die sich sonst über
Downloads-Ordner und Chats verstreuen. Kompendium sammelt sie an einem Ort,
macht sie am Handy lesbar und lässt sie in Ordner, Favoriten und einen
Workflow-Status (gelesen/archiviert) sortieren. Der Nutzer ist gleichzeitig Autor und Leser seiner eigenen
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
Chrome-Autohide und Info-Sheet, Ordner-Übersicht und -Detail, den
Workflow-Status per Wischgeste, Suche, Import (Datei/Zwischenablage/URL),
Mehrfachauswahl,
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
Handoff-Dokument. Mit dem Wegfall der Tags sind daraus drei Ziele geworden:
Bibliothek/Ordner/Einstellungen (siehe "Abweichungen").

## Supabase

1. Projekt anlegen, unter *Project Settings > API* die URL und den
   Publishable/Anon Key kopieren, in `.env` eintragen.
2. `supabase/schema.sql` im SQL-Editor ausführen. Das Skript ist idempotent —
   bei einem bestehenden Projekt einfach erneut laufen lassen, es ergänzt
   fehlende Spalten (zuletzt `documents.source_path`).
3. Unter *Authentication > Sign In / Providers* **Anonymous sign-ins**
   aktivieren — die App meldet sich ohne Login-Screen an.

Ohne `.env` startet die App trotzdem und läuft rein lokal — dann bleibt der
Beispiel-Bestand aus `src/data/sampleLibrary.ts` die Bibliothek. **Mit** `.env`
tritt er ab: die App legt beim ersten Abgleich einen sauberen Schnitt und baut
den Bestand aus Supabase auf. Vollständiges Schema, Setup-Schritte im Detail
und Sync-Strategie: [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).

### Dokumente vom PC hochladen

Der Bestand entsteht am Rechner. `scripts/upload.mjs` liest einen Ordner mit
HTML-Dateien, lädt jede in den Storage-Bucket und legt ihre Zeile an:

```bash
cp .env.local.example .env.local   # Service-Role-Key eintragen
npm run upload -- "C:\Pfad\zu\deinen\HTML-Dateien" --dry   # nur zeigen
npm run upload -- "C:\Pfad\zu\deinen\HTML-Dateien"         # wirklich laden
```

`--dry` läuft auch ohne Zugangsdaten und zeigt, welcher Titel und welche Kachel
erkannt würden. Ein zweiter Lauf über denselben Ordner lädt nichts erneut hoch
(Wiedererkennung über `source_path`, Änderung über `content_hash`).

**Reihenfolge beim ersten Mal:** erst die App einmal auf dem Handy starten —
sie meldet sich anonym an und legt damit die Identität an, unter der die
Dokumente liegen. Ohne sie hat das Skript keine `owner_id` und sagt das auch.

Der Service-Role-Key in `.env.local` umgeht RLS vollständig. Er gehört auf den
Rechner und niemals in die App — warum das Skript ihn trotzdem braucht, steht
in [DATABASE_STRUCTURE.md](DATABASE_STRUCTURE.md).

## Struktur

```
app/(tabs)/           Bibliothek, Ordner, Einstellungen
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
scripts/shots6.mjs    Screenshots der Ordner-/Such-/Import-Screens
scripts/shots7.mjs    Screenshots der Einstellungen, inkl. Import
scripts/shots8.mjs    Screenshots der Lade-/Fehler-/Leerzustände
src/data/detect.ts    Titel- und Typerkennung — geteilt mit dem Upload-Skript
src/data/remote/      Abgleich: Abruf (pull), Push (Outbox), Dateien
scripts/upload.mjs    Weg vom PC: HTML-Ordner nach Supabase
supabase/schema.sql   Datenbankschema für den Sync
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

Aus demselben Grund ist die **gemerkte Leseposition** im Web-Bild nicht
prüfbar: ohne lesbaren Scrollversatz gibt es nichts zu merken. Und weil
`repository.web.ts` im Arbeitsspeicher läuft, fängt jeder Seitenaufruf mit dem
Beispiel-Bestand an — ein **Neustart** lässt sich damit ebenfalls nicht
nachstellen. Dass Leseposition und Suchverlauf ihn überdauern, ist also nur auf
dem Gerät zu prüfen; im Browser ist nur zu sehen, dass der Verlauf leer
startet, sich füllt und sich über „Verlauf leeren" wieder räumen lässt.

**„Im Dokument suchen" ist im Web-Export nicht prüfbar.** Der Auftrag läuft
über `injectJavaScript` der nativen WebView; in ein fremdes `iframe` lässt
sich von außen nichts einspritzen. Im Web-Bild sind deshalb nur Menüeintrag,
Sheet und die eingeklappte Form aus einem Suchtreffer zu sehen — die Zählung
steht dort immer auf „Nicht im Dokument gefunden". Ob wirklich gesprungen und
hervorgehoben wird, ist nur auf dem Gerät zu prüfen.

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
Titel, Ordner und den Volltext aus beiden Quellen; der Index wird nach
dem Start einmal warmgelaufen.

**Teilen** gibt die Datei weiter, nicht den Titel: `expo-sharing` bekommt den
`file://`-Pfad aus dem Cache (`cache.documentUri`). Dokumente der Erstbefüllung
haben keine Datei — dort bleibt es beim System-Sheet mit dem Titel, und der
Toast sagt warum. Im Web-Export gibt es keinen Dateipfad, `documentUri` liefert
dort immer `null`.

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
  Blatt `1c` `syncing`. Seit es die Outbox gibt, ist das keine Annahme mehr,
  sondern eine Auskunft: `hydrateStores()` zählt die offenen Einträge und
  setzt `idle`, wenn keiner übrig ist.
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
- **Sync-Fehler** entsteht beim Abgleich ohne Netz und wenn eine Zeile beim
  Hochschicken scheitert. Der Eintrag bleibt dann in der Outbox stehen und
  wird beim nächsten Lauf erneut versucht.
- **Leere Bibliothek ohne Kopf-Schaltflächen:** Ansicht umschalten und
  Sortieren entfallen, es gibt nichts anzuordnen.
- **Spalte `last_opened_at`** (Schema-Version 2, mit Migration für vorhandene
  Datenbanken). Blatt `4d` nennt "Zuletzt geöffnet vor 6 Tagen"; `updated_at`
  wäre dafür die falsche Angabe, denn Lesen ändert nichts. Vorhandene Zeilen
  bekommen `NULL`.
- **"Erneut versuchen"** meldet ohne Netz "Keine Verbindung" als Toast, statt
  eine Ladeanzeige zu zeigen, hinter der nichts passiert.
- **Ordner löschen** ist im Handoff-Dokument nicht vorgesehen; ohne die Aktion
  ist ein Ordner eine Einbahnstraße — ein versehentlich angelegter bleibt für
  immer stehen. Die Dokumente darin werden nie mitgelöscht, sie landen in
  "Nicht einsortiert". Der zugehörige Toast mit "Rückgängig" steht in der
  Ordner-**Übersicht**, nicht im Detail: das Löschen schließt den Detail-Screen,
  ein Toast dort wäre im selben Moment mit ihm weg.
- **Externe Links im Dokument** öffnen `http`/`https` im Systembrowser
  (`expo-linking`), statt sie wie bisher stumm zu blocken. `about:` (samt
  Ankern für ein eigenes Inhaltsverzeichnis) läuft weiter in der WebView, alles
  andere bleibt geblockt.
- **Der Papierkorb räumt beim Start auf:** alles, was länger als 30 Tage darin
  liegt, wird endgültig gelöscht — Datenbankzeile und Cache-Datei. Ohne den
  Lauf stünden Zeilen dauerhaft auf "0 Tage übrig" und widersprächen dem
  Hinweisstreifen aus Blatt `6a`.
- **Der Suchverlauf startet leer.** Blatt `3c` zeigt "annuität",
  "kündigungsfrist" und "cloud" unter "Zuletzt gesucht" — das ist eine
  Beschriftung der Zeichnung, keine Nutzung. Eine App, die beim ersten Start
  eine Suchvergangenheit behauptet, die es nicht gibt, macht eine
  Falschaussage. Ergänzt ist deshalb ein "Verlauf leeren" unter der Chip-Reihe:
  ein Verlauf, den man nicht loswird, gehört dem Nutzer nicht.
- **Leseposition und Suchverlauf überdauern den Neustart.** Beide liegen als
  JSON in der vorhandenen `settings`-Tabelle — kein Schemawechsel. Die
  Leseposition wird beim Lesen gedrosselt geschrieben (frühestens alle zwei
  Sekunden) und in jedem Fall beim Verlassen des Viewers: der Scroll-Rückruf
  feuert ab 8 px Unterschied, eine Datenbankschreibung je Schritt wäre beim
  Lesen spürbar. Einträge zu Dokumenten, die es nicht mehr gibt, fallen beim
  Start und beim endgültigen Löschen weg.
- **Die Filter-Chips der Bibliothek sind vier feste Werte** — Alle ·
  Ungelesen · Favoriten · Archiv. Blatt `1c` zeigt dort zwei Tag-Chips; mit
  dem Wegfall der Tags tritt der Workflow-Status an ihre Stelle. Die Leiste
  hängt damit nicht mehr am Bestand: ein Chip, der verschwindet, weil gerade
  kein Dokument dazu passt, wäre ein Filter, den man nicht wieder findet.
- **Vierte Sortierung "Zuletzt geöffnet".** Das Handoff-Dokument führt drei;
  die Spalte `last_opened_at` gibt es seit Schema-Version 2, sie wurde aber
  nirgends zum Sortieren benutzt. Für die häufigste Aufgabe (wiederfinden) ist
  sie die nützlichste Reihenfolge. Nie geöffnete Dokumente stehen hinten, bei
  Gleichstand entscheidet `updated_at`. Das Segment in "Darstellung" trägt
  deshalb vier Kurzformen ("Zuletzt", "Titel", "Größe", "Geöffnet").
- **"Zuletzt geöffnet" im Info-Sheet.** Der Viewer zählt beim Öffnen hoch,
  bevor das Sheet aufgeht — angezeigt wird deshalb der gemerkte Zeitpunkt des
  Besuchs davor, sonst stünde dort immer "gerade eben". Ohne einen solchen
  Besuch: "noch nie".
- **Ordner-Detail als Aufräum-Screen:** Blatt `3b` zeigt weder Auswahlmodus
  noch FAB noch eine Sortier-Schaltfläche, und die Sektionsüberschrift steht
  fest auf "Zuletzt geändert". Aufgeräumt wird aber genau dort; ohne diese
  Ergänzungen ist der Ordner der einzige Listen-Screen, in dem man nichts tun
  kann. Kontextmenü, Verschieben-Sheet und Toast kommen aus einem
  gemeinsamen Modul (`screens/library/documentActions.tsx`), das sich
  Bibliothek und Ordner-Detail teilen. Die Auswahl-Aktionsleiste ersetzt dort
  keine Tab-Bar (der Screen liegt darüber), sondern schwebt über dem unteren
  Rand, und ihre Wünsche führt der Screen selbst aus statt über `request` —
  zwei Zuhörer auf demselben Wunsch führten ihn doppelt aus. Ein Import aus
  einem Ordner heraus landet in diesem Ordner; "Alle Dokumente" hat keinen,
  dort gilt weiter "landet in Neu".

- **Suche über mehrere Begriffe.** Das Handoff-Dokument beschreibt eine
  Teilzeichenketten-Suche über einen Begriff. Damit fand "annuität rechner"
  nichts, obwohl beide Wörter im Dokument stehen. Die Abfrage wird jetzt an
  Leerzeichen zerlegt (UND über die Begriffe, jeder für sich in Titel, Ordner
  oder Text); was in Anführungszeichen steht, bleibt eine Wortgruppe.
- **Umlaute: Akzente entfernen, keine ae-Umschrift.** Gesucht wird in einer
  gefalteten Fassung — kleingeschrieben, `ß→ss`, danach NFD ohne
  Kombinationszeichen. "annuitat" findet damit "Annuität" und "Muller" findet
  "Müller". Die im Konzept erwogene deutsche Umschrift (`ä→ae`) hätte genau
  diese beiden Fälle gebrochen ("Annuität" wäre zu "annuitaet" geworden);
  sie ist deshalb bewusst **nicht** umgesetzt. "Mueller" findet "Müller"
  folglich nicht. Die Fundstelle wird über eine zeichenweise Abbildung auf den
  Originaltext zurückgerechnet und bleibt exakt, auch hinter einem ß.
- **"Im Dokument suchen" im Viewer.** Kein Blatt sieht es vor; bei einem
  40-Seiten-Nachschlagewerk ist es die naheliegendste Erwartung. Der Eintrag
  steht im Überlaufmenü über "Umbenennen", die Eingabe läuft in der Form des
  URL-Sheets aus `ImportSheet`. `react-native-webview` 13.16.1 hat keine
  Suchschnittstelle (weder `findInPage` noch `findAll`), deshalb
  `injectJavaScript` mit `window.find(...)`: die Hervorhebung ist die Auswahl,
  die die WebView selbst zeichnet — kein eingespritztes Stylesheet im fremden
  Dokument. Die Zählung ("3 / 17") entsteht aus `innerText`.
- **Treffer springt zur Fundstelle.** Die Trefferzeile öffnet
  `/dokument/<id>?suche=<begriff>`; der Viewer sucht den Begriff nach dem Laden
  einmal und zeigt das Suchen-Sheet eingeklappt, damit erkennbar ist, warum das
  Dokument nicht oben steht. Der Suchbegriff gewinnt dabei gegen die gemerkte
  Leseposition — die bleibt gespeichert und gilt beim nächsten Öffnen ohne
  Begriff wieder.
- **`CaretUp` im Icon-Register.** Weiter/Zurück durch die Fundstellen brauchen
  ein Gegenstück zu `CaretDown`; das Handoff-Dokument führt nur die
  Abwärtsform, weil es die Aufwärtsbewegung nirgends gab.

- **Info-Sheet schreibt gedrosselt.** Titel und Notiz haben einen eigenen
  Zustand im Sheet; nach außen gemeldet wird frühestens alle 600 ms und in
  jedem Fall bei `onBlur` und beim Schließen. Vorher ging jeder Buchstabe in
  die Datenbank und setzte `updated_at` — der Titel wanderte beim Tippen live
  in "Zuletzt geändert" nach oben. `setTitle`/`setNote` schreiben zusätzlich
  nur noch, wenn sich der Wert wirklich unterscheidet: sonst rückt ein
  Dokument nach vorn, ohne dass jemand etwas geändert hat.
- **"Alle auswählen" in der Auswahl-Kopfzeile.** Blatt `3h` zeigt nur
  "Abbrechen"; bei einigen hundert Dokumenten ist Aufräumen ohne Sammelgriff
  Zeile für Zeile Handarbeit. Der Griff wirkt auf die gerade sichtbare,
  gefilterte und sortierte Liste (in der Bibliothek einschließlich der Sektion
  "Neu"), nie auf den ganzen Bestand — ein Tipp bei aktivem Favoriten-Filter
  darf nichts auswählen, was niemand sieht. Ist alles gewählt, heißt der
  Button "Auswahl aufheben". Dieselbe Kopfzeile benutzt das Ordner-Detail.
- **Duplikat-Rückfrage beim Import.** Dieselbe Datei zweimal zu importieren
  ergab bisher stumm zwei Einträge. Erkannt wird ein Duplikat an gleichem
  Titel **und** gleicher Größe in Bytes, nicht über eine Prüfsumme: ein
  Hashlauf über ein paar hundert Kilobyte bei jedem Import wäre spürbar, und
  für eine Rückfrage genügt das Paar. Gefragt wird im Kontextmenü-Muster wie
  bei "Papierkorb leeren" — Hinweiszeile mit dem Titel des vorhandenen
  Dokuments, darunter "Trotzdem importieren". "Abbrechen" schließt ohne
  Meldung und wirft die schon geschriebene Datei wieder weg.
- **Suchfeld im Ordner-Detail.** Aus einem Ordner heraus führte der Weg zur
  Suche nur über die Bibliothek, und der Ordnerfilter musste von Hand gesetzt
  werden. Das Feld über der Sektionsüberschrift ist wie in der Bibliothek nur
  eine Schaltfläche; es setzt den Ordnerfilter vorab und schiebt die Suche
  auf. Der Chip nennt den Ordnernamen und bleibt mit einem Tipp abwählbar.
  "Alle Dokumente" setzt keinen Filter.

- **Tags sind ersatzlos entfallen; an ihre Stelle tritt der Workflow-Status.**
  Tags sind eine mehrwertige Klassifikation, "gelesen/ungelesen/archiviert" ein
  einwertiger Lebenszyklus — über eine Zuordnungstabelle abgebildet erlaubte
  die Datenbank Zustände, die es fachlich nicht gibt. Der Status steht jetzt
  als Spalte in der Dokumentzeile (`read_at`, `archived_at`).
- **Die Tab-Bar hat drei statt vier Ziele** (Bibliothek · Ordner ·
  Einstellungen): mit den Tags fällt der Screen weg, den das vierte Ziel
  ansteuerte.
- **Die Auswahl-Aktionsleiste** (Blatt `3h`) trägt Verschieben · Gelesen ·
  Archiv · Löschen. Der Favorit steht dort nicht mehr, sondern im Kontextmenü
  und als Stern in der Zeile — vier Spalten, und der Status ist die Aktion,
  für die man mehrere Dokumente auf einmal auswählt.
- **Archiv ist eine zweite Achse neben gelesen/ungelesen, keine dritte Stufe.**
  Ein archiviertes Dokument ist in aller Regel auch gelesen; mit nur einer
  Status-Spalte ginge beim Entarchivieren die Leseinformation verloren.
- **Der Status wird nicht automatisch beim Öffnen gesetzt.** Ein Dokument
  aufzuschlagen heißt nicht, es gelesen zu haben — der Status kommt über die
  Wischgeste, das Kontextmenü, die Auswahlleiste oder die Schalter im
  Info-Sheet. Wischen ist dabei immer nur eine Abkürzung, nie der einzige Weg.
- **Es gibt jetzt eine Richtung nach oben (Outbox).** `updateDocuments` merkt
  im Repository vor, welche Felder sich geändert haben; `pushChanges()` schickt
  sie vor jedem Abruf hoch. Bekannte Grenzen: Dokumente ohne `storage_path`
  werden nicht eingereiht (die Zeile war nie oben, ein `update` träfe nichts),
  ein lokal angelegter Ordner wird ohne `remote_id` ausgelassen statt als
  "kein Ordner" geschickt, und `updated_at` setzt der Server — eine Gerätezeit
  im Wasserzeichen könnte die Reihenfolge dauerhaft verderben.
- **Der Abruf überschreibt Nutzerfelder nicht, solange ein Outbox-Eintrag
  offen ist.** Sonst nähme er zurück, was gerade offline gewischt wurde.
  Technische Felder (`doc_type`, `size_bytes`, `updated_at`, `source`,
  `storage_path`, `content_hash`) kommen weiterhin immer vom Server, sonst
  bliebe der Dateicache auf einem veralteten Stand.

Design-Abweichungen je Screen (z. B. gestrichene Sektion "Zuletzt geöffnet",
Beschriftungen im Aktionsbalken, ergänztes "Dokumente abdunkeln", ergänztes
"Für offline vormerken"): siehe die jeweilige Screen-Beschreibung in
[DESIGN.md](DESIGN.md).

## Noch offen

- Dateien gehen noch nicht nach oben: die Outbox schickt Metadaten, aber ein
  am Handy importiertes Dokument bleibt lokal, weil es keinen `storage_path`
  hat. Dasselbe gilt für Ordner, die am Handy entstanden sind — ohne
  `remote_id` lässt der Push das Feld aus.
- Abgleich beim Wechsel in den Vordergrund und Pull-to-Refresh. Zurzeit
  läuft der Abruf beim App-Start und über „Jetzt synchronisieren".
- Der Volltext eines abgeglichenen Dokuments steht erst zur Verfügung, wenn
  seine Datei einmal geöffnet (und damit geladen) wurde. Bis dahin findet die
  Suche es über Titel und Ordner. Der serverseitige `preview_text` wird
  noch nicht mitgenommen.
- Unter iOS wirkt die Textgröße nicht: `textZoom` ist Android-only.
- Aus dem ursprünglichen Lösungskonzept noch nicht umgesetzt: PDF-Export,
  Share-Sheet-Empfang, Hintergrund-Sync,
  eigenes App-Icon (die letzten drei brauchen einen Dev Build statt Expo Go,
  siehe [TECH_STACK.md](TECH_STACK.md)).
