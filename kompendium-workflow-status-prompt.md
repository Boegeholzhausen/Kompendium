# Kompendium — Tags ausbauen, Workflow-Status einbauen

Auftrag für Claude Code im Repository `C:\Projekte\Kompendium`.
Dieser Prompt ist eigenständig verständlich; Vorwissen aus dem Chat, in dem er
entstanden ist, wird nicht vorausgesetzt.

---

## 0 · Worum es geht

Das Tag-System wird **vollständig ausgebaut** und durch einen **Workflow-Status**
ersetzt, den man in der Dokumentliste per **Wischgeste** setzt.

Begründung (bitte in den Kommentaren aufgreifen, nicht neu erfinden): Tags sind
eine mehrwertige Klassifikation, „gelesen/ungelesen/archiviert“ ist ein
einwertiger Lebenszyklus. Über `document_tags` abgebildet erlaubt die Datenbank
Zustände, die es fachlich nicht gibt. Der Status gehört als **Spalte in die
Dokumentzeile**.

**Archiv ist keine dritte Stufe von gelesen/ungelesen, sondern eine zweite
Achse.** Ein archiviertes Dokument ist in aller Regel auch gelesen. Deshalb zwei
unabhängige Spalten (`read_at`, `archived_at`) und nicht eine Status-Spalte mit
drei Werten — sonst geht beim Entarchivieren die Leseinformation verloren.

Festgelegtes Verhalten:

| | |
|---|---|
| Wischen nach **rechts** | archivieren / aus dem Archiv holen |
| Wischen nach **links** | als gelesen / als ungelesen markieren |
| Filterleiste Bibliothek | vier Chips: **Alle · Ungelesen · Favoriten · Archiv** |
| „Alle“ zeigt | alles außer Papierkorb **und** Archiv (gilt auch im Ordner-Detail) |
| Öffnen eines Dokuments | setzt **nicht** automatisch „gelesen“ — der Status kommt nur über die Geste bzw. die gestenfreien Ersatzwege |
| Wahrheitsquelle des Status | **Supabase** — dafür wird der bisher fehlende Weg nach oben gebaut |

---

## 1 · Verbindliche Regeln dieses Repos (aus `CLAUDE.md`)

- Keine freihändigen Hex-Codes oder Schriftgrößen außerhalb von `src/theme/`.
  Neue Maße gehören in `src/theme/layout.ts` (`size`), neue Farben in
  `src/theme/colors.ts`. Prüfen mit `npm run lint:tokens`.
- **`src/data/db/repository.ts` ist die einzige Stelle mit SQL.** Screens und
  Stores kennen die Datenbank nicht. Das gilt auch für alles Neue in diesem
  Auftrag (Outbox!).
- Schemaänderung heißt: `SCHEMA_VERSION` hochzählen **und** eine Migration
  ergänzen. `CREATE TABLE IF NOT EXISTS` ändert keine bestehende Tabelle.
- `src/data/sampleLibrary.ts` ist Erstbefüllung, kein Laufzeitbestand. Sie darf
  hier angefasst werden, weil sich der Typ ändert — aber nicht, um Bestandsdaten
  zu „reparieren“.
- Ordner sind ein **Name**, kein Fremdschlüssel.
- Deutsch in Kommentaren, Dokumenten und UI. Der Kommentarstil dieses Repos
  erklärt **warum**, nicht was — bitte beibehalten.
- Keine neuen nativen Module (die App läuft in Expo Go).
- Web-Varianten (`repository.web.ts`, `pull.web.ts`, `cache.web.ts`,
  `DocumentView.web.tsx`, `networkSource.web.ts`) existieren nur für den
  Screenshot-Vergleich. Sie sind hier **so weit mitzuziehen, dass
  `npx expo export --platform web` durchläuft** — das ist der Prüfweg.
- Bewusste Abweichungen vom Handoff-Dokument gehören in den Abschnitt
  „Abweichungen“ der `README.md`. Am Ende dieses Prompts steht, welche.

---

## 2 · Reihenfolge

Vier Pakete, in dieser Reihenfolge. Nach jedem Paket `npm run typecheck`.

- **A** Schema und Migration
- **B** Tags vollständig ausbauen
- **C** Status, Gesten, Filter, Oberfläche
- **D** Push nach Supabase (Outbox)

---

## 3 · Paket A — Schema und Migration

