# Analyse-Befund — Kompendium

Stand: 21.08.2026 · rein lesende Analyse gegen `main` (Arbeitsstand mit
ungetrackten Änderungen) · `npm run typecheck` und `npm run lint:tokens` laufen
beide ohne Beanstandung.

## 1. Kurzfassung

1. **„Cache leeren" vernichtet Dokumente, die es nur auf dem Gerät gibt.** Am
   Handy importierte Dokumente ohne `storage_path` liegen ausschließlich als
   Datei im Cache; `clearCache` verschont nur `keepOffline`-Zeilen. Danach ist
   der Inhalt weg, die Zeile bleibt als nicht mehr zu öffnende Hülle stehen und
   kann wegen `cache_key IS NULL` auch nie mehr hochgeladen werden (B1).
2. **Löschungen erreichen Supabase nicht.** Endgültiges Löschen entfernt die
   lokale Zeile; der zugehörige Outbox-Eintrag geht per `ON DELETE CASCADE`
   still mit, und im Bucket wird nie eine Datei entfernt — nichts im Projekt
   ruft `storage.remove()` (B2, B3).
3. **Der Abruf verwirft Fremdänderungen dauerhaft.** `applyRemote` schützt die
   ganze Zeile, sobald *irgendein* Outbox-Eintrag offen ist, das Wasserzeichen
   läuft aber trotzdem weiter — der übersprungene Serverstand kommt nie wieder
   (B4).

Sicherheitsseitig ist die Grundlage in Ordnung: kein `service_role`-Key in App,
Bundle oder Git-Historie, RLS auf allen drei Tabellen, Storage-Policies je
Präfix, keine String-Interpolation von Nutzerwerten in SQL. Offen bleibt vor
allem die WebView, die fremdes JavaScript mit ungebremstem Netzzugang ausführt
(S1, S2).

## 2. Befundtabelle

