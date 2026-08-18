# VS-Code-Prompt: Nutzersicht-Verbesserungen Kompendium

> Copy-paste in Claude Code / VS Code im Ordner `C:\Projekte\Kompendium`.

---

Du arbeitest im Repository `C:\Projekte\Kompendium` (App „Kompendium", Expo SDK 57 /
React Native 0.86, Android-first, Dark Mode only). Lies zuerst `CLAUDE.md`, `README.md`
und `DESIGN.md` — die dort genannten harten Regeln gelten für alles, was folgt:

- Keine Hex-Codes oder `fontSize:` außerhalb von `src/theme/`. Neue Maße gehören in
  `src/theme/layout.ts` (`size`), vorher prüfen, ob es sie schon gibt.
- SQL ausschließlich in `src/data/db/repository.ts`. Screens und Stores kennen die
  Datenbank nicht.
- `src/data/sampleLibrary.ts` ist **nur** Erstbefüllung, nie Laufzeitbestand.
- Ordner sind ein Name, kein Fremdschlüssel (`documents.folder_name`).
- Deutsch in Kommentaren, Dokumenten und UI-Texten.
- Keine neuen nativen Module, die einen Dev Build erzwingen — die App läuft in Expo Go.
- Für jede Web-Variante (`repository.web.ts`, `cache.web.ts`, `DocumentView.web.tsx`,
  `networkSource.web.ts`) gilt: neue **Repository-Funktionen müssen dort mitgezogen
  werden**, sonst bricht der Web-Export und damit die Screenshot-Kontrolle.

**Rahmen für alle Aufgaben unten:** Neue UI darf nur aus vorhandenen Komponenten gebaut
werden (`ContextMenu`, `BottomSheet`/`SheetLayer`, `ChoiceSheet`, `Toast`, `SwipeRow`,
`SegmentedControl`, `SettingsRow`, `FilterChip`, `PressableScale`, `TextButton` …). Keine
neue Basiskomponente. Jede bewusste Abweichung vom Handoff-Dokument wird in
`README.md` unter „Abweichungen vom Handoff-Dokument" mit Begründung ergänzt.

Arbeite die Pakete **in dieser Reihenfolge** ab und halte nach jedem Paket an, bis
`npm run typecheck` und `npm run lint:tokens` sauber sind.

---

## Paket A — Versprechen, die die App bricht

### A1 Teilen teilt die Datei, nicht den Titel

`src/screens/viewer/ViewerScreen.tsx`, `src/data/cache.ts`

`handleShare` ruft heute `Share.share({ title, message: title })` — geteilt wird nur der
Titel. Die Datei liegt im Cache und soll geteilt werden.

- In `src/data/cache.ts` eine Funktion `documentUri(key: string): string | null`
  ergänzen, die den `file://`-Pfad der abgelegten Datei zurückgibt (`null`, wenn sie
  nicht existiert). Dieselbe Signatur in `src/data/cache.web.ts` als `null`-Rückgabe
  ergänzen.
- `expo-sharing` verwenden (läuft in Expo Go, kein Dev Build). Prüfen mit
  `Sharing.isAvailableAsync()`.
- `handleShare`:
  - Dokument hat `cacheKey` und die Datei existiert → `Sharing.shareAsync(uri, { mimeType: 'text/html', dialogTitle: title })`.
  - Kein `cacheKey` (Erstbefüllung, es gibt keine Datei) oder Sharing nicht verfügbar →
    wie bisher `Share.share`, aber mit einem Toast „Dieses Beispiel hat keine Datei zum
    Teilen", damit der Knopf nicht stumm bleibt.
  - Fehler beim Teilen → Toast mit dem Grund in einem Satz, ohne „Rückgängig".

### A2 Links im Dokument öffnen den Systembrowser

`src/screens/viewer/DocumentView.tsx`

`onShouldStartLoadWithRequest={(request) => request.url.startsWith('about:')}` blockt
heute jeden externen Link **stumm**. Neu:

- `about:`-URLs (inkl. Anker wie `about:blank#kapitel-3`) weiterhin durchlassen — das
  Inhaltsverzeichnis eines eigenen Dokuments muss funktionieren.
- `http:`/`https:` → `Linking.openURL(request.url)` aus `expo-linking` und `false`
  zurückgeben. Das Dokument bleibt im Viewer stehen, der Link geht nach draußen.