### `src/data/db/schema.ts`

1. `SCHEMA_VERSION` von `3` auf **`4`**.
2. In `createSchemaSql`:
   - `documents` bekommt zwei Spalten:
     ```sql
     read_at      INTEGER,
     archived_at  INTEGER,
     ```
     (Millisekunden wie überall sonst; `NULL` = ungelesen bzw. nicht archiviert.)
   - Die Tabellen `tags` und `document_tags` sowie der Index
     `document_tags_by_tag` **entfallen ersatzlos**. Wichtig: `createSchemaSql`
     läuft bei jedem Start — bleibt die Anweisung stehen, legt sie die gerade
     weggeworfenen Tabellen sofort wieder an.
   - Neue Tabelle für den Weg nach oben:
     ```sql
     CREATE TABLE IF NOT EXISTS outbox (
       document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
       -- JSON-Liste der geaenderten Feldnamen. Nicht die Werte: die stehen in
       -- `documents` und sind dort immer der neueste Stand. Ein zweites Mal
       -- gespeicherte Werte waeren eine zweite Wahrheit, die veralten kann.
       fields      TEXT NOT NULL,
       queued_at   INTEGER NOT NULL
     );
     ```
   - Keine neuen Indizes: gefiltert wird in den Screens über den Bestand im
     Zustand, die Datenbank liefert nur `SELECT *`.
3. Migrationen ergänzen (Reihenfolge beachten — `document_tags` hat einen
   Fremdschlüssel auf `tags`, und `PRAGMA foreign_keys` steht auf `ON`):
   ```ts
   { to: 4, sql: 'ALTER TABLE documents ADD COLUMN read_at INTEGER' },
   { to: 4, sql: 'ALTER TABLE documents ADD COLUMN archived_at INTEGER' },
   { to: 4, sql: 'DROP TABLE IF EXISTS document_tags' },
   { to: 4, sql: 'DROP TABLE IF EXISTS tags' },
   { to: 4, sql: 'CREATE TABLE IF NOT EXISTS outbox (…wie oben…)' },
   ```
   Im Kopfkommentar der Migrationsliste erklären, warum bestehende Zeilen mit
   `read_at = NULL` starten: was vor dem Umbau gelesen wurde, weiß niemand mehr,
   und „alles gelesen“ wäre eine Behauptung.

### `src/data/library.ts`

- `LibraryTag` entfernen, `tagIds` aus `LibraryDocument` entfernen,
  `documentTags()` entfernen.
- `StoredDocument` bekommt:
  ```ts
  /** Wann als gelesen markiert; `null` = ungelesen. Lesen setzt das NICHT von selbst. */
  readAt: number | null;
  /** Wann archiviert; `null` = nicht archiviert. Zweite Achse neben `readAt`. */
  archivedAt: number | null;
  ```
- Drei Regeln an genau einer Stelle — nach dem Vorbild von `isUnavailable`:
  ```ts
  export function isUnread(document: { readAt: number | null }): boolean
  export function isArchived(document: { archivedAt: number | null }): boolean
  /**
   * Was Bibliothek und Ordner-Detail zeigen: alles ausser Papierkorb UND Archiv.
   * Vier Listen und die Suche muessen sich darueber einig sein.
   */
  export function isVisible(document: StoredDocument): boolean
  ```

---

## 4 · Paket B — Tags ausbauen

### Zu löschende Dateien

- `src/screens/tags/TagsScreen.tsx`
- `src/screens/tags/NewTagSheet.tsx` (und der Ordner `src/screens/tags/`)
- `src/screens/viewer/TagSheet.tsx`
- `src/ui/TagChip.tsx`
- `src/ui/SwipeRow.tsx` — einziger Nutzer war die Tag-Verwaltung; die neue Geste
  in Paket C ist etwas anderes (sofortige Wirkung statt freigelegter
  Schaltflächen) und bekommt eine eigene Komponente.
- `app/(tabs)/tags.tsx`

### `app/(tabs)/_layout.tsx` — die Tab-Bar hat künftig **drei** Ziele

- `items` ohne `tags`: Bibliothek · Ordner · Einstellungen.
- Die Deaktivierung bei leerer Bibliothek betrifft nur noch `ordner`.
- `SelectionBar`: die Aktion `tag` („Taggen“) wird ersetzt. Neue Belegung der
  vier Spalten: **Verschieben · Gelesen · Archiv · Löschen**. Der Favorit fällt
  in der Auswahlleiste weg (bleibt im Kontextmenü und als Stern in der Zeile) —
  bewusste Abweichung von Blatt `3h`, in die README.