| ID | Kategorie | Schwere | Datei:Zeile | Befund |
|----|-----------|---------|-------------|--------|
| B1 | Fehler | kritisch | [SettingsScreen.tsx:158-168](src/screens/settings/SettingsScreen.tsx#L158-L168), [cache.ts:84-105](src/data/cache.ts#L84-L105) | „Cache leeren" löscht die einzige Fassung noch nicht hochgeladener Dokumente. |
| B2 | Fehler | hoch | [schema.ts:99](src/data/db/schema.ts#L99), [repository.ts:329](src/data/db/repository.ts#L329), [hydrate.ts:49-56](src/state/hydrate.ts#L49-L56) | Endgültiges Löschen propagiert nie nach oben; der Outbox-Eintrag geht per Cascade mit. |
| B3 | Fehler | mittel | [push.ts:301-341](src/data/remote/push.ts#L301-L341) | Kein Aufruf entfernt je ein Objekt aus dem Storage-Bucket — er wächst monoton. |
| B4 | Fehler | hoch | [repository.ts:1093-1099](src/data/db/repository.ts#L1093-L1099), [pull.ts:184-188](src/data/remote/pull.ts#L184-L188) | Zeilenweiser statt feldweiser Outbox-Schutz + fortlaufendes Wasserzeichen = verlorene Fremdänderung. |
| B5 | Fehler | hoch | [RenameSheet.tsx:63-64](src/ui/RenameSheet.tsx#L63-L64), [repository.ts:363-369](src/data/db/repository.ts#L363-L369) | Umbenennen auf einen vorhandenen Ordnernamen bricht die Transaktion; der Fehler wird verschluckt. |
| B6 | Fehler | mittel | [push.ts:309-341](src/data/remote/push.ts#L309-L341) | `insert` ohne Konfliktbehandlung: nach einem Abbruch zwischen Insert und `markUploaded` bleibt das Dokument dauerhaft „offen". |
| B7 | Fehler | mittel | [repository.ts:127-165](src/data/db/repository.ts#L127-L165), [schema.ts:168-211](src/data/db/schema.ts#L168-L211) | Migrationen laufen ohne Transaktion und sind nicht idempotent; ein Abbruch macht die Datei dauerhaft unlesbar. |
| B8 | Fehler | mittel | [sync.ts:54-80](src/state/sync.ts#L54-L80) | Der `syncing`-Wächter greift erst nach zwei `await` — zwei Läufe können sich überlappen. |
| B9 | Fehler | mittel | [_layout.tsx:33-54](app/_layout.tsx#L33-L54) | Hydrieren und Abgleich starten ohne Reihenfolge nebeneinander. |
| B10 | Fehler | mittel | [search.ts:139-176](src/data/search.ts#L139-L176), [documents.ts:89-98](src/state/documents.ts#L89-L98) | Der Suchpuffer hält jedes Dokument dreifach im Speicher und vergisst gelöschte nie. |
| B11 | Fehler | mittel | [push.ts:459-467](src/data/remote/push.ts#L459-L467), [push.ts:156-166](src/data/remote/push.ts#L156-L166) | Ein `update`, das keine Zeile trifft, gilt als Erfolg — der Eintrag wird trotzdem abgeräumt. |
| B12 | Fehler | niedrig | [importDocument.ts:181-200](src/data/importDocument.ts#L181-L200) | „Von URL laden" ohne Größen-, Typ- und Zeitbegrenzung. |
| B13 | Fehler | niedrig | [session.ts:62-70](src/state/session.ts#L62-L70) | Kommentar und Code widersprechen sich: der Aussetzer führt genau zu der Behauptung, die er ausschließen will. |
| B14 | Fehler | niedrig | [ViewerScreen.tsx:355-370](src/screens/viewer/ViewerScreen.tsx#L355-L370) | „Dieses Beispiel hat keine Datei zum Teilen" erscheint auch bei echten Dokumenten. |
| B15 | Struktur | niedrig | [README.md:327-333](README.md#L327-L333) | README beschreibt die Leseposition noch als `settings`-JSON mit Zwei-Sekunden-Drossel. |
| S1 | Sicherheit | mittel | [DocumentView.tsx:248-272](src/screens/viewer/DocumentView.tsx#L248-L272) | Fremdes JavaScript läuft mit ungebremstem Netzzugang, ohne CSP. |
| S2 | Sicherheit | mittel | [DocumentView.tsx:204-211](src/screens/viewer/DocumentView.tsx#L204-L211) | Ein Dokument kann ohne Nutzeraktion den Systembrowser öffnen. |
| S3 | Sicherheit | niedrig | [schema.sql:12-23](supabase/schema.sql#L12-L23) | Keine Eindeutigkeit auf `folders(owner_id, name)`, obwohl der Push den Namen als Ausweis benutzt. |
| S4 | Sicherheit | niedrig | [schema.sql:172-174](supabase/schema.sql#L172-L174) | Bucket ohne `file_size_limit` und ohne MIME-Beschränkung. |
| S5 | Sicherheit | niedrig | [schema.sql:29](supabase/schema.sql#L29) | `documents.folder_id` wird nicht gegen den Besitzer des Ordners geprüft. |
| C1 | Struktur | mittel | [repository.ts](src/data/db/repository.ts) (1219 Z.) | Sieben Verantwortlichkeiten in einer Datei. |
| C2 | Struktur | mittel | [push.ts](src/data/remote/push.ts) (480 Z.) | Vier Push-Wege plus Ablaufsteuerung in einer Datei. |
| C3 | Struktur | mittel | [ViewerScreen.tsx](src/screens/viewer/ViewerScreen.tsx) (636 Z.) | Laden, Suchen, Menü, Toasts, Sheets in einer Komponente. |
| C4 | Struktur | mittel | [FolderDetailScreen.tsx:315-336](src/screens/folders/FolderDetailScreen.tsx#L315-L336), [LibraryHeader.tsx:243-269](src/screens/library/LibraryHeader.tsx#L243-L269) | Filterleiste doppelt ausgeschrieben. |
| C5 | Struktur | niedrig | [search.ts:71](src/data/search.ts#L71) | `data/` importiert aus `state/` — Schichtrichtung verkehrt. |

## 3. Details je Befund

### B1 — „Cache leeren" löscht unwiederbringlich (kritisch)

**Beobachtung.** `emptyCache` behält nur, was `keepOffline` trägt:

```ts
const keep = documents
  .filter((document) => document.keepOffline && document.cacheKey !== null)
  .map((document) => document.cacheKey as string);
const dropped = await clearCache(keep);
```
([SettingsScreen.tsx:158-162](src/screens/settings/SettingsScreen.tsx#L158-L162))

`clearCache` löscht daraufhin jede andere Datei im Dokumentverzeichnis
([cache.ts:88-92](src/data/cache.ts#L88-L92)).

**Warum das ein Problem ist.** Der Kopfkommentar von `cache.ts` begründet
`Paths.document` genau damit, dass „was das System bei Platzmangel löschen darf,
kein Ort für die einzige Fassung eines Dokuments" ist — der eigene
Aufräum-Griff macht danach dasselbe. Für ein am Handy importiertes Dokument ist
`storage_path` bis zum ersten erfolgreichen Push `NULL`; die Datei im Cache ist
die einzige Fassung. Nach `markUncached` steht zusätzlich `cache_key = NULL`,
und damit fällt die Zeile aus **beiden** Rettungswegen:
`needsDownload` gibt bei `storagePath === null` sofort `false`
([download.ts:31-33](src/data/remote/download.ts#L31-L33)), und `readUploadable`
verlangt `d.cache_key IS NOT NULL`
([repository.ts:934](src/data/db/repository.ts#L934)).

**Auslöser.** Dokument über „Datei wählen" importieren, ohne Anmeldung oder ohne
Netz. Einstellungen → „Cache leeren". Das Dokument steht weiter in der Liste und
lässt sich nie wieder öffnen.

**Behebung.** In `emptyCache` zusätzlich alles behalten, was noch nicht oben ist
(`storagePath === null`), analog zur Bedingung in `readUploadable`. Der Satz
„Cache leeren nimmt weg, was nur zufällig noch da ist" gilt dann wieder. Aufwand
**S**, Risiko gering (die Menge wird nur kleiner).

### B2 — Endgültiges Löschen erreicht Supabase nie (hoch)

**Beobachtung.** `deleteDocuments` löscht ausschließlich lokal:

```ts
await db.runAsync(`DELETE FROM documents WHERE id IN (${placeholders})`, ids);
```
([repository.ts:334](src/data/db/repository.ts#L334))

Der Outbox-Eintrag hängt per `ON DELETE CASCADE` an der Zeile
([schema.ts:99](src/data/db/schema.ts#L99)) und verschwindet im selben Zug. Für
Dokumente gibt es keine Grabsteintabelle — die existiert nur für Ordner
(`folder_deletions`).

**Warum das ein Problem ist.** Der Papierkorb-Aufräumlauf beim Start löscht
alles, was älter als 30 Tage ist ([hydrate.ts:51-54](src/state/hydrate.ts#L51-L54)),
ohne zu prüfen, ob der Papierkorb-Vermerk (`trashedAt`) je oben ankam. Passiert
das Wegwerfen offline und läuft die Frist ab, bevor wieder abgeglichen wird,
verschwindet die einzige Spur der Löschung.

**Auslöser.** Dokument offline in den Papierkorb legen, App 30 Tage nicht
synchronisieren, starten. Die Zeile ist lokal weg, oben lebt sie weiter und
erscheint auf einem zweiten Gerät unverändert; wird das Wasserzeichen je
zurückgesetzt (Kontowechsel, `noteOwner`), kommt sie auch hier zurück.

**Behebung.** Analog zu `folder_deletions` eine `document_deletions`-Tabelle,
gefüllt in derselben Transaktion wie das `DELETE`, abgearbeitet in `pushChanges`
vor der Feldschleife. Aufwand **M** (Schema-Version + Migration + Push-Schritt),
Risiko mittel — die Löschung ist danach endgültig auch oben.

### B3 — Der Storage-Bucket wird nie aufgeräumt (mittel)

**Beobachtung.** Eine Suche über `src/` und `scripts/` findet Aufrufe von
`supabase.storage` nur an drei Stellen: `createSignedUrl`
([download.ts:67-69](src/data/remote/download.ts#L67-L69)), `upload`
([push.ts:301-303](src/data/remote/push.ts#L301-L303)) und `upload` in
`scripts/upload.mjs:245`. Kein `remove`.

**Warum das ein Problem ist.** Selbst wenn B2 behoben wird, bleibt die Datei
liegen: ein Soft Delete auf der Zeile lässt das Objekt unberührt. Über Jahre
sammelt sich dort der ganze Papierkorb an — Speicher, der in keiner Ansicht der
App auftaucht.

**Auslöser.** Beliebiges hochgeladenes Dokument endgültig löschen, danach im
Supabase-Dashboard unter Storage nachsehen: `<owner>/<id>.html` ist noch da.

**Behebung.** Beim Abarbeiten der Dokument-Grabsteine (B2) zusätzlich
`storage.from(BUCKET).remove([storagePath])`; dafür muss der Grabstein den Pfad
mitführen, da die Zeile ihn nicht mehr hergibt. Aufwand **S** zusätzlich zu B2,
Risiko gering.

### B4 — Der Abruf verwirft Fremdänderungen dauerhaft (hoch)

**Beobachtung.** Der Schutz greift zeilenweise, nicht feldweise:

```ts
function mine(column: string): string {
  return (
    `CASE WHEN EXISTS (SELECT 1 FROM outbox o WHERE o.document_id = documents.id) ` +
    `THEN documents.${column} ELSE excluded.${column} END`
  );
}
```
([repository.ts:1093-1098](src/data/db/repository.ts#L1093-L1098))

Direkt danach schreibt der Abruf das Wasserzeichen über **alle** empfangenen
Zeilen fort, auch über die gerade geschützten:

```ts
const newest = stamps.length === 0 ? null : stamps.reduce((a, b) => (a > b ? a : b));
if (newest !== null) await writeSyncState('last_pulled_at', newest);
```
([pull.ts:187-188](src/data/remote/pull.ts#L187-L188))

**Warum das ein Problem ist.** Der Kommentar über `mine` begründet den Schutz
mit „sonst nähme der Abruf zurück, was gerade offline gewischt wurde" — das ist
für das *geänderte* Feld richtig. Für die übrigen Felder derselben Zeile ist es
ein stiller Verlust: die Serverfassung wird verworfen und wegen des
fortgeschriebenen Wasserzeichens nie erneut geliefert.

**Auslöser.** Am PC per `npm run upload` den Titel eines Dokuments ändern
(oder auf Gerät B den Ordner wechseln). Auf Gerät A dasselbe Dokument offline
als Favorit markieren. Gerät A online bringen: der Push schickt `is_favorite`,
der Abruf holt die neue Zeile, verwirft wegen des offenen Eintrags den neuen
Titel und merkt sich deren `updated_at`. Der Titel bleibt auf Gerät A für immer
der alte.

**Behebung.** Zwei Wege, beide vertretbar: (a) den Abruf **vor** dem Push laufen
lassen, wenn nur die Felder aus der Outbox geschützt werden, oder (b) `mine`
feldweise prüfen — die Outbox trägt die Feldliste bereits als JSON, ein
`EXISTS … AND o.fields LIKE '%"title"%'` ist möglich, sauberer wäre eine
Zuordnungstabelle `outbox_fields(document_id, field)`. Der billigste
Zwischenschritt: das Wasserzeichen nicht über Zeilen fortschreiben, die
geschützt wurden (kleinstes `updated_at` einer geschützten Zeile als Deckel).
Aufwand **M**, Risiko mittel — betrifft den Kern der Konfliktauflösung.

### B5 — Ordner-Umbenennen auf einen vorhandenen Namen (hoch)

**Beobachtung.** Das Sheet lässt jeden nicht-leeren, veränderten Namen zu:

```ts
const canSave = trimmed.length > 0 && trimmed !== currentName;
```
([RenameSheet.tsx:64](src/ui/RenameSheet.tsx#L64))

In der Datenbank ist `folders.name` Primärschlüssel
([schema.ts:87](src/data/db/schema.ts#L87)), `renameFolder` schreibt ihn
unverändert fort ([repository.ts:363-369](src/data/db/repository.ts#L363-L369)),
und der Aufrufer wirft den Fehler weg:

```ts
persist(() => repository.renameFolder(from, to.trim()));
```
([folders.ts:83](src/state/folders.ts#L83), `persist` protokolliert nur:
[persist.ts:14-18](src/data/db/persist.ts#L14-L18))

**Warum das ein Problem ist.** Die Transaktion scheitert an der
Schlüsselverletzung und wird zurückgerollt; der Zustand hat den Namen aber schon
geändert, und `renameFolderEverywhere` hat die Dokumente mitgezogen. Bis zum
nächsten Start zeigt die App zwei Ordner mit demselben Namen, danach ist die
Umbenennung spurlos verschwunden — samt der Zuordnung, die der Nutzer für
erledigt hielt.

**Auslöser.** Zwei Ordner „Steuern" und „Privat" anlegen, „Steuern" in „Privat"
umbenennen. In der Übersicht stehen danach zwei „Privat"; nach Neustart wieder
„Steuern" und „Privat".

**Behebung.** Im `RenameSheet` (oder im Aufrufer) gegen den vorhandenen Bestand
prüfen — `createFolder` macht das bereits, unabhängig von Groß-/Kleinschreibung
([folders.ts:71-74](src/state/folders.ts#L71-L74)) — und den Knopf sperren oder
das Zusammenlegen ausdrücklich anbieten. Aufwand **S**, Risiko gering.

### B6 — Hochladen bleibt nach einem Teilfehler stecken (mittel)

**Beobachtung.** Datei und Zeile entstehen in zwei Schritten, die Zeile ohne
Konfliktbehandlung:

```ts
const { error } = await supabase.from('documents').insert({ id: document.id, … });
if (error) { failed.push(`${document.title}: ${error.message}`); continue; }
await markUploaded(document.id, storagePath, contentHash);
```
([push.ts:309-340](src/data/remote/push.ts#L309-L340))

**Warum das ein Problem ist.** Zwischen `insert` und `markUploaded` liegt ein
Fenster. Wird die App dort beendet (oder scheitert der lokale Schreibvorgang),
bleibt `storage_path` lokal `NULL`. Der nächste Lauf findet das Dokument wieder
über `readUploadable`, lädt die Datei erneut hoch (`upsert: true`, harmlos) und
scheitert beim `insert` an der doppelten Kennung — dauerhaft. Der Abgleich
meldet danach bei jedem Lauf „1 Änderung(en) blieben offen"
([push.ts:475-477](src/data/remote/push.ts#L475-L477)), und das Dokument
erreicht nie den normalen Outbox-Weg.

**Auslöser.** Import am Handy, Abgleich starten, App während des Uploads
beenden (oder Flugmodus im richtigen Moment). Danach bleibt der Fehler bei jedem
Abgleich stehen.

**Behebung.** `.upsert(payload, { onConflict: 'id' })` statt `insert`, oder den
Fehlercode `23505` abfangen und in diesem Fall direkt `markUploaded` aufrufen.
Aufwand **S**, Risiko gering.

### B7 — Migrationen ohne Transaktion und nicht idempotent (mittel)

**Beobachtung.** Die Schritte laufen einzeln, die Version wird erst danach
gesetzt:

```ts
if (!fresh) {
  for (const step of migrations) {
    if (step.to <= from) continue;
    await db.execAsync(step.sql);
  }
}
await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
```
([repository.ts:160-166](src/data/db/repository.ts#L160-L166))

Sechs der elf Schritte sind `ALTER TABLE … ADD COLUMN`
([schema.ts:169-210](src/data/db/schema.ts#L169-L210)) — nicht wiederholbar.

**Warum das ein Problem ist.** Bricht der Lauf nach dem zweiten von drei
`to: 3`-Schritten ab (Absturz, Speicherplatz, Beenden durch das System), steht
`user_version` weiterhin auf 2. Der nächste Start führt denselben Block erneut
aus und scheitert an „duplicate column name: storage_path". Ab da wirft
`database()` bei **jedem** Aufruf, und weil das Versprechen gemerkt wird
([repository.ts:128-136](src/data/db/repository.ts#L128-L136)), auch nach jedem
Neustart wieder. Die App startet dann dauerhaft mit leerer Bibliothek
([hydrate.ts:72-77](src/state/hydrate.ts#L72-L77)), obwohl die Daten noch da
sind.

**Auslöser.** Nicht ohne Eingriff reproduzierbar; belegbar ist die Struktur.
Prüfen ließe es sich, indem man in einer Kopie einen Schritt künstlich werfen
lässt.

**Behebung.** Je Zielversion eine Transaktion, und `user_version` innerhalb
derselben Transaktion setzen (`PRAGMA user_version` ist in SQLite
transaktionsfähig). Ergänzend die `ADD COLUMN`-Schritte tolerant machen
(Spaltenbestand über `PRAGMA table_info` prüfen). Aufwand **M**, Risiko mittel —
betrifft den Startpfad jeder bestehenden Installation.

### B8 — Der `syncing`-Wächter greift zu spät (mittel)

**Beobachtung.**

```ts
sync: async () => {
  if (get().status === 'syncing') return;
  …
  if ((await currentUserId()) === null) { … }
  …
  set({ status: 'syncing', lastError: null });
```
([sync.ts:53-80](src/state/sync.ts#L53-L80))

Zwischen Prüfung und Setzen liegen zwei `await`.

**Warum das ein Problem ist.** Zwei Aufrufe, die in dieselbe Lücke fallen,
laufen beide durch. `pushChanges` liest dann zweimal dieselbe Outbox und schickt
dieselben Zeilen doppelt; schlimmer ist `uploadNewDocuments`, das dieselbe Datei
zweimal hochlädt und den zweiten `insert` mit doppelter Kennung scheitern lässt
— derselbe Endzustand wie in B6.

**Auslöser.** In den Einstellungen die Sync-Zeile antippen
([SettingsScreen.tsx:277](src/screens/settings/SettingsScreen.tsx#L277)),
während der Start-Abgleich aus [_layout.tsx:52](app/_layout.tsx#L52) noch in
`currentUserId()` hängt. Zweiter Weg: Anmelden löst `sync()` aus
([SettingsScreen.tsx:270-278](src/screens/settings/SettingsScreen.tsx#L270-L278)),
gleichzeitig kommt das Netz zurück.

**Behebung.** Ein modulweites `let running: Promise<void> | null` wie in
`hydrate.ts` — der zweite Aufruf bekommt dasselbe Versprechen zurück.
Aufwand **S**, Risiko gering.

### B9 — Hydrieren und Abgleich starten ohne Reihenfolge (mittel)

**Beobachtung.** Zwei Effekte nebeneinander, ohne Kopplung:

```ts
useEffect(() => { void hydrateStores(); }, []);
…
useEffect(() => { void (async () => {
  await useSessionStore.getState().restore();
  await useSyncStore.getState().sync();
})(); }, []);
```
([_layout.tsx:33-54](app/_layout.tsx#L33-L54))

**Warum das ein Problem ist.** `hydrateStores` führt zuerst die beiden
einmaligen Datenwanderungen aus
([hydrate.ts:109-116](src/state/hydrate.ts#L109-L116)), `sync()` schreibt
parallel über `applyRemote` in dieselben Tabellen und ruft am Ende
`reloadStores()`. Gewinnt der Hydrat-Lauf das Rennen um den letzten
`set`-Aufruf, überschreibt sein älterer Snapshot den gerade abgeglichenen Stand
— sichtbar bis zum nächsten Abgleich. Ungünstiger ist die Überschneidung von
`migrateLocalIdsToUuid` (schreibt `documents.id` um) mit `readOutbox` bzw.
`uploadNewDocuments` im selben Moment.

**Auslöser.** Kaltstart mit vielen Dokumenten und schneller Verbindung; die
Reihenfolge hängt an der Laufzeit beider Ketten und ist nicht festgelegt.

**Behebung.** `await hydrateStores()` vor `restore()`/`sync()` in denselben
Effekt ziehen — die Begründung „kein Screen wartet darauf" bleibt gültig, weil
weiterhin nichts gerendert blockiert wird. Aufwand **S**, Risiko gering.

### B10 — Suchpuffer wächst unbegrenzt (mittel)

**Beobachtung.** Zwei Maps ohne Verdrängung:

```ts
const textCache = new Map<string, string>();
const foldedCache = new Map<string, Folded>();
```
([search.ts:139-140](src/data/search.ts#L139-L140))

`Folded` führt neben der gefalteten Fassung ein `map: number[]` mit **einem
Eintrag je Zeichen** ([search.ts:98-102](src/data/search.ts#L98-L102)).
`warmSearchIndex` liest beim Start jede vorhandene Datei ein
([search.ts:165-176](src/data/search.ts#L165-L176)).

**Warum das ein Problem ist.** Für ein Dokument mit 200 000 Zeichen liegen damit
der Klartext, seine gefaltete Fassung und ein Zahlenfeld mit 200 000 Einträgen
gleichzeitig im Speicher — letzteres allein je nach Darstellung im
einstelligen Megabyte-Bereich. Das Zielbild nennt 50–500 Dokumente. Dazu kommt:
`forgetDocumentText` wird ausschließlich von `discardImport` gerufen
([importDocument.ts:208](src/data/importDocument.ts#L208)); `purgeDocuments`
räumt Zeile, Datei und Leseposition auf, den Textpuffer nicht
([documents.ts:89-98](src/state/documents.ts#L89-L98)).

**Auslöser.** Größere Bibliothek einmal durchsuchen (füllt `foldedCache`), dann
Speicherverbrauch beobachten — auf dem Gerät zu prüfen, siehe Abschnitt 5.

**Behebung.** `foldedCache` als LRU mit fester Obergrenze (die Faltung ist
billig genug, um sie neu zu rechnen), und `forgetDocumentText` in
`purgeDocuments` aufrufen. Aufwand **S**, Risiko gering.

### B11 — Ein Update ohne Treffer gilt als Erfolg (mittel)

**Beobachtung.**

```ts
const { error } = await supabase.from('documents').update(payload).eq('id', entry.documentId);
if (error) { failed.push(…); continue; }
done.push({ documentId: entry.documentId, queuedAt: entry.queuedAt });
```
([push.ts:461-466](src/data/remote/push.ts#L461-L466))

Dasselbe Muster beim Löschen von Ordnern
([push.ts:158-165](src/data/remote/push.ts#L158-L165)).

**Warum das ein Problem ist.** PostgREST meldet für ein `update` ohne getroffene
Zeile keinen Fehler. Der Kopfkommentar von `noteOwner` beschreibt genau diese
Fehlerklasse („trifft schlicht keine Zeile und meldet Erfolg") und fängt den
Kontowechsel ab — die übrigen Fälle bleiben: die Zeile wurde oben hart gelöscht,
eine lokale Datenbank wurde aus einem Backup zurückgespielt, die Kennung stimmt
aus anderem Grund nicht mehr. Dann verschwindet der Outbox-Eintrag, ohne dass
irgendetwas angekommen ist.

**Auslöser.** Zeile im Supabase-Dashboard hart löschen, am Handy Favorit
umschalten, abgleichen: Status „Synchron", Änderung nirgends.

**Behebung.** `.select('id')` anhängen und die Trefferzahl prüfen; bei null
Zeilen den Eintrag stehen lassen und melden. Aufwand **S**, Risiko gering
(eine zusätzliche Rückgabespalte je Zeile).

### B12 — „Von URL laden" ohne Grenzen (niedrig)

**Beobachtung.**

```ts
const response = await fetch(url);
if (!response.ok) return { ok: false, reason: `Die Adresse antwortete mit ${response.status}.` };
const html = await response.text();
```
([importDocument.ts:191-195](src/data/importDocument.ts#L191-L195))

Keine Prüfung von `Content-Type` oder `Content-Length`, kein `AbortController`.

**Warum das ein Problem ist.** Eine Adresse, die 200 MB liefert, wird
vollständig in den Arbeitsspeicher gelesen, bevor `looksLikeHtml` überhaupt
zusieht — auf einem Telefon endet das im Abbruch durch das System. Eine
Adresse, die nie antwortet, hängt das Sheet unbegrenzt.

**Auslöser.** Im URL-Sheet eine Adresse auf eine große Datei eingeben.

**Behebung.** `Content-Length` vorab prüfen (Obergrenze im Bereich weniger
Megabyte), `Content-Type` auf `text/html`/`application/xhtml+xml` einschränken
und den Abruf nach etwa 30 Sekunden abbrechen. Aufwand **S**, Risiko gering.

### B13 — Kommentar und Code widersprechen sich (niedrig)

**Beobachtung.**

```ts
// Ein Aussetzer beim Nachsehen ist kein Abgemeldetsein: die Session kann
// durchaus da sein. `signed-out` waere hier eine Behauptung …
console.warn('[kompendium] Session liess sich nicht lesen:', error);
set({ status: 'signed-out', userId: null, identity: null });
```
([session.ts:63-70](src/state/session.ts#L63-L70))

**Warum das ein Problem ist.** Der Code tut genau das, was der Kommentar
ausschließt. Folge: Nach einem Aussetzer beim Lesen der Session zeigen die
Einstellungen „Nicht angemeldet · melde dich unter Konto an", obwohl die
Session besteht. Datenverlust droht dabei nicht — irreführend ist es trotzdem,
und der Widerspruch führt beim nächsten Umbau in die falsche Richtung.

**Behebung.** Entweder den Status bei einem Aussetzer auf `idle` belassen (dann
stimmt der Kommentar) oder den Kommentar an das Verhalten anpassen. Aufwand
**S**, Risiko gering.

### B14 — Irreführende Meldung beim Teilen (niedrig)

**Beobachtung.**

```ts
const uri = cacheKey === null ? null : documentUri(cacheKey);
…
await Share.share({ title, message: title });
setPlainNote({ message: 'Dieses Beispiel hat keine Datei zum Teilen', icon: ShareNetwork });
```
([ViewerScreen.tsx:356-364](src/screens/viewer/ViewerScreen.tsx#L356-L364))

**Warum das ein Problem ist.** Der Zweig wird auch erreicht, wenn ein echtes
Dokument seine Datei verloren hat (Cache geleert, siehe B1) oder das System
kein Teilen anbietet. Der Nutzer liest „Beispiel" über einem Dokument, das er
selbst importiert hat.

**Behebung.** Den Text an `document.source === 'sample'` binden und für den
anderen Fall „Dieses Dokument liegt gerade nicht auf dem Gerät" melden.
Aufwand **S**, Risiko gering.

### B15 — README beschreibt einen überholten Stand (niedrig)

**Beobachtung.** README: „**Leseposition und Suchverlauf überdauern den
Neustart.** Beide liegen als JSON in der vorhandenen `settings`-Tabelle — kein
Schemawechsel. Die Leseposition wird beim Lesen gedrosselt geschrieben
(frühestens alle zwei Sekunden)…"
([README.md:327-330](README.md#L327-L330))

Tatsächlich steht die Leseposition seit Schema 7 in `documents.scroll_offset`
([schema.ts:83](src/data/db/schema.ts#L83),
[schema.ts:210](src/data/db/schema.ts#L210)), und die Drossel ist entfallen:
„Früher lief hier zusätzlich eine Zwei-Sekunden-Drossel. Sie ist entfallen"
([viewer.ts:30-31](src/state/viewer.ts#L30-L31)).

**Warum das ein Problem ist.** CLAUDE.md erklärt README.md zur Quelle für den
aktuellen Stand; dieser Absatz beschreibt zwei Sachverhalte, die es nicht mehr
gibt. Behebung: Absatz auf Spalte plus die zwei Schreibmomente umschreiben.
Aufwand **S**, Risiko keins.

### S1 — Fremdes JavaScript mit freiem Netzzugang (mittel)

**Beobachtung.**

```tsx
source={{ html }}
originWhitelist={['*']}
javaScriptEnabled
setSupportMultipleWindows={false}
onShouldStartLoadWithRequest={handleRequest}
```
([DocumentView.tsx:250-261](src/screens/viewer/DocumentView.tsx#L250-L261))

**Was geprüft wurde.** `allowFileAccess`, `allowFileAccessFromFileURLs` und
`allowUniversalAccessFromFileURLs` sind **nicht** gesetzt und bleiben damit auf
den restriktiven Standardwerten; das HTML wird ohne `baseUrl` geladen, der
Ursprung ist also undurchsichtig. Ein Dokument kann damit **keine** andere
lokale Datei und **kein** Sitzungstoken lesen (die Session liegt in
AsyncStorage, für die WebView unerreichbar). Die `onMessage`-Brücke nimmt nur
`{kind:'find'}` entgegen und ruft nichts Wirksames auf
([DocumentView.tsx:214-231](src/screens/viewer/DocumentView.tsx#L214-L231)).

**Was bleibt.** Skripte laufen ohne CSP mit vollem Netzzugang: `fetch`,
`XMLHttpRequest`, Bilder und Skripte von fremden Hosts sind erlaubt, und
`onShouldStartLoadWithRequest` greift dabei nicht — die Rückfrage gilt für
Navigationen, nicht für Unterressourcen. Ein Dokument kann seinen eigenen
Inhalt an einen beliebigen Server schicken. Der Kommentar „Eigene Dokumente,
kein fremder Code" trifft für die Herkunft „Datei/Zwischenablage" zu, nicht aber
für „Von URL laden": dort holt die App fremdes HTML aus dem Netz
([importDocument.ts:181-200](src/data/importDocument.ts#L181-L200)).

**Behebung.** Beim Rendern eine CSP-Meta-Zeile voranstellen (`default-src
'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'`)
— das ist kein Stylesheet im fremden Dokument und ändert seine Gestaltung
nicht. Alternativ, kleiner: die Herkunft `url` beim Import kennzeichnen und für
solche Dokumente `javaScriptEnabled={false}`. Aufwand **M**, Risiko mittel —
Dokumente, die Schriften oder Bibliotheken aus dem Netz holen, funktionieren
danach nicht mehr; für „selbstgebaute HTML-Dokumente" ist das vermutlich
gewollt, aber eine Entscheidung des Projekts.

### S2 — Ein Dokument kann von sich aus den Browser öffnen (mittel)

**Beobachtung.**

```ts
const url = request.url;
if (url.startsWith('about:')) return true;
if (url.startsWith('http:') || url.startsWith('https:')) {
  openURL(url).catch(() => onExternalLinkFailed?.(url));
}
return false;
```
([DocumentView.tsx:205-210](src/screens/viewer/DocumentView.tsx#L205-L210))

**Warum das ein Problem ist.** Die Rückfrage unterscheidet nicht zwischen einem
angetippten Link und einer Navigation aus dem Skript heraus. `location.href =
'https://…'` beim Laden des Dokuments öffnet damit ungefragt den Systembrowser
— mit einer Adresse, die den Dokumentinhalt als Parameter tragen kann. Die
README-Abweichung sieht „externe Links im Dokument öffnen im Systembrowser"
ausdrücklich vor, meint dort aber den Griff des Nutzers.

**Auslöser.** Ein Dokument mit
`<script>location.href='https://example.com'</script>` importieren und öffnen.

**Behebung.** `request.isTopFrame` und — soweit der Baustein es liefert — die
Kennzeichnung als Nutzergeste auswerten; andernfalls die Adresse in einem Toast
mit Bestätigung anbieten, statt sie sofort zu öffnen. Aufwand **S–M**, Risiko
gering.

### S3 — Ordnernamen sind oben nicht eindeutig (niedrig)

**Beobachtung.** `public.folders` hat keine Eindeutigkeit über
`(owner_id, name)` ([schema.sql:12-23](supabase/schema.sql#L12-L23)), während
`pushFolders` den Namen als Ausweis benutzt:
`const known = folder.remoteId === null ? byName.get(folder.name) : …`
([push.ts:207-208](src/data/remote/push.ts#L207-L208)).

**Warum das ein Problem ist.** Legen zwei Geräte denselben Ordner an, bevor sie
abgleichen, entstehen zwei Zeilen mit demselben Namen. Der nächste Abruf reicht
beide herunter; lokal ist der Name der Primärschlüssel, also gewinnt willkürlich
eine — und die Dokumente der anderen verlieren ihre Zuordnung. Für `documents`
gibt es dieses Netz bereits (`documents_source_path_idx`,
[schema.sql:77-78](supabase/schema.sql#L77-L78)).

**Behebung.** `create unique index … on public.folders(owner_id, name) where
deleted_at is null`. Aufwand **S**, Risiko gering (vorhandene Doppel müssten
einmal aufgelöst werden).

### S4 — Bucket ohne Grenzen (niedrig)

**Beobachtung.**

```sql
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
```
([schema.sql:172-174](supabase/schema.sql#L172-L174))

Weder `file_size_limit` noch `allowed_mime_types`. Die Policies beschränken den
Zugriff korrekt auf den eigenen Präfix
([schema.sql:181-199](supabase/schema.sql#L181-L199)) — für `documents_update`
fehlt zwar ein `with check`, was hier aber unschädlich ist: Postgres zieht dann
den `using`-Ausdruck auch für die neue Zeile heran, ein Umhängen auf einen
fremden Präfix ist also nicht möglich.

**Warum das ein Problem ist.** Wer den Anon Key aus der APK zieht und — falls
Selbstregistrierung im Projekt offen steht — ein Konto anlegt, kann beliebig
große Dateien beliebigen Typs unter seinem eigenen Präfix ablegen, auf Kosten
des Projektkontingents. Kein Zugriff auf fremde Daten, aber ein offener
Speicher.

**Behebung.** `file_size_limit` (z. B. 10 MB) und
`allowed_mime_types = '{text/html}'` setzen; zusätzlich im Supabase-Dashboard
prüfen, ob Selbstregistrierung deaktiviert ist — die App braucht sie nicht, das
Konto legt `scripts/account.mjs` an. Aufwand **S**, Risiko gering.

### S5 — `folder_id` wird nicht gegen den Besitzer geprüft (niedrig)

**Beobachtung.** `folder_id uuid references public.folders(id) on delete set
null` ([schema.sql:29](supabase/schema.sql#L29)); die Policy prüft nur
`owner_id = auth.uid()`
([schema.sql:165-166](supabase/schema.sql#L165-L166)).

**Warum das ein Problem ist.** Ein Konto könnte ein eigenes Dokument auf einen
fremden Ordner zeigen lassen (die Kennung müsste geraten werden). Lesen kann es
ihn dadurch nicht — RLS auf `folders` bleibt wirksam —, es entstünde nur eine
Zeile, die auf etwas Unsichtbares zeigt. Bei einem Ein-Konto-Projekt praktisch
folgenlos; der Vollständigkeit halber genannt.

**Behebung.** Bedingung in der Policy ergänzen (`folder_id is null or exists
(select 1 from public.folders f where f.id = folder_id and f.owner_id =
auth.uid())`). Aufwand **S**, Risiko gering.

### Ausdrücklich geprüft und ohne Befund

- **SQL-Injektion:** Jede Abfrage in `repository.ts` bindet Werte über `?`.
  Zusammengesetzt werden ausschließlich Platzhalterlisten
  (`ids.map(() => '?')`), Spaltennamen aus der festen `columns`-Zuordnung
  ([repository.ts:87-105](src/data/db/repository.ts#L87-L105)) und die
  `mine()`-Ausdrücke aus fest verdrahteten Spaltennamen. `PRAGMA user_version =
  ${SCHEMA_VERSION}` interpoliert eine Konstante aus dem eigenen Modul. Kein
  Nutzerwert erreicht je den SQL-Text.
- **Secrets:** `.env` und `.env.local` stehen in `.gitignore`, sind nicht
  eingecheckt (`git ls-files` findet nichts), und der Service-Role-Key kommt
  weder in `src/` noch in `app/` noch im Web-Export unter `dist/` oder in
  `android/` vor. In der Historie (15 Commits, alle Refs durchsucht) tauchen nur
  die Wortmarken aus Dokumentation und Skript auf, kein Schlüsselmaterial. Im
  Bundle landen ausschließlich `EXPO_PUBLIC_SUPABASE_URL` und der Anon Key —
  richtig, solange RLS steht.
- **RLS:** Auf `folders`, `documents` und `user_settings` aktiviert, Policy je
  Tabelle `for all using (owner_id = auth.uid()) with check (owner_id =
  auth.uid())`; `owner_id` lässt sich damit auch nicht auf ein fremdes Konto
  umschreiben ([schema.sql:158-168](supabase/schema.sql#L158-L168)).
- **Schichtgrenzen:** Kein Screen und keine Komponente in `src/ui/` importiert
  `data/db/*` — die Regel „SQL nur im Repository" hält. Einzige verkehrte
  Richtung ist C5.
- **Abmelden:** Das lokale Löschen des Bestands unterbleibt bewusst
  ([supabase.ts:132-142](src/data/supabase.ts#L132-L142)) und ist in `noteOwner`
  sauber begründet; bei einem Kontowechsel werden `remote_id`, Grabsteine und
  Wasserzeichen verworfen
  ([repository.ts:997-1013](src/data/db/repository.ts#L997-L1013)). Ein
  Restrisiko bleibt: Zeilen des Vorbenutzers behalten `storage_path` auf ein
  fremdes Konto und lassen sich nach dem Wechsel nicht mehr öffnen — als
  bewusste Abweichung im Kommentar festgehalten.

## 4. Modularisierungsplan

### Zielbild

```
src/data/db/
  schema.ts                    unverändert
  persist.ts                   unverändert
  connection.ts        NEU     database(), migrate(), seedIfEmpty(), toBind()
  rows.ts              NEU     DocumentRow, toDocument(), columns, DocumentPatch
  repos/
    documents.ts       NEU     loadSnapshot, insertDocument, updateDocuments,
                               expiredTrashIds, deleteDocuments, clearLibrary
    folders.ts         NEU     upsertFolder, renameFolder, deleteFolder,
                               readFoldersForPush, setFolderRemoteId,
                               readFolderDeletions, clearFolderDeletions
    outbox.ts          NEU     PUSHABLE, queueForPush, parseFields, readOutbox,
                               clearOutbox, countOutbox, readUploadable,
                               markUploaded
    settings.ts        NEU     setSetting, readSettings, writeSettings,
                               SYNCED_SETTING_KEYS
    syncState.ts       NEU     SyncStateKey, readSyncState, writeSyncState,
                               noteOwner
    remote.ts          NEU     RemoteFolder/RemoteDocument/RemoteSnapshot,
                               mine(), applyRemote
    migrations.ts      NEU     migrateLocalIdsToUuid, adoptScrollPositions,
                               moveScrollPosition
  repository.ts        BLEIBT  nur noch Barrel: export * from './repos/…'

src/data/remote/
  push.ts              BLEIBT  nur noch pushChanges() (Ablauf + Fehlerbündelung)
  push/folders.ts      NEU     pushFolders, tokenFor
  push/uploads.ts      NEU     uploadNewDocuments
  push/fields.ts       NEU     column(), iso(), Feldschleife
  push/settings.ts     NEU     pushSettings, parseSnapshot

src/screens/viewer/
  ViewerScreen.tsx     BLEIBT  Aufbau der Ebenen + Zusammenspiel
  useDocumentHtml.ts   NEU     Nachladen + Cache-Lesen (ViewerScreen:265-328)
  useFindInDocument.ts NEU     findId, sendFind, handleLoaded, closeFind,
                               findResult (ViewerScreen:152-207)
  viewerMenu.tsx       NEU     menuItems samt zugehöriger Handler

src/ui/
  FilterChipRow.tsx    NEU     die vier festen Chips, einmal
```

Die Regel „SQL ausschließlich in `src/data/db/repository.ts`" bleibt sinngemäß
erhalten, wenn CLAUDE.md auf „ausschließlich unterhalb von `src/data/db/`"
umformuliert wird — der Schnitt entlang der Entitäten ist genau der im Auftrag
vorgeschlagene, und kein Aufrufer ändert sich, weil `repository.ts` als Barrel
stehen bleibt (`import * as repository from '…/repository'` in
[documents.ts:21](src/state/documents.ts#L21) und
[folders.ts:166](src/state/folders.ts#L166) gilt weiter).

### Reihenfolge, mechanische Schritte zuerst

1. **Rein mechanisch, ohne Verhaltensänderung.** *Nutzen hoch (Lesbarkeit,
   Auffindbarkeit), Risiko sehr gering — `npm run typecheck` deckt
   Verschiebefehler vollständig ab.*
   1. `rows.ts` und `connection.ts` herauslösen; `repository.ts` importiert
      sie. Kein Aufrufer sieht das.
   2. `repos/*.ts` anlegen, Funktionen unverändert verschieben,
      `repository.ts` auf `export *` reduzieren.
   3. `push/*.ts` analog; `push.ts` behält `pushChanges` und die
      Fehlerbündelung.
   4. `FilterChipRow` aus
      [FolderDetailScreen.tsx:315-336](src/screens/folders/FolderDetailScreen.tsx#L315-L336)
      und
      [LibraryHeader.tsx:243-269](src/screens/library/LibraryHeader.tsx#L243-L269)
      ziehen — einziger Unterschied ist `compact`, das als Prop mitgeht.
2. **Mit kleiner Verhaltensberührung.**
   5. `useDocumentHtml` und `useFindInDocument` aus `ViewerScreen` herauslösen.
      Beide kapseln Effekte mit `alive`-Wächtern; beim Verschieben muss die
      Abhängigkeitsliste unverändert bleiben, sonst ändert sich die
      Nachlade-Häufigkeit. *Nutzen mittel, Risiko mittel.*
   6. `viewerMenu.tsx`: die Menüeinträge sind Daten plus Rückrufe, der Schnitt
      ist sauber. *Nutzen mittel, Risiko gering.*
3. **Erst nach den Fehlerbehebungen.**
   7. Der feldweise Outbox-Schutz (B4) betrifft `repos/outbox.ts` und
      `repos/remote.ts` gleichzeitig — ihn vor dem Schnitt anzufassen hieße,
      dieselbe Stelle zweimal zu suchen.
   8. `search.ts` (412 Z.) ließe sich in `fold.ts` (Faltung samt Abbildung),
      `index.ts` (Puffer) und `query.ts` (Zerlegung, Rang, Ausschnitt) teilen.
      Zusammen mit B10 sinnvoll, für sich genommen kein dringender Schnitt.
      Dabei gehört `periodDays`/`SearchFilters` aus `state/search.ts` nach
      `data/` (C5) — es ist eine Filterdefinition, kein Zustand.

### Bewusst nicht geschnitten

`DocTile.tsx` (419 Z.), `SearchScreen.tsx` (417 Z.) und `InfoSheet.tsx`
(410 Z.) sind lang, aber je eine Sache: eine Kachel in mehreren Ausprägungen,
ein Screen, ein Sheet. Ein Schnitt allein entlang der Zeilenzahl brächte dort
nur eine Datei mehr. Ebenso bleibt `documentActions.tsx` wie es ist — die
Wiederverwendung zwischen Bibliothek und Ordner-Detail ist dort bereits
sauber gelöst.

## 5. Nicht abschließend geklärt

- **Speicherverhalten des Suchpuffers (B10).** Der Verbrauch je Dokument hängt
  an der Darstellung von `number[]` in Hermes. Auf dem Gerät zu prüfen: 200–300
  echte Dokumente laden, einmal suchen, dann `adb shell dumpsys meminfo
  host.exp.exponent` vor und nach dem Suchlauf vergleichen.
- **B7 (abgebrochene Migration).** Der Ablauf ist aus dem Code belegt, der
  Endzustand nicht ausprobiert. Prüfbar, indem man auf einer Kopie der Datenbank
  `user_version` auf 2 setzt, `storage_path` von Hand ergänzt und startet — die
  Meldung „duplicate column name" müsste dann bei jedem Start erscheinen.
- **B9 (Wettlauf beim Start).** Ob der Hydrat-Lauf tatsächlich gewinnt, hängt an
  Dateigröße und Verbindung. Nachweisbar mit je einem `console.time` in
  `readAndDistribute` und in `sync`, bei kaltem Start mit gefüllter Bibliothek.
- **S1/S2 (WebView).** Was die Android-WebView in Expo Go tatsächlich zulässt,
  ist nur auf dem Gerät zu prüfen: ein Testdokument mit
  `fetch('https://…', {method:'POST', body:document.documentElement.outerHTML})`
  und eines mit `location.href='https://…'` importieren und beobachten, ob die
  Anfrage hinausgeht bzw. der Browser aufgeht.
- **Supabase-Projekteinstellungen.** Ob Selbstregistrierung deaktiviert ist
  (relevant für S4) und ob RLS im laufenden Projekt wirklich aktiv ist, steht
  nur im Dashboard — `supabase/schema.sql` beschreibt den Soll-Zustand, nicht
  den ausgeführten. Prüfen mit `select relname, relrowsecurity from pg_class
  where relname in ('folders','documents','user_settings')`.
- **Verhalten bei mehr als 1000 Zeilen im Abruf.** PostgREST liefert
  standardmäßig höchstens 1000 Zeilen je Anfrage; `since()`
  ([pull.ts:73-82](src/data/remote/pull.ts#L73-L82)) setzt kein `range`. Weil
  aufsteigend nach `updated_at` sortiert und das Wasserzeichen auf den größten
  empfangenen Wert gesetzt wird, arbeitet sich der Abruf vermutlich über mehrere
  Läufe durch; hängen mehrere Zeilen an genau demselben Zeitstempel wie die
  letzte gelieferte, würden sie durch das `.gt()` allerdings übersprungen. Nur
  mit einem entsprechend gefüllten Projekt zu prüfen.