- Alles andere (`data:`, `javascript:`, `file:`, unbekannte Schemata) → weiter blocken.
- Fehlschlag von `openURL` abfangen; der Screen bekommt dafür ein optionales
  `onExternalLinkFailed?: (url: string) => void`, das `ViewerScreen` in den Toast legt
  („Link ließ sich nicht öffnen").
- Kommentarblock oben in der Datei entsprechend fortschreiben.

### A3 Papierkorb hält seine 30-Tage-Zusage

`src/state/hydrate.ts`, `src/state/documents.ts`, `src/data/db/repository.ts`

Der Hinweisstreifen im Papierkorb sagt „Wird nach 30 Tagen endgültig gelöscht" — es gibt
aber keinen Aufräumlauf. Zeilen bleiben ewig auf „0 Tage übrig" stehen.

- In `repository.ts` eine Funktion `expiredTrashIds(before: number): Promise<{ id: string; cacheKey: string | null }[]>`
  ergänzen (`SELECT id, cache_key FROM documents WHERE trashed_at IS NOT NULL AND trashed_at < ?`).
  Gleiche Funktion in `repository.web.ts`.
- In `hydrateStores()` **vor** `useDocumentStore.hydrate(...)`: alles mit
  `trashedAt < Date.now() - TRASH_DAYS * DAY` endgültig löschen (Datenbankzeile **und**
  Cache-Datei, siehe A4) und aus dem Snapshot entfernen, bevor er in den Zustand geht.
  So sieht der Nutzer nie eine Zeile, die eigentlich weg sein müsste.
- Fehler beim Aufräumen darf den Start nicht verhindern — `try/catch` mit
  `console.warn`, wie beim Lesen der Datenbank.

### A4 Endgültiges Löschen räumt auch die Datei weg

`src/state/documents.ts`

`deleteForever` löscht nur die Datenbankzeile. Die HTML-Datei bleibt für immer im
Dokumentverzeichnis liegen, und der Speicherbalken in den Einstellungen zeigt zu wenig.
`src/data/cache.ts` hat mit `deleteDocument(key)` bereits alles Nötige — die Funktion
wird nirgends benutzt.

- In `deleteForever` für jedes Dokument mit `cacheKey !== null` zusätzlich
  `deleteDocument(cacheKey)` aufrufen, im selben `persist(...)`-Block wie
  `repository.deleteDocuments`.
- Denselben Weg in A3 benutzen, damit es nur eine Stelle mit dieser Regel gibt.

### A5 Ordner lassen sich löschen

`src/data/db/repository.ts`, `src/data/db/repository.web.ts`, `src/state/folders.ts`,
`src/screens/folders/FolderDetailScreen.tsx`

`useFolderStore` kennt nur `createFolder`, `renameFolder`, `setKeepOffline`. Ein
versehentlich angelegter Ordner bleibt für immer stehen.

- `repository.deleteFolder(name: string)`: **eine Transaktion**, genau wie
  `renameFolder` — erst `UPDATE documents SET folder_name = NULL WHERE folder_name = ?`,
  dann `DELETE FROM folders WHERE name = ?`. Dokumente werden **nie** mitgelöscht; sie
  landen wieder in „Nicht einsortiert". Gleiche Funktion in `repository.web.ts`.
- `useFolderStore.deleteFolder(name)` schreibt über `persist(...)` und entfernt den
  Ordner aus dem Zustand. Zusätzlich im Dokument-Zustand eine Ergänzung zu
  `renameFolderEverywhere`: `clearFolderEverywhere(name)` setzt `folderName` auf `null`
  für alle betroffenen Zeilen (nur Zustand — die Datenbank hat die Transaktion schon
  erledigt).
- UI: im Überlaufmenü des Ordner-Details (`menuItems`) ein dritter Eintrag
  **„Ordner löschen"** mit `Trash`-Icon und `destructive: true`, unter den beiden
  vorhandenen. Danach `onBack()`.
- Absicherung wie überall: Toast mit „Rückgängig" (5 Sekunden), der den Ordner mit
  Name/Farbe/`keepOffline` neu anlegt und die vorher gemerkten Dokument-Ausweise wieder
  zuordnet. Die Liste der betroffenen Ausweise **vor** dem Löschen einsammeln — danach
  ist sie nicht mehr zu ermitteln (dasselbe Muster wie `TagsScreen.remove`).
- Der Toast lebt heute nicht im Ordner-Detail; er wird dort ergänzt (Komponente
  `ui/Toast`, Position `insets.bottom + size.screenPadding`).
- README: Abweichung „Ordner löschen ist im Handoff-Dokument nicht vorgesehen; ohne sie
  ist ein Ordner eine Einbahnstraße" ergänzen.

---

## Paket B — Was den Neustart überleben muss

Beides geht in die vorhandene `settings`-Tabelle über `persist(() => setSetting(...))`.
**Kein** Schemawechsel, kein `SCHEMA_VERSION`-Sprung.

### B1 Leseposition überlebt den Neustart

`src/state/viewer.ts`, `src/state/hydrate.ts`

`scrollPositions` liegt heute nur im Speicher. Nach dem App-Neustart fängt jedes Dokument
wieder oben an — bei langen Nachschlagewerken der störendste Punkt beim Lesen.

- Schlüssel `SETTING_SCROLL_POSITIONS = 'viewer.scrollPositions'`, Wert ein
  JSON-Objekt `Record<string, number>`.
- `hydrate(settings)` im Viewer-Zustand ergänzen und in `hydrateStores()` aufrufen.
  Kaputtes JSON → leeres Objekt, kein Absturz.
- **Nicht bei jedem Scrollschritt schreiben.** `rememberScroll` aktualisiert weiter
  sofort den Zustand, aber der Schreibvorgang läuft gebündelt: entweder gedrosselt
  (frühestens alle 2 s) oder beim Verlassen des Viewers. Begründung als Kommentar
  hinterlegen — `handleScroll` feuert bei jedem 8-px-Schritt.
- Beim Hydratisieren Einträge zu Dokumenten wegwerfen, die es nicht mehr gibt, damit der
  Eintrag nicht unbegrenzt wächst. Gleiches beim endgültigen Löschen (A4).

### B2 Suchverlauf überlebt den Neustart und startet leer

`src/state/search.ts`, `src/state/hydrate.ts`

`recentQueries` ist flüchtig **und** vorbelegt mit `['annuität', 'kündigungsfrist', 'cloud']`
aus Blatt `3c`. Ein echter Nutzer hat diese Begriffe nie gesucht — die App behauptet eine
Vergangenheit, die es nicht gibt.

- `initialRecent` streichen; Startwert ist `[]`. Der Screen blendet „Zuletzt gesucht"
  schon heute aus, wenn die Liste leer ist — das passt ohne weitere Änderung.
- Schlüssel `SETTING_RECENT_QUERIES = 'search.recentQueries'`, Wert JSON-Array,
  weiterhin auf `RECENT_MAX = 6` gekappt. `submit` und ein neues `clearRecent`
  schreiben über `persist(...)`.
- `hydrate(settings)` ergänzen und in `hydrateStores()` aufrufen.
- Im Screen: unter der Chip-Reihe „Zuletzt gesucht" ein `TextButton` **„Verlauf leeren"**,
  nur sichtbar wenn die Liste nicht leer ist. Kein eigener Toast nötig.
- README: der Satz über die drei Beispielbegriffe (falls vorhanden) wird gestrichen.

---

## Paket C — Filter und Sortierung, die zum echten Bestand passen

### C1 Filter-Chips aus echter Tag-Nutzung

`src/screens/library/LibraryHeader.tsx`

Heute: `import { topFilterTagIds } from '../../data/sampleLibrary'` — die Chips sind auf
zwei Beispiel-Tags festgenagelt. Wer eigene Tags anlegt, sieht sie dort nie; wer die
beiden Beispiel-Tags löscht, hat gar keine Chips mehr. Zugleich ist das ein Verstoß gegen
die harte Regel „sampleLibrary ist kein Laufzeitbestand".

- Import auf `sampleLibrary` entfernen. `topFilterTagIds` aus `sampleLibrary.ts`
  entfernen, falls es danach keinen Leser mehr hat.
- Die Chips entstehen aus dem Bestand: Tag-Nutzung über alle nicht gelöschten Dokumente
  zählen (`useDocumentStore`), absteigend sortieren, bei Gleichstand nach Name (`'de'`),
  die **drei** häufigsten nehmen. Rechnung in `useMemo`.
- Ist `activeFilter` ein Tag, der nicht unter den drei ist, wird er **zusätzlich**
  angehängt — sonst verschwindet der aktive Filter aus der Leiste, während er wirkt.
- Ein Tag, den kein Dokument trägt, erscheint nicht.

### C2 Sortierung „Zuletzt geöffnet"

`src/state/library.ts`, `src/screens/library/SortSheet.tsx`,
`src/screens/library/LibraryScreen.tsx`, `src/screens/settings/AppearanceScreen.tsx`

Die Spalte `last_opened_at` existiert samt Migration (Schema-Version 2), wird aber
nirgends zum Sortieren benutzt. Für die häufigste Aufgabe („wiederfinden") ist sie die
nützlichste Reihenfolge.

- `SortKey` um `'opened'` erweitern. `sortLabels.opened = 'Zuletzt geöffnet'`,
  `sortShortLabels.opened = 'Geöffnet'`.
- Sortierregel: `(b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0)`; nie geöffnete Dokumente
  stehen damit hinten. Bei Gleichstand `updatedAt` absteigend als zweites Kriterium.
- `SortSheet.order` und die Prüfliste in `useLibraryStore.hydrate` mitziehen (sonst
  fällt ein gespeichertes `'opened'` beim nächsten Start auf `'recent'` zurück).
- `AppearanceScreen.sortKeys` bekommt den vierten Eintrag. Prüfen, ob das
  `SegmentedControl` bei 393 dp mit vier Beschriftungen („Zuletzt", „Titel", „Größe",
  „Geöffnet") noch lesbar ist; falls nicht, im Screenshot gegenprüfen und die
  Beschriftungen kürzen statt eine neue Komponente zu bauen.

### C3 „Zuletzt geöffnet" im Info-Sheet

`src/screens/viewer/InfoSheet.tsx`

Die Metadaten zeigen „Importiert am / Größe / Geöffnet 12× / Quelle" — aber nicht,
**wann** zuletzt. Der Wert liegt vor.

- Zeile „Zuletzt geöffnet" mit `formatRelative(document.lastOpenedAt)` ergänzen, direkt
  unter „Geöffnet". `lastOpenedAt === null` → „noch nie".
- Achtung: `ViewerScreen` zählt beim Öffnen hoch, bevor das Sheet aufgeht — der Wert
  stünde sonst immer auf „gerade eben". Prüfen und, falls nötig, den Zeitpunkt **vor**
  dem Hochzählen merken und dem Sheet mitgeben.

### C4 Ordner-Detail wird ein vollwertiger Aufräum-Screen

`src/screens/folders/FolderDetailScreen.tsx`

Heute ist der Screen fest auf `updatedAt` sortiert, die Sektionsüberschrift lautet
hartkodiert „Zuletzt geändert", es gibt keinen Auswahlmodus und kein Kontextmenü auf den
Zeilen. Man räumt aber genau dort auf.

- Sortierung aus `useLibraryStore` übernehmen (dieselbe Regel wie in `LibraryScreen`,
  inkl. C2). Die Sektionsüberschrift zeigt `sortLabels[sort]`. Rechts neben dem
  Ansichtsumschalter eine zweite `IconButton` mit `ArrowsDownUp`, die dasselbe
  `SortSheet` öffnet.
- Langer Druck auf eine Zeile öffnet dasselbe `ContextMenu` wie in der Bibliothek
  (Auswählen / Verschieben / Taggen / Favorit / Papierkorb) — die Einträge und Sheets
  aus `LibraryScreen` in ein gemeinsames Modul ziehen, statt sie zu verdoppeln. Ein
  Modul, das zwei andere brauchen, gehört in ein drittes.
- `MoveSheet`, `TagSheet` und `Toast` im Ordner-Detail ergänzen, damit die Aktionen dort
  dieselbe Rückmeldung geben.
- Ein `Fab` „Dokument importieren" wie in der Bibliothek; ein Import aus dem Ordner
  heraus legt das Dokument **in diesen Ordner** (`folderName` statt `null` setzen,
  direkt nach `addDocument`). Der Toast sagt dann „„X" nach „Ordner" importiert".
  Ausnahme: „Alle Dokumente" (`folderName === null`) bekommt keinen FAB-Sonderweg — dort
  gilt weiter „landet in Neu".
- README: Abweichung ergänzen („Blatt `3b` zeigt keinen Auswahlmodus und keinen FAB;
  ohne sie ist der Ordner der einzige Listen-Screen, in dem man nichts aufräumen kann").

---

## Paket D — Suche

### D1 Mehrere Suchbegriffe und Umlaut-Normalisierung

`src/data/search.ts`

Heute ist der Suchlauf eine reine Teilzeichenketten-Suche über **einen** Begriff:
„annuität rechner" findet nichts, obwohl beide Wörter im Dokument stehen, und „annuitat"
findet „Annuität" nicht.

- Eine Funktion `normalize(value: string): string` ergänzen: kleinschreiben, dann
  `normalize('NFD').replace(/\p{Diacritic}/gu, '')`. Zusätzlich `ß → ss` und
  `ä/ö/ü → ae/oe/ue` **vor** der NFD-Zerlegung, damit „Muller" auch „Müller" findet
  (deutsche Umschrift ist hier nicht dasselbe wie reines Akzent-Entfernen — beide Wege
  in einem Kommentar begründen und den gewählten verbindlich festhalten).
- Die Abfrage wird an Leerzeichen in Begriffe zerlegt. **Alle** Begriffe müssen
  zutreffen (UND), jeder für sich darf in Titel, Ordner, Tag oder Text stehen. Ein
  Begriff in Anführungszeichen bleibt als Ganzes stehen.
- Der Textpuffer (`textCache`) speichert zusätzlich die normalisierte Fassung, damit die
  Suche nicht bei jedem Tastendruck über den ganzen Bestand normalisiert. Die
  Fundstellen (`Highlight`) beziehen sich weiter auf den **Originaltext** — die
  Normalisierung darf die Länge nicht verschieben, also für die Positionsrechnung eine
  zeichenweise Abbildung führen oder die Umschrift auf die Suchvorstufe beschränken.
  Was du wählst, gehört in den Kopfkommentar.
- Rangfolge bleibt: Titel vor Tag/Ordner vor reinem Text. Bei mehreren Begriffen zählt
  der beste Rang, den ein Begriff erreicht.
- `countWithoutFilters` mitziehen.
- Die Leerdarstellung in `SearchScreen` nennt bei mehreren Begriffen zusätzlich, wie
  viele Treffer ein **einzelner** Begriff hätte, falls die Kombination null ergibt
  („„annuität" allein: 12 Treffer"). Nur dieser eine Zusatzsatz, keine neue Komponente.

### D2 Suchen im geöffneten Dokument

`src/screens/viewer/DocumentView.tsx`, `src/screens/viewer/ViewerChrome.tsx`,
`src/screens/viewer/ViewerScreen.tsx`

Bei einem 40-Seiten-Nachschlagewerk ist das die naheliegendste Erwartung, und es gibt sie
nicht.

- Im Überlaufmenü des Viewers ein Eintrag **„Im Dokument suchen"** (`MagnifyingGlass`),
  über „Umbenennen".
- Die Eingabe läuft über ein `BottomSheet` in der Form des URL-Sheets aus `ImportSheet`
  (fokussiertes Feld, `returnKeyType: 'search'`) — vorhandene Teile, keine neue
  Komponente.
- Umsetzung in der WebView über `WebView.findInPage` bzw. `injectJavaScript` mit
  `window.find(...)`; welcher Weg unter Android in `react-native-webview` in der
  gepinnten Fassung wirklich trägt, **vorher in der Paketdokumentation nachsehen** und
  den gewählten Weg im Kopfkommentar begründen. Kein eingespritztes Stylesheet, das die
  Gestaltung des fremden Dokuments verändert — nur die Fundstellen-Hervorhebung, die die
  WebView selbst zeichnet.
- Weiter/Zurück durch die Fundstellen und die Zählung („3 / 17") gehören in dasselbe
  Sheet, das dabei geöffnet bleibt. Keine Fundstelle → „Nicht im Dokument gefunden" im
  Sheet selbst, kein Toast.
- Schließen des Sheets hebt die Hervorhebung auf.
- Funktioniert im Web-Export nicht (dort ist es ein `iframe`) — das gehört als Satz in
  `README.md` unter die Prüfungen.

### D3 Treffer springt zur Fundstelle

`src/screens/search/SearchScreen.tsx`, `src/screens/viewer/ViewerScreen.tsx`,
`app/dokument/[id]`

Heute landet man beim Antippen eines Treffers oben im Dokument und sucht von Hand weiter.

- Der Suchbegriff wandert als Adressparameter mit: `/dokument/<id>?suche=<begriff>`.
- `ViewerScreen` nimmt ihn entgegen und löst nach `onLoadEnd` einmal dieselbe Suche wie
  in D2 aus, springt zur ersten Fundstelle und zeigt das Suchen-Sheet **eingeklappt**
  (nur Zählung und Weiter/Zurück), damit klar ist, warum das Dokument nicht oben steht.
- Achtung, Wechselwirkung mit B1: die gemerkte Leseposition darf den Sprung nicht
  überschreiben. Kommt ein Suchbegriff mit, gewinnt er; die gemerkte Position bleibt
  gespeichert und gilt beim nächsten Öffnen ohne Begriff.

---

## Paket E — Kleinere Reibungen

### E1 Info-Sheet schreibt nicht bei jedem Tastendruck

`src/screens/viewer/InfoSheet.tsx`, `src/state/documents.ts`

`onChangeText` ruft heute direkt `setTitle` / `setNote`. Jeder einzelne Buchstabe geht in
die Datenbank **und** setzt `updatedAt = Date.now()` — der Titel wandert beim Tippen live
in der „Zuletzt geändert"-Liste nach oben.

- Titel und Notiz bekommen einen lokalen Zustand im Sheet. Nach außen gemeldet wird
  gedrosselt (frühestens alle 600 ms) **und** in jedem Fall bei `onBlur` sowie beim
  Schließen des Sheets.
- `updatedAt` wird nur gesetzt, wenn sich der Wert gegenüber dem gespeicherten wirklich
  unterscheidet — sonst rutscht das Dokument nach oben, obwohl niemand etwas geändert
  hat.
- Der lokale Zustand wird zurückgesetzt, wenn das Sheet mit einem anderen Dokument
  aufgeht (`document.id` als Abhängigkeit).

### E2 „Alle auswählen" im Auswahlmodus

`src/screens/library/SelectionHeader.tsx`, `src/screens/library/LibraryScreen.tsx`,
`src/state/library.ts`

Bei 247 Dokumenten ist Aufräumen in Schüben ohne Sammelgriff mühsam.

- `SelectionHeader` bekommt links neben „Abbrechen" einen zweiten `TextButton`:
  **„Alle auswählen"** bzw. **„Auswahl aufheben"**, sobald alles gewählt ist. Beide
  passen in die 56er Zeile; die Zahl „N ausgewählt" bleibt links stehen und behält ihre
  Tabellenziffern.
- Der Griff wirkt auf die **gerade sichtbare, gefilterte und sortierte Liste**, nicht auf
  den ganzen Bestand — sonst wählt ein Tipp bei aktivem Favoriten-Filter Dinge aus, die
  niemand sieht. `LibraryScreen` gibt die Ausweise deshalb von außen herein.
- Neue Aktion `selectAll(ids: string[])` im Bibliothek-Zustand.
- Denselben Kopf im Ordner-Detail benutzen, sobald C4 dort den Auswahlmodus hat.

### E3 Duplikat-Hinweis beim Import

`src/data/importDocument.ts`, `src/screens/library/ImportSheet.tsx`

Dieselbe Datei zweimal importiert ergibt heute zwei Einträge, ohne jeden Hinweis.

- `documentFrom` bekommt den vorhandenen Bestand als Parameter und prüft auf ein
  Dokument mit **gleichem Titel und gleicher Größe in Bytes** (nicht gelöscht). Keine
  Prüfsumme — für den Zweck reicht das, und ein Hashlauf über ein paar hundert Kilobyte
  bei jedem Import wäre spürbar. Die Begründung gehört in den Kopfkommentar.
- Ergebnis ist kein Fehler, sondern eine Rückfrage: das Import-Sheet zeigt ein
  `ContextMenu` im Muster von „Papierkorb leeren" mit **„Trotzdem importieren"** und dem
  Titel des vorhandenen Dokuments als Hinweiszeile. Abbrechen schließt ohne Meldung.
- Der Toast bei erfolgreichem Import bleibt unverändert.

### E4 Suche innerhalb eines Ordners

`src/screens/folders/FolderDetailScreen.tsx`, `src/state/search.ts`

Aus dem Ordner heraus kommt man nur über die Bibliothek zur Suche, und der Ordnerfilter
muss dann von Hand gesetzt werden.

- Im Kopf des Ordner-Details ein nicht bedienbares `SearchField` (`interactive={false}`)
  wie in der Bibliothek, über der Sektionsüberschrift. Es schiebt die Suche als
  Push-Screen auf **und setzt den Ordnerfilter vorab** (`setFolderFilter(folderName)`).
- Für „Alle Dokumente" wird kein Filter gesetzt.
- Der Filter-Chip zeigt den Ordnernamen und ist wie bisher mit einem Tipp abwählbar —
  der Nutzer bleibt Herr der Einschränkung.

---

## Abschluss

1. `README.md` fortschreiben:
   - Abschnitt „Abweichungen vom Handoff-Dokument" um A5, C4, D2, E2, E3, E4 ergänzen,
     jeweils mit Begründung in einem Satz.
   - Abschnitt „Noch offen": Push-Sync/Outbox, PDF-Export, Share-Sheet-**Empfang**,
     Hintergrund-Sync und App-Icon bleiben offen. **Teilen** wandert aus „noch offen"
     heraus (A1).
   - Unter „Prüfungen" den Satz ergänzen, dass „Im Dokument suchen" im Web-Export nicht
     prüfbar ist.
2. `DESIGN.md`: die betroffenen Screen-Beschreibungen (Ordner-Detail, Auswahl-Kopfzeile,
   Viewer-Überlaufmenü, Suche) um die neuen Elemente ergänzen.

## Prüfschritte — in dieser Reihenfolge, nichts überspringen

```bash
npm run typecheck        # tsc --noEmit, muss sauber sein
npm run lint:tokens      # keine freihändigen Hex-Codes oder fontSize ausserhalb theme/
npx expo export --platform web
cd dist && setsid python3 -m http.server 8099 &
node scripts/shots.mjs  http://127.0.0.1:8099 /tmp/shots
node scripts/shots6.mjs http://127.0.0.1:8099 /tmp/shots6
node scripts/shots7.mjs http://127.0.0.1:8099 /tmp/shots7
node scripts/shots8.mjs http://127.0.0.1:8099 /tmp/shots8
```

Die Seite immer unter `/` laden, nie `/index.html`.

**Die Screenshots danach wirklich ansehen**, nicht nur erzeugen. Ein Typcheck sagt nichts
über das Aussehen. Gezielt achten auf:

- Filterleiste der Bibliothek: stehen jetzt echte Tags da, und bleibt der aktive Chip
  sichtbar, wenn er nicht zu den drei häufigsten gehört? (C1)
- Sortier-Sheet und Darstellung: vier Einträge, nichts abgeschnitten, nichts umgebrochen. (C2)
- Ordner-Detail: Sortierüberschrift, zweite Kopf-Schaltfläche, FAB, Suchfeld — bleiben die
  Abstände aus Blatt `3b` erhalten? (C4, E4)
- Auswahl-Kopfzeile: passen zwei Textbuttons und die Zahl in 56 dp, ohne dass etwas
  überlappt? (E2)
- Papierkorb: keine Zeile mehr mit „0 Tage übrig". (A3)
- **Wiederholungen** in den Beispieldaten: dieselbe Zeichenkette mehrfach untereinander
  ist fast immer ein Rechenfehler in `sampleLibrary.ts`. Jede Schrittweite dort gegen jede
  andere Periode auf Teilerfremdheit prüfen, falls du daran etwas anfasst.

Zusätzlich ohne Gerät wirklich auslösen statt nur bebildern:

- Import über die Zwischenablage (Playwright-Kontext mit
  `permissions: ['clipboard-read','clipboard-write']`) — danach denselben Inhalt ein
  zweites Mal importieren und prüfen, dass die Rückfrage aus E3 kommt.
- Ordner anlegen, umbenennen, löschen, „Rückgängig" drücken — der Ordner muss mit Farbe
  **und** seinen Dokumenten zurückkommen. (A5)
- Suche mit zwei Begriffen und mit „annuitat" ohne Umlaut. (D1)
- App-Neustart nachstellen (Seite neu laden): Leseposition und Suchverlauf müssen
  stehen. Im Web-Export läuft `repository.web.ts` im Arbeitsspeicher — falls sich das
  dort nicht prüfen lässt, sag das ausdrücklich, statt es als geprüft zu melden. (B1, B2)

## Was du melden sollst

Nach jedem Paket: was geändert wurde, welche Datei, und was der Screenshot zeigt. Bei
Zweifeln an einer Vorgabe **nachfragen statt raten** — insbesondere bei D1 (Umschrift vs.
Akzent-Entfernung und die Folgen für die Fundstellen-Positionen) und D2 (welcher
Suchweg in der gepinnten `react-native-webview`-Fassung unter Android wirklich trägt).