- Kopfkommentar von `app/(tabs)/_layout.tsx` und `src/ui/TabBar.tsx` („vier
  Ziele“) mitziehen.

### Repository, Zustände, Suche

- **`src/data/db/repository.ts`**
  - Import `libraryTags` weg, Tag-Schleife in `seedIfEmpty` weg.
  - `Snapshot.tags` weg, Tag-Abfragen und die `tagsByDocument`-Zuordnung in
    `loadSnapshot` weg.
  - `insertRow`: die beiden `document_tags`-Anweisungen weg; `read_at` und
    `archived_at` in Spaltenliste, Platzhalter und Werte aufnehmen.
  - `toDocument`: `tagIds` weg, `readAt`/`archivedAt` aus der Zeile lesen.
  - `DocumentRow` um `read_at`/`archived_at` ergänzen.
  - `DocumentPatch` und die `columns`-Zuordnung um `readAt: 'read_at'` und
    `archivedAt: 'archived_at'` ergänzen.
  - `setDocumentTags`, `upsertTag`, `deleteTag` entfernen.
  - `clearLibrary`: `DELETE FROM tags` entfernen.
  - `applyRemote`: Tag- und Zuordnungsschleifen entfernen, `RemoteSnapshot.tags`
    und `.documentTags` entfernen. (Die Spalten `read_at`/`archived_at` kommen
    in Paket D dazu.)
- **`src/state/documents.ts`**: `tags`, `assignTag`, `removeTag`, `createTag`,
  `renameTag`, `deleteTag`, `restoreTag`, `nextTagColor`, `tagIdFromName` und
  der Re-Export `documentTags` entfallen. `hydrate` nimmt nur noch die
  Dokumente. Neue Griffe siehe Paket C.
- **`src/state/hydrate.ts`**: Tag-Übergabe aus `hydrate`/`reloadStores` entfernen.
- **`src/state/search.ts`**: `tagIds` aus `SearchFilters` und `noFilters`,
  `toggleTagFilter`, der Tag-Anteil in `activeFilterCount`.
- **`src/data/search.ts`**: `tags` aus `SearchInput`, der `tagIds`-Zweig in
  `passesFilters`, `foldedTags` und `inTag` in `matchAll`. Der Kommentar
  „Rang eines einzelnen Begriffs: 0 Titel, 1 Tag/Ordner, 2 Text“ wird zu
  „1 Ordner“.
- **`src/screens/search/SearchScreen.tsx`**: Tag-Filterchip, `selectedTagLabel`,
  das Tag-Auswahl-Sheet und der Abschnitt „Nach Tag suchen“ entfallen. Es
  bleiben die Chips für Ordner und Zeitraum.
- **`src/screens/library/documentActions.tsx`**: `assignTag`/`removeTag`/
  `createTag`, `commonTagIds`, `tagUsage`, `toggleBulkTag`, das `TagSheet`, der
  Menüpunkt „Taggen“ und `openTag` entfallen. Das Standard-Icon des Toasts
  (bisher `TagIcon`) wird `Check`.
- **`src/screens/library/LibraryHeader.tsx`**: `filterTags`, `TOP_FILTER_TAGS`
  und die daraus erzeugten Chips entfallen (Ersatz in Paket C).
- **`src/ui/DocRow.tsx`**: `tagColors` entfällt (Ersatz in Paket C), ebenso die
  Aufrufer in `LibraryScreen.tsx` und `FolderDetailScreen.tsx`.
- **`src/screens/viewer/ViewerScreen.tsx`**: Tag-Zustand, `toggleTag`,
  `handleCreateTag`, `assigned`/`assignedTags`, `tagUsage`, das Sheet `'tags'`
  und `TAG_SHEET_RATIO` (auch aus `src/screens/viewer/metrics.ts`) entfallen.
- **`src/screens/viewer/InfoSheet.tsx`**: Tag-Abschnitt entfällt (Ersatz in
  Paket C).
- **`src/data/sampleLibrary.ts`**: `libraryTags` und alle `tagIds:`-Einträge
  entfallen. `folderColors` und `tagPalette` bleiben — die Palette färbt auch
  Ordner (`pull.ts` → `colorFor`) und heißt nur historisch so.
- **`src/ui/index.ts`**: Einträge für `TagChip` und `SwipeRow` aus Export und
  Kopfkommentar entfernen, neue Komponente aus Paket C eintragen.
- **`src/ui/icons.ts`**: `Tag` entfernen, sobald kein Aufrufer mehr übrig ist.

---

## 5 · Paket C — Status, Gesten, Filter, Oberfläche

### 5.1 Zustand (`src/state/documents.ts`)

Neue Griffe, nach dem Muster der vorhandenen (`patch(...)` schreibt Zustand und
Datenbank in einem Zug):

```ts
/** Setzen, nicht umschalten — bei gemischter Auswahl waere Umschalten nicht vorhersagbar. */
setRead: (documentIds: string[], value: boolean) => void;      // readAt = value ? Date.now() : null
setArchived: (documentIds: string[], value: boolean) => void;  // archivedAt analog
toggleRead: (documentId: string) => void;
toggleArchived: (documentId: string) => void;
```

**Wichtig:** `readAt` und `archivedAt` lassen `updatedAt` in Ruhe — genau wie
Ordner, Tags und Favorit. Sie sagen etwas über die Ablage, nicht über den
Inhalt; sonst wäre „Zuletzt geändert“ nach jedem Wischen neu gemischt. Diesen
Grund als Kommentar dazuschreiben.

### 5.2 Icons (`src/ui/icons.ts`)

Neu, einzeln über den Unterpfad importiert (Sammel-Import verbietet sich, siehe
Kopfkommentar der Datei):

```ts
export { ArchiveIcon as Archive } from 'phosphor-react-native/src/icons/Archive';
export { CircleIcon as Circle } from 'phosphor-react-native/src/icons/Circle';
export { CheckCircleIcon as CheckCircle } from 'phosphor-react-native/src/icons/CheckCircle';
```

Vor dem Einbau prüfen, dass die Dateien unter
`node_modules/phosphor-react-native/src/icons/` wirklich so heißen; falls nicht,
den vorhandenen Namen nehmen und die Abweichung im Kommentar festhalten.

Verwendung:

- **ungelesen** — `Circle`, `weight="fill"`, `accent.base`
- **gelesen** — `CheckCircle`, `weight="regular"`, `text/tertiary`
- **Archiv** — `Archive`

Größe aus `iconSize` (`sm` = 16) — kein freihändiger Wert.

### 5.3 Neue Komponente `src/ui/SwipeActions.tsx`

Wischen mit **sofortiger Wirkung**, nicht mit freigelegten Schaltflächen.

```ts
export interface SwipeSide {
  icon: Icon;
  label: string;
  /** Flaeche hinter der Zeile, aus dem Theme. */
  surface: string;
  tint: string;
  onTrigger: () => void;
}

export interface SwipeActionsProps {
  /** Geste nach rechts (Flaeche liegt links) — im Einsatz: Archiv. */
  right?: SwipeSide;
  /** Geste nach links (Flaeche liegt rechts) — im Einsatz: gelesen/ungelesen. */
  left?: SwipeSide;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}
```

Verhalten:

- `react-native-gesture-handler` + Reanimated auf dem UI-Faden, wie im bisherigen
  `SwipeRow`: `.activeOffsetX([-12, 12])`, `.failOffsetY([-8, 8])` — ein
  senkrechter Bildlauf gewinnt.
- **Androids Zurück-Geste:** eine Bewegung, die am linken Bildrand beginnt,
  gehört dem System. In `.onBegin` merken, ob `event.absoluteX` kleiner ist als
  `size.systemGestureEdge` (neue Konstante, 24, in `src/theme/layout.ts`); in
  diesem Fall die Geste nicht übernehmen.
- Beim Ziehen wandert die Zeile mit, dahinter erscheint auf der entsprechenden
  Seite `surface` mit Icon und Wort.
- Überschreitet der Weg beim Loslassen `size.swipeTrigger` (neue Konstante, 96,
  in `layout.ts`), läuft `onTrigger`; die Zeile federt in jedem Fall auf 0
  zurück. Kein Wegfliegen der Zeile: beim Archivieren verschwindet sie ohnehin
  aus der gefilterten Liste, bei „gelesen“ bleibt sie stehen.
- `useReduceMotion` beachten, falls die vorhandene Hilfsfunktion
  (`src/theme/useReduceMotion.ts`) das nahelegt.
- Farben ausschließlich aus dem Theme: Archiv `bg.raised` / `text.primary`,
  Gelesen `accent.surface` / `accent.base`. Kein neuer Farbwert.

Kopfkommentar dieser Komponente muss den Satz aus dem Handoff-Dokument
aufgreifen: **Wischen ist immer nur eine Abkürzung** — dieselben Aktionen sind
ohne Geste über Kontextmenü, Auswahlleiste und Info-Sheet erreichbar.

### 5.4 Dokumentzeile und Kachel

- **`src/ui/DocRow.tsx`**: statt `tagColors` ein Feld `unread?: boolean`. An
  derselben Stelle, an der bisher die Tag-Punkte standen (rechts vor dem Stern),
  steht künftig das Status-Icon: `Circle` gefüllt für ungelesen, `CheckCircle`
  für gelesen. Der Punkt-Stil (`styles.dots`, `styles.dot`) entfällt. Das Icon
  ist **kein** eigenes Berührungsziel — es zeigt nur an.
  Im `accessibilityLabel` der Zeile den Status mitsprechen
  („… Ungelesen.“ / „… Gelesen.“).
- **`src/ui/DocCard.tsx`**: dasselbe Icon in der Kachel, damit die
  Kachelansicht denselben Zustand zeigt. In der Kachel gibt es keine Wischgeste
  — dort führen Kontextmenü und Auswahlmodus die Aktion aus.

### 5.5 Filterleiste und Bibliothek

- **`src/state/library.ts`**: `LibraryFilter` wird eine echte Union:
  ```ts
  export type LibraryFilter = 'all' | 'unread' | 'favorites' | 'archive';
  ```
  `SelectionRequest` wird `'move' | 'read' | 'archive' | 'trash'`.
- **`src/screens/library/LibraryHeader.tsx`**: vier feste Chips —
  **Alle · Ungelesen · Favoriten · Archiv** (Icons: keins, `Circle`, `Star`,
  `Archive`). Die Leiste hängt damit nicht mehr am Bestand; `useDocumentStore`
  wird hier nicht mehr gebraucht. `SKELETON_CHIP_WIDTHS` bleibt.
- **`src/screens/library/LibraryScreen.tsx`** — Filterregel:
  ```ts
  if (document.trashedAt !== null) return false;
  if (activeFilter === 'archive') return isArchived(document);
  if (isArchived(document)) return false;   // Alle, Ungelesen, Favoriten zeigen kein Archiv
  if (activeFilter === 'unread') return isUnread(document);
  if (activeFilter === 'favorites') return document.favorite;
  return true;
  ```
  - Die Sektion „Neu“ filtert zusätzlich über `isVisible` — was archiviert ist,
    ist nicht neu.
  - Die Zeilen der Listenansicht werden in `SwipeActions` gewickelt:
    rechts = archivieren/entarchivieren, links = gelesen/ungelesen. Beide mit
    Toast und „Rückgängig“ über `actions.notify(...)`.
  - **Gotcha:** die Leerdarstellung (`mode === 'empty'`) prüft weiterhin nur den
    Papierkorb. Wäre alles archiviert und gälte das als leer, blendete
    `chips === 'none'` die Filterleiste aus — und das Archiv wäre nicht mehr
    erreichbar. Diesen Grund als Kommentar hinterlegen.
- **`src/screens/folders/FolderDetailScreen.tsx`**: dieselbe Sichtbarkeitsregel
  (`isVisible`), dieselben Wischgesten, `tagColors` → `unread`, Menüpunkt
  „Taggen“ ersetzt durch „Als gelesen/ungelesen markieren“ und „Archivieren“.

### 5.6 Kontextmenü, Auswahlleiste, Viewer

- **`documentActions.tsx`** — Kontextmenü künftig: Auswählen · Verschieben ·
  *Als gelesen markieren* / *Als ungelesen markieren* (je nach Zustand) ·
  *Archivieren* / *Aus dem Archiv holen* · Favorit · In den Papierkorb.
  Jede Statusänderung erzeugt einen Toast mit „Rückgängig“.
  Neue Griffe analog zu `trashSelection`: `readSelection`, `archiveSelection` —
  **setzen, nicht umschalten**: sind alle gewählten Dokumente schon gelesen,
  markiert der Griff sie als ungelesen.
- **`LibraryScreen`/`FolderDetailScreen`**: die `request`-Auswertung um `'read'`
  und `'archive'` ergänzen.
- **`src/screens/viewer/ViewerChrome.tsx`**: in der Aktionsleiste (vier Spalten
  zu 64) wird `Tags` zu **`Archiv`** (`Archive`, `active` wenn archiviert),
  `onTags` heißt `onArchive`.
- **`src/screens/viewer/InfoSheet.tsx`**: an die Stelle des Tag-Abschnitts
  kommen zwei Zeilen im Stil der vorhandenen Schalterzeile („Offline behalten“):
  **Gelesen** und **Archiviert**, jeweils mit `ui/Switch`. Das ist der
  gestenfreie Weg im Viewer.

### 5.7 Suche

- `passesFilters` schließt weiterhin nur den Papierkorb aus — **archivierte
  Dokumente werden mitgesucht**. Grund als Kommentar: sonst wäre das Archiv ein
  schwarzes Loch, in dem man nichts wiederfindet.
- **`src/screens/search/ResultRow.tsx`**: ist der Treffer archiviert, beginnt
  die Fußzeile mit `Archiv · …` (also `Archiv · Finanzen · vor 1 Woche`), damit
  sichtbar ist, warum das Dokument in keiner Liste steht. Kein neues Layout —
  nur der Text der vorhandenen `footer`-Zeile.

### 5.8 Erstbefüllung

`src/data/sampleLibrary.ts`: die Beispieldokumente bekommen `readAt` und
`archivedAt`. Sinnvolle Streuung, damit jeder der vier Filter etwas zeigt: etwa
die Hälfte ungelesen (`null`), die andere Hälfte mit einem Zeitpunkt, zwei
Dokumente archiviert. Der Generator am Dateiende (`i % 3`-Zweig) wird
entsprechend angepasst.

---

## 6 · Paket D — Push nach Supabase (Outbox)

### 6.1 Ausgangslage

`src/state/sync.ts` ruft heute ausschließlich `pullChanges()`. Es gibt **keinen
Weg nach oben**; alle lokalen Änderungen stehen nur in SQLite und werden vom
nächsten Abruf überschrieben, sobald der PC dieselbe Zeile anfasst. Dieses Paket
baut die Gegenrichtung — als Outbox, wie im Kopfkommentar von
`src/data/supabase.ts` bereits vorgesehen („Push per Outbox“).

Mitgeschickt werden **alle** lokal geänderten Nutzerfelder, nicht nur der
Status: Titel, Notiz, Favorit, Ordner, Papierkorb, offline behalten, Zähler,
zuletzt geöffnet, gelesen, archiviert. Ein halber Push-Pfad wäre schwerer zu
erklären als ein ganzer.

### 6.2 Repository (einzige Stelle mit SQL)

Neu in `src/data/db/repository.ts`:

```ts
/** Felder, die nach oben gehoeren. Alles andere beschreibt dieses Geraet. */
const PUSHABLE: (keyof DocumentPatch)[] = [
  'title', 'folderName', 'favorite', 'note', 'keepOffline',
  'trashedAt', 'openCount', 'lastOpenedAt', 'readAt', 'archivedAt',
];

export interface OutboxEntry {
  documentId: string;
  fields: (keyof DocumentPatch)[];
  queuedAt: number;
  document: StoredDocument;
  /** Ausweis des Ordners oben; `null`, wenn der Ordner nur lokal existiert. */
  folderRemoteId: string | null;
}

export async function readOutbox(): Promise<OutboxEntry[]>;
/** Nur loeschen, wenn seither nichts Neues dazukam (`queued_at` unveraendert). */
export async function clearOutbox(entries: { documentId: string; queuedAt: number }[]): Promise<void>;
export async function countOutbox(): Promise<number>;
```

Das Einreihen passiert **in `updateDocuments`** — dort läuft jede Änderung eines
Screens durch, und damit gibt es genau eine Stelle, an der nichts vergessen
werden kann. Regeln:

- Nur Felder aus `PUSHABLE` werden vermerkt; enthält ein Patch nur technische
  Felder (`cached`, `cacheKey`, `sizeBytes`, `storagePath`, `contentHash`,
  `updatedAt`), entsteht kein Eintrag.
- **Nur Dokumente mit `storage_path IS NOT NULL`** werden eingereiht. Eine Zeile
  ohne `storage_path` war noch nie oben; ein `update` dort träfe nichts, und ein
  `insert` würde eine Zeile ohne Datei erzeugen. Solche Dokumente bleiben lokal,
  bis es die Hochlade-Richtung für Dateien gibt (README).
- Vorhandener Eintrag: Feldmenge **vereinigen**, `queued_at` auf jetzt setzen.
  Die Vereinigung in TypeScript bilden (lesen, mischen, schreiben) — in einer
  Transaktion.

### 6.3 `src/data/remote/push.ts` (neu)

```ts
export interface PushResult { pushed: number; }
export async function pushChanges(): Promise<PushResult>;
```

- `ensureSession()` wie in `pull.ts`; kein SQL in dieser Datei.
- Je Eintrag aus `readOutbox()` eine Nutzlast bauen und
  `supabase.from('documents').update(payload).eq('id', documentId)` ausführen —
  **`update`, nicht `upsert`**: wir ändern nur Zeilen, die es oben schon gibt,
  und brauchen deshalb kein `owner_id` (RLS greift über die Zeile).
- Feldzuordnung (Gegenstück zu `pull.ts`, Zeitstempel als ISO, `null` bleibt
  `null`):

  | App | Supabase |
  |---|---|
  | `title` | `title` |
  | `folderName` | `folder_id` (über `folders.remote_id`) |
  | `favorite` | `is_favorite` |
  | `note` | `note` |
  | `keepOffline` | `keep_offline` |
  | `trashedAt` | `deleted_at` |
  | `openCount` | `open_count` |
  | `lastOpenedAt` | `opened_at` |
  | `readAt` | `read_at` |
  | `archivedAt` | `archived_at` |

- Hat der Ordner kein `remote_id`, wird **`folder_id` ausgelassen** und der Rest
  trotzdem geschickt (lokal angelegte Ordner sind oben noch nicht bekannt).
- **`updated_at` wird nicht mitgeschickt.** Das Wasserzeichen des Abrufs ist ein
  Server-Zeitstempel; eine Gerätezeit hineinzuschreiben, könnte die Reihenfolge
  dauerhaft verderben. Steht oben ein Trigger, setzt der Server den Wert selbst.
- Erfolgreiche Einträge über `clearOutbox` entfernen. Schlägt eine Zeile fehl,
  bleibt ihr Eintrag stehen und die Funktion wirft am Ende — der Abgleich meldet
  dann `error`, und beim nächsten Lauf wird es erneut versucht.

### 6.4 `src/state/sync.ts`

- Reihenfolge: **erst `pushChanges()`, dann `pullChanges()`.** Erst die eigene
  Wahrheit hochschieben, dann lesen — andersherum holte man sich den alten Stand
  zurück, den man gerade überschreiben will.
- Endstatus: `await countOutbox() === 0 ? 'idle' : 'pending'`. Damit bedeutet
  `pending` endlich, was das Wort sagt. Den überholten Kommentar („Was hier noch
  fehlt: die Gegenrichtung“) ersetzen.
- `src/state/hydrate.ts` setzt den Anfangsstatus nach demselben Maßstab, statt
  ihn fest auf `pending` zu lassen.

### 6.5 Konfliktregel in `applyRemote`

`read_at` und `archived_at` in `RemoteDocument`, in die Zuordnung in `pull.ts`
(`millis(row.read_at)`, `millis(row.archived_at)`) und in die Spaltenliste des
`INSERT` aufnehmen.

Im `ON CONFLICT DO UPDATE` gilt: **eine Zeile mit offenem Outbox-Eintrag wird in
den Nutzerfeldern nicht überschrieben** — sonst nähme der Abruf zurück, was
gerade offline gewischt wurde. Technische Felder kommen weiterhin immer vom
Server, sonst bliebe der Dateicache auf einem veralteten Stand:

```sql
title = CASE
  WHEN EXISTS (SELECT 1 FROM outbox o WHERE o.document_id = documents.id)
  THEN documents.title ELSE excluded.title END,
-- ebenso: folder_name, favorite, note, keep_offline, trashed_at,
--         open_count, last_opened_at, read_at, archived_at
--
-- unveraendert vom Server: doc_type, size_bytes, updated_at, source,
--                          storage_path, content_hash und die cached-Regel
```

### 6.6 SQL in Supabase (führt der Nutzer im SQL-Editor aus)

```sql
alter table public.documents add column if not exists read_at     timestamptz;
alter table public.documents add column if not exists archived_at timestamptz;

drop table if exists public.document_tags;
drop table if exists public.tags;
```

Eigene RLS-Regeln braucht es nicht — die Rechte hängen an der Zeile, nicht an
der Spalte. `scripts/upload.mjs` fasst Tags nicht an und bleibt unverändert.
**Dieses SQL nicht selbst ausführen**, sondern am Ende im Bericht ausgeben.

---

## 7 · Dokumentation

`README.md`, Abschnitt „Abweichungen“, um diese bewussten Entscheidungen
ergänzen (jeweils mit Begründung in einem Satz):

1. Tags sind ersatzlos entfallen; an ihre Stelle tritt der Workflow-Status.
2. Die Tab-Bar hat drei statt vier Ziele.
3. Die Auswahl-Aktionsleiste (Blatt `3h`) trägt Verschieben · Gelesen · Archiv ·
   Löschen; der Favorit steht dort nicht mehr, sondern im Kontextmenü und als
   Stern in der Zeile.
4. Archiv ist eine zweite Achse neben gelesen/ungelesen, keine dritte Stufe.
5. Der Status wird nicht automatisch beim Öffnen gesetzt.
6. Es gibt jetzt eine Richtung nach oben (Outbox). Bekannte Grenzen: Dokumente
   ohne `storage_path` und lokal angelegte Ordner werden nicht hochgeschickt,
   `updated_at` setzt der Server.
7. Der Abruf überschreibt Nutzerfelder nicht, solange ein Outbox-Eintrag offen ist.

Außerdem `DATABASE_STRUCTURE.md` auf Schemastand 4 bringen (zwei neue Spalten,
`outbox`, `tags`/`document_tags` entfallen).

---

## 8 · Prüfen

```bash
npm run typecheck     # tsc --noEmit
npm run lint:tokens   # keine freihaendigen Farben/Groessen
```

Visueller Soll-Ist-Vergleich ohne Gerät:

```bash
npx expo export --platform web
cd dist && python3 -m http.server 8099   # Seite unter / laden, nicht /index.html
node scripts/shots.mjs http://127.0.0.1:8099 /tmp/shots
```

Danach durchsehen — Bibliothek mit vier Chips, Dokumentzeile mit Status-Icon,
Tab-Bar mit drei Zielen, Viewer-Aktionsleiste mit „Archiv“.

Am Gerät (Expo Go, SDK 57) zusätzlich prüfen:

1. **Migration**: App mit vorhandener Datenbank starten. Kein Absturz, alle
   Dokumente noch da, alle ungelesen, `tags`/`document_tags` weg.
2. **Geste links**: Zeile wird gelesen, Icon wechselt, Toast mit „Rückgängig“,
   „Rückgängig“ stellt den alten Zustand her.
3. **Geste rechts**: Zeile verschwindet aus „Alle“ und steht unter „Archiv“; dort
   holt dieselbe Geste sie zurück.
4. **Bildlauf** bleibt möglich — eine senkrechte Bewegung löst keine Aktion aus.
5. **Zurück-Geste** von ganz links am Rand navigiert weiterhin zurück und
   archiviert nicht.
6. **Kachelansicht** zeigt denselben Status; Kontextmenü und Auswahlmodus setzen
   ihn ohne Geste.
7. **Sortierung** bleibt beim Wischen unverändert (kein `updatedAt`-Sprung).
8. **Suche** findet ein archiviertes Dokument, die Fußzeile beginnt mit „Archiv ·“.
9. **Offline wischen**: Status wird sofort gesetzt, Einstellungen zeigen
   „Änderungen offen“. Nach Netz und Abgleich steht der Wert in Supabase und der
   Status ist „Synchron“.
10. **Konflikt**: offline archivieren, dann abgleichen — der Abruf setzt den
    Wert nicht zurück.

---

## 9 · Bericht am Ende

Bitte am Schluss ausgeben:

- Welche Dateien gelöscht, welche neu, welche geändert wurden.
- Das SQL aus 6.6 zum Kopieren, mit dem Hinweis, dass es im Supabase-SQL-Editor
  auszuführen ist, **bevor** der erste Abgleich mit der neuen App läuft.
- Alle Stellen, an denen von diesem Auftrag abgewichen wurde, mit Begründung.
