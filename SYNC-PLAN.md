# Kompendium — Synchronisierung vervollständigen

Stand 20.08.2026. Ausgangspunkt: „Jetzt synchronisieren" läuft durch, meldet aber
dauerhaft **„Änderungen offen"**.

---

## 1. Befund

Der Abgleich scheitert nicht — er läuft vollständig durch (Push ohne Fehler, Pull
erfolgreich, `lastSyncedAt` frisch). Trotzdem steht danach `status: 'pending'`,
weil `countOutbox()` in `src/state/sync.ts` immer noch Einträge zählt.

Die Ursache steht in `src/data/remote/push.ts`:

```ts
case 'folderName':
  if (document.folderName !== null && entry.folderRemoteId === null) return undefined;
```

Ein Dokument, das in einen Ordner verschoben wurde, kann nur hochgehen, wenn der
Ordner oben eine Zeile hat (`folders.remote_id`). Bleibt nichts übrig, wird der
Eintrag übersprungen (`continue`) und **bleibt in der Outbox stehen**.

Und: `scripts/upload.mjs` legt in Supabase **überhaupt keine Ordner an** — es
schreibt nur Dokumentzeilen, `folder_id` bleibt NULL. Ordner entstehen
ausschließlich in der App, und dort bekommt keiner je ein `remote_id`. Damit ist
**jedes** in einen Ordner verschobene Dokument ein Eintrag, der prinzipiell nie
hochgehen kann. Der Status kann nicht mehr auf „Synchron" springen.

Ein zweiter, noch schlafender Fehler in `repository.upsertFolder`:
`INSERT OR REPLACE` ersetzt die **ganze** Zeile und setzt dabei ein vorhandenes
`remote_id` auf NULL zurück. Sobald Paket A steht, würde jede Farbänderung an
einem Ordner die Zuordnung nach oben wieder zerstören.

---

## 2. Zielbild

> „Wenn ich mich auf einem neuen Gerät anmelde, ist alles gleich — Ordner,
> Gelesen, HTML-Dokumente."

Was heute davon oben ankommt:

| Inhalt | Status heute |
|---|---|
| Titel, Notiz, Favorit, Papierkorb | geht hoch ✔ (nur für PC-Dokumente) |
| Gelesen / Archiviert (`read_at`, `archived_at`) | geht hoch ✔ (nur für PC-Dokumente) |
| Öffnungszähler, zuletzt geöffnet | geht hoch ✔ |
| **Ordner und Ordnerzuordnung** | **fehlt komplett** — das ist die Blockade |
| **Am Handy importierte HTML-Dokumente** | **bleiben für immer lokal** |
| Ordnerfarbe, „Ordner offline behalten" | Spalte oben fehlt |
| **Identität auf einem zweiten Gerät** | **anonym pro Gerät — neues Gerät sieht nichts** |
| Leseposition, Darstellung, Sortierung | nur lokal (`settings`) |

---

## 3. Reihenfolge

| Paket | Inhalt | Wirkung | Schema |
|---|---|---|---|
| **A** | Ordner nach Supabase | löst die gelbe Leiste | lokal 5 · `folders.keep_offline` oben |
| **B** | Dokumente vom Handy hochladen | Bestand oben vollständig | lokal 6 |
| **C** | Identität (E-Mail statt anonym) | zweites Gerät überhaupt möglich | — |
| **D** | Einstellungen & Leseposition | Komfort | lokal 7 · `user_settings` oben |

A ist die Blockade, B und C sind die Voraussetzung fürs Zielbild, D ist Kür.
Jedes Paket ist für sich lauffähig und einzeln prüfbar.

---

## Paket A — Ordner nach Supabase

**Problem:** siehe Befund. Ohne `folders.remote_id` bleibt die Outbox ewig voll.

**Entwurfsentscheidungen**

- **Keine zweite Outbox für Ordner.** Der Push vergleicht den lokalen
  Ordnerbestand direkt mit oben. Bei einer Handvoll Ordner ist das der
  einfachere richtige Weg, und der Name bleibt der Ausweis (CLAUDE.md:
  „Ordner sind ein Name, kein Fremdschlüssel").
- **Löschen braucht einen Grabstein.** Eine gelöschte Zeile hinterlässt lokal
  nichts, was der Vergleich noch finden könnte.
- **Gleicher Name = derselbe Ordner.** Ein lokaler Ordner ohne `remote_id`
  übernimmt eine vorhandene Zeile gleichen Namens, statt eine zweite anzulegen.
- **Farbe zurückübersetzen.** Lokal steht ein Hex-Wert, oben gehört der
  Token-Name hin (`tagPalette`). Ohne Umkehrfunktion landet `#7DD3B0` in der
  Datenbank und der nächste Pull findet den Token nicht mehr.

```
Kontext: Kompendium (Expo/RN, C:\Projekte\Kompendium). CLAUDE.md beachten:
SQL ausschließlich in src/data/db/repository.ts, Schemaänderung = SCHEMA_VERSION
hochzählen + Migration, deutsche Kommentare, keine neuen nativen Module.

Problem: Es gibt keinen Push-Pfad für Ordner. Lokale Ordner haben deshalb nie ein
remote_id, und in src/data/remote/push.ts bleibt jeder Outbox-Eintrag, dessen einziges
Feld folderName ist, dauerhaft liegen (leere Nutzlast -> continue). Der Sync-Status
steht dadurch für immer auf "Änderungen offen". Ziel: Ordner und Ordnerzuordnung
gehen nach Supabase.

1) supabase/schema.sql
   - public.folders um "keep_offline boolean not null default false" ergänzen
     (add column if not exists, im Stil der übrigen ALTERs).
   - Kommentar ergänzen, warum die Ordnerfarbe als Token-Name gespeichert bleibt.
   Das SQL muss im Supabase-Editor erneut ausführbar sein, ohne Daten zu verlieren.

2) src/data/db/schema.ts
   - SCHEMA_VERSION auf 5.
   - Neue Tabelle folder_deletions (remote_id TEXT PRIMARY KEY NOT NULL,
     queued_at INTEGER NOT NULL) in createSchemaSql UND als Migration to: 5.
     Zweck im Kommentar: ein gelöschter Ordner hinterlässt lokal nichts, was der
     Push noch vergleichen könnte — der Grabstein ist die einzige Spur.

3) src/data/db/repository.ts
   - upsertFolder: INSERT OR REPLACE ersetzen durch
     INSERT ... ON CONFLICT(name) DO UPDATE SET color = excluded.color,
     keep_offline = excluded.keep_offline. Grund im Kommentar: REPLACE ersetzt die
     ganze Zeile und setzt remote_id auf NULL — danach ist der Ordner oben nicht
     mehr auffindbar und die Dokument-Einträge hängen wieder fest.
   - deleteFolder: in derselben Transaktion einen Grabstein schreiben, falls die
     Zeile ein remote_id hatte.
   - Neue Funktionen (nur SQL, keine Supabase-Kenntnis):
       readFoldersForPush(): name, color, keepOffline, remoteId
       setFolderRemoteId(name, remoteId)
       readFolderDeletions() / clearFolderDeletions(remoteIds)
   - applyRemote: keep_offline nicht mehr hart als 0 einfügen, sondern aus dem
     Snapshot übernehmen und im ON CONFLICT mitpflegen.

4) src/data/remote/pull.ts
   - RemoteFolder um keepOffline erweitern (row.keep_offline === true).

5) src/data/remote/push.ts — neue Funktion pushFolders(), aufgerufen als erster
   Schritt in pushChanges(), vor der Dokumentschleife (die Dokument-Einträge
   brauchen das frisch gesetzte remote_id noch im selben Lauf).
   Ablauf:
   - Grabsteine zuerst: deleted_at = now() auf die betroffenen Zeilen, danach
     clearFolderDeletions für alles, was durchging.
   - Ordner MIT remote_id: update auf name, color, keep_offline.
   - Ordner OHNE remote_id: erst per select nach name (deleted_at is null) suchen.
     Gefunden -> vorhandene Zeile übernehmen und deren id per setFolderRemoteId
     lokal festhalten (Entscheidung: gleicher Name = derselbe Ordner). Nicht
     gefunden -> insert mit .select('id').single() und die zurückgegebene id
     ebenso festhalten. owner_id nicht mitschicken, das erledigt der Default.
   - Farbe zurückübersetzen: lokal Hex, oben Token-Name aus theme/colors
     (tagPalette). Umkehrfunktion zu colorFor in pull.ts, Rückfall 'slate'.
     Kein Hex in die Datenbank schreiben.
   - Fehler sammeln wie in der Dokumentschleife und am Ende gemeinsam melden.

6) src/data/remote/push.web.ts entsprechend als No-op mitziehen, falls dort etwas
   exportiert werden muss (Web ist nur Screenshot-Vergleich).

Nicht anfassen: das Verhalten von column() für folderName (undefined bleibt
richtig), queueForPush, sampleLibrary.ts.

Prüfen:
- npm run typecheck und npm run lint:tokens laufen sauber.
- schema.sql im Supabase-Editor ausführen, Spalte keep_offline ist da.
- Gerät: Einstellungen -> "Jetzt synchronisieren". Status muss danach auf
  "Synchron" stehen; Tabelle folders in Supabase enthält die Ordner der App mit
  Token-Namen in color.
- documents.folder_id ist bei den verschobenen Dokumenten gefüllt.
- Ordner umbenennen -> synchronisieren -> Name oben geändert, id gleich, Dokumente
  hängen weiter dran.
- Ordner löschen -> synchronisieren -> deleted_at gesetzt, Dokumente behalten ihre
  Zeile mit folder_id null.
- Ordnerfarbe ändern -> synchronisieren -> danach ein Dokument in denselben Ordner
  schieben und erneut synchronisieren: der Eintrag geht durch (das war der
  upsertFolder-Fehler).
```

---

## Paket B — Dokumente vom Handy hochladen

**Problem:** `importDocument.ts` legt jede Zeile mit `storagePath: null` an, und
`queueForPush` nimmt Zeilen ohne `storage_path` bewusst nicht auf. Alles, was am
Handy importiert wurde, existiert also ausschließlich auf dem Handy — still, ohne
Hinweis in der Oberfläche.

**Der Stolperstein:** `public.documents.id` ist eine **uuid**, die lokalen
Import-IDs heißen `doc-import-mf3x…`. Diese Zeilen können nicht hochgehen, ohne
vorher eine echte UUID zu bekommen. Weil `cache_key` von `id` getrennt ist, muss
die Datei im Cache dabei nicht angefasst werden — nur der Schlüssel wandert.

Die ID-Umstellung ist eine Datenwanderung, kein `ALTER TABLE`, und gehört daher
**nicht** in `migrations` (dort steht nur SQL), sondern in eine einmalige,
über `sync_state` abgesicherte Funktion.

```
Kontext: Kompendium (Expo/RN, C:\Projekte\Kompendium). CLAUDE.md beachten:
SQL ausschließlich in src/data/db/repository.ts, deutsche Kommentare, keine neuen
nativen Module außerhalb des Expo-Go-SDK.
Voraussetzung: Paket A (Ordner-Push) ist eingebaut.

Problem: Am Handy importierte Dokumente haben storage_path = null und werden von
queueForPush bewusst ausgelassen. Sie erreichen Supabase nie und fehlen damit auf
jedem weiteren Gerät. Zusätzlich ist public.documents.id eine uuid, während lokale
Import-IDs "doc-import-..." heißen.

1) Abhängigkeit
   - npx expo install expo-crypto  (im Expo-Go-SDK enthalten, kein Dev Build).
     Gebraucht für randomUUID() und die sha256-Prüfsumme (content_hash).

2) src/data/importDocument.ts
   - newId() liefert künftig Crypto.randomUUID(). Kommentar: die Kennung ist
     dieselbe wie oben in Supabase (uuid) — eine eigene lokale Kennung mit
     Zuordnungstabelle daneben wäre eine zweite Wahrheit über dieselbe Zeile.

3) src/data/db/schema.ts + repository.ts — einmalige ID-Wanderung
   - SCHEMA_VERSION auf 6.
   - Die Wanderung selbst gehört NICHT in migrations (dort steht nur SQL). Neue
     Funktion im Repository, z. B. migrateLocalIdsToUuid(), einmalig aus
     state/hydrate.ts aufgerufen und über einen sync_state-Schlüssel
     ('uuid_ids_done') abgesichert.
   - Betroffen sind Zeilen mit storage_path IS NULL, deren id keine UUID ist.
     Je Zeile in EINER Transaktion: neue UUID setzen und alle Stellen mitziehen,
     die die alte id als Schlüssel benutzen — outbox.document_id, den
     Leseposition-Eintrag in settings und den Suchindex. cache_key bleibt
     unverändert, die Datei im Cache wird nicht umbenannt.
   - PRAGMA foreign_keys steht auf ON: Reihenfolge so wählen, dass der
     outbox-Fremdschlüssel nicht bricht (oder den Eintrag neu schreiben).

4) src/data/db/repository.ts — neue Funktionen
   - readUploadable(): Dokumente mit storage_path IS NULL, trashed_at IS NULL,
     cache_key IS NOT NULL, source != 'sample'.
   - markUploaded(id, storagePath, contentHash): setzt die Spalten nach
     erfolgreichem Upload, ohne die Outbox anzufassen.

5) src/data/remote/push.ts — neue Funktion uploadNewDocuments(), aufgerufen in
   pushChanges() NACH pushFolders() und VOR der Dokumentschleife.
   Je Dokument:
   - HTML aus dem lokalen Dateicache lesen (src/data/cache.ts).
   - sha256 über den Inhalt (expo-crypto) als content_hash.
   - Storage: upload auf `${userId}/${id}.html`, contentType
     'text/html; charset=utf-8', upsert true. Der Pfad MUSS mit der eigenen
     User-ID beginnen, sonst greift die Storage-Policy nicht.
   - Danach insert in public.documents mit: id (die lokale UUID), owner_id,
     folder_id (aus folders.remote_id, null wenn ohne Ordner), title, doc_type,
     source, storage_path, file_size, content_hash, preview_text (erste ~1200
     Zeichen Klartext über src/data/plainText.ts), note, is_favorite,
     keep_offline, open_count, opened_at, read_at, archived_at,
     created_at = importedAt.
   - ACHTUNG source: die CHECK-Bedingung oben erlaubt nur 'pc','file','clipboard',
     'url'. Der Beispielbestand ('sample') wird deshalb gar nicht erst
     hochgeladen — er ist Erstbefüllung, kein Bestand (siehe CLAUDE.md).
   - Bei Erfolg markUploaded aufrufen. Ab dann läuft die Zeile den normalen
     Outbox-Weg wie jedes PC-Dokument.
   - source_path NICHT setzen — den schreibt ausschließlich scripts/upload.mjs.
   - Fehler je Zeile sammeln und am Ende gemeinsam melden, wie in der
     Dokumentschleife.

6) Reihenfolge in pushChanges() dokumentieren:
   Ordner -> neue Dokumente -> geänderte Felder -> (danach pull in state/sync.ts).

Nicht anfassen: sampleLibrary.ts, die Duplikat-Rückfrage im Import, der Pull-Pfad.

Prüfen:
- npm run typecheck, npm run lint:tokens.
- Vor dem Test in der App nachsehen, dass ein am Handy importiertes Dokument da
  ist. Nach dem Start: die ID-Wanderung darf genau einmal laufen (zweiter Start
  ändert nichts mehr), das Dokument muss weiterhin öffnen und in der Suche
  auffindbar sein, die Leseposition erhalten bleiben.
- Synchronisieren -> die Zeile steht in Supabase, die Datei liegt im Bucket unter
  <owner>/<uuid>.html, storage_path lokal gefüllt.
- Dokument danach umbenennen und als gelesen markieren -> synchronisieren ->
  beides steht oben. (Beweis, dass die Zeile im normalen Outbox-Weg angekommen ist.)
- Ein Beispieldokument (source 'sample') darf NICHT hochgeladen werden.
- Flugmodus -> importieren -> Status "Änderungen offen", nach dem Einschalten
  geht der Upload nach.
```

---

## Paket C — Identität: E-Mail statt anonym

**Problem:** `data/supabase.ts` meldet sich mit `signInAnonymously()` an. Jede
Installation bekommt damit eine **eigene** `auth.uid()`. RLS filtert auf
`owner_id = auth.uid()` — ein zweites Gerät sieht also nichts, egal wie gut A und
B funktionieren. Auch `scripts/upload.mjs` schreibt gegen genau eine feste
`KOMPENDIUM_OWNER_ID` aus `.env.local`.

**Wichtigster Fallstrick:** Die bestehende anonyme Identität darf nicht ersetzt
werden. Wird sie es, sind alle vorhandenen Zeilen verwaist und nur noch mit dem
Service-Role-Key wieder zuzuordnen. Die E-Mail muss an die **vorhandene** uid
geknüpft werden.

```
Kontext: Kompendium (Expo/RN, C:\Projekte\Kompendium). CLAUDE.md beachten:
deutsche UI-Texte, keine neuen nativen Module, Farben/Größen nur aus src/theme.

Problem: src/data/supabase.ts meldet sich per signInAnonymously() an. Jede
Installation bekommt eine eigene auth.uid(); RLS filtert auf owner_id = auth.uid().
Ein zweites Gerät sieht deshalb einen leeren Bestand. Ziel: die vorhandene
anonyme Identität mit einer E-Mail verknüpfen und sich auf einem weiteren Gerät
mit derselben Identität anmelden können.

WICHTIG: Die bestehende uid muss erhalten bleiben. Kein signOut + neuer Login auf
dem Ersttgerät — sonst sind alle vorhandenen Zeilen verwaist.

1) src/data/supabase.ts
   - Neue Funktionen neben ensureSession():
       linkEmail(email): supabase.auth.updateUser({ email }) auf der laufenden
         anonymen Session. Das verknüpft, statt zu ersetzen.
       confirmEmail(email, token): supabase.auth.verifyOtp({ email, token,
         type: 'email_change' }).
       signInWithEmail(email): supabase.auth.signInWithOtp({ email }) für das
         Zweitgerät, plus verifyOtp({ type: 'email' }).
       currentIdentity(): { userId, email | null, anonymous: boolean }.
   - Bewusst OTP-Code statt Magic Link: ein Link bräuchte einen Deep-Link-Rückweg,
     den Expo Go nicht verlässlich bedient. Der sechsstellige Code aus derselben
     Mail funktioniert überall. Als Kommentar festhalten.
   - ensureSession: NICHT mehr blind anonym anlegen, wenn gerade ein
     Anmeldevorgang läuft. Einen Schalter/Guard vorsehen, damit auf dem
     Zweitgerät nicht zuerst eine anonyme Identität entsteht, die den ersten Pull
     leer laufen lässt.

2) src/screens/settings/SettingsScreen.tsx
   - Neuer Abschnitt "Konto" über oder unter der Sync-Leiste, im Stil der
     vorhandenen SettingsList-Einträge:
       Zustand anonym  -> "Gerät verknüpfen" -> Sheet: E-Mail eingeben ->
         Code eingeben -> Erfolg: "Verknüpft mit <mail>".
       Zustand verknüpft -> E-Mail anzeigen, Aktion "Abmelden" mit Warnhinweis,
         dass lokale Daten auf diesem Gerät bleiben.
   - Für die Eingabe die vorhandenen Bausteine benutzen (BottomSheet,
     SearchField/TextInput-Stil, Button), keine neue Komponente erfinden.
   - Fehlertexte deutsch und konkret ("Der Code stimmt nicht.", "Diese Adresse
     wird schon von einem anderen Konto benutzt.").

3) Zweitgerät-Pfad
   - Ist noch keine Session vorhanden und der Nutzer meldet sich per E-Mail an,
     läuft danach der normale erste Pull. Prüfen, dass der einmalige Schnitt
     (reset_done in sync_state) dort korrekt greift: der Beispielbestand geht,
     bevor die erste echte Zeile kommt.

4) scripts/upload.mjs
   - Nur den Hinweistext bei falscher/fehlender KOMPENDIUM_OWNER_ID ergänzen:
     das ist jetzt die uid des verknüpften Kontos, nicht mehr die einer
     anonymen Gerätesitzung. Logik unverändert.

5) supabase/SETUP.md
   - Abschnitt ergänzen: E-Mail-Auth im Dashboard aktivieren, Bestätigungsmail
     mit OTP-Code, und der Ablauf "Erstgerät verknüpfen -> Zweitgerät anmelden".

Prüfen:
- npm run typecheck, npm run lint:tokens.
- Erstgerät: verknüpfen, Code eingeben. Danach in Supabase unter Authentication
  prüfen, dass es DIESELBE User-ID ist wie vorher (is_anonymous jetzt false).
  Der Bestand in der App ist unverändert vollständig.
- Synchronisieren funktioniert weiter, Status "Synchron".
- Zweites Gerät (oder App-Daten löschen): anmelden mit derselben E-Mail ->
  Ordner, Dokumente, Gelesen-Status kommen an.
- npm run upload läuft weiterhin gegen dieselbe Kennung durch.
```

---

## Paket D — Einstellungen und Leseposition

**Problem:** Leseposition, Textgröße, Sortierung und Darstellung stehen nur in
der lokalen Tabelle `settings`. Auf dem zweiten Gerät fängt man damit wieder bei
null an.

**Entwurfsentscheidung:** Die Leseposition gehört zum Dokument und geht als
Spalte über die vorhandene Outbox mit. Alles andere ist Nutzervoreinstellung und
bekommt eine eigene, kleine Tabelle je Konto.

```
Kontext: Kompendium (Expo/RN, C:\Projekte\Kompendium). CLAUDE.md beachten.
Voraussetzung: Pakete A bis C sind eingebaut.

Ziel: Leseposition und Darstellungseinstellungen überleben den Gerätewechsel.

1) supabase/schema.sql
   - public.documents um "scroll_offset int not null default 0" ergänzen.
   - Neue Tabelle public.user_settings (owner_id uuid not null default auth.uid(),
     key text not null, value text not null, updated_at timestamptz not null
     default now(), primary key (owner_id, key)) mit RLS-Policy und
     touch_updated_at-Trigger im Stil der vorhandenen Tabellen.

2) src/data/db/schema.ts
   - SCHEMA_VERSION auf 7, ALTER TABLE documents ADD COLUMN scroll_offset INTEGER
     als Migration to: 7.
   - Die Leseposition wandert damit aus dem settings-Schlüssel in die
     Dokumentzeile. Einmalige Übernahme der vorhandenen Werte im selben Zug wie
     die ID-Wanderung aus Paket B (eigener sync_state-Schlüssel), danach den
     alten settings-Eintrag entfernen.

3) src/state/viewer.ts + repository.ts
   - rememberScroll schreibt künftig in die Dokumentzeile und meldet das Feld an
     die Outbox (PUSHABLE erweitern), aber GEDROSSELT: nicht bei jedem
     Scroll-Ereignis. Vorschlag: beim Verlassen des Viewers und beim Wechsel in
     den Hintergrund. Begründung als Kommentar — sonst steht die Outbox bei
     jedem Lesen voll.

4) src/data/remote/push.ts / pull.ts
   - column(): 'scrollOffset' -> { name: 'scroll_offset' }.
   - RemoteDocument um scrollOffset erweitern, applyRemote pflegt die Spalte mit.
   - Neue Funktionen pushSettings()/pullSettings() für user_settings, aufgerufen
     am Ende von pushChanges() bzw. pullChanges(). Nur die Schlüssel aus
     src/state/appearance.ts und den Bibliothek-Voreinstellungen; gerätebezogene
     Schlüssel (Cachegrößen o. Ä.) bleiben ausdrücklich lokal — im Kommentar
     benennen, welche das sind.
   - Konflikt: der jüngere updated_at-Wert gewinnt. Für Voreinstellungen ist das
     ausreichend, eine Zusammenführung wäre hier Aufwand ohne Nutzen.

Prüfen:
- npm run typecheck, npm run lint:tokens.
- Dokument öffnen, weit scrollen, Viewer verlassen, synchronisieren ->
  scroll_offset steht oben.
- Textgröße und Sortierung ändern, synchronisieren -> user_settings gefüllt.
- Zweitgerät: nach dem Pull steht die Leseposition und die Darstellung so wie auf
  dem Erstgerät.
- Beim Lesen eines langen Dokuments darf der Status nicht dauernd zwischen
  "Synchron" und "Änderungen offen" springen (Drosselung wirkt).
```

---

## 4. Gotchas, die über alle Pakete gelten

- **`upsertFolder` mit `INSERT OR REPLACE`** löscht `remote_id`. Fix in Paket A,
  aber bei jeder künftigen Änderung an der Ordnerzeile im Blick behalten.
- **Reihenfolge im Push:** Ordner → neue Dokumente → geänderte Felder → Pull.
  Andersherum fehlt jeweils der Fremdschlüssel oder man holt sich den alten Stand
  zurück, den man gerade überschreiben wollte.
- **`updated_at` nie mitschicken.** Das Wasserzeichen ist ein Server-Zeitstempel;
  eine nachgehende Gerätezeit würde die Zeile dauerhaft unter dem Wasserzeichen
  begraben. (Steht schon so in `push.ts` — nicht aufweichen.)
- **`source`-CHECK oben kennt kein `'sample'`.** Der Beispielbestand darf nie
  hochgeladen werden.
- **`storage_path` muss mit der eigenen User-ID beginnen**, sonst greift die
  Storage-Policy nicht.
- **Farben:** oben Token-Name, unten Hex. Übersetzt wird nur an der Grenze
  (`pull.ts` / neuer Gegenpart in `push.ts`).
- **Status `pending` ist eine Auskunft, keine Vermutung.** Bleibt er nach einem
  erfolgreichen Lauf stehen, liegt ein Eintrag in der Outbox, den der Push still
  überspringt — genau die Klasse Fehler, die dieses Dokument auslöst. Für die
  Zukunft überlegenswert: einen Eintrag, der mehrfach übersprungen wurde, in den
  Einstellungen unter der Statuszeile benennen, statt ihn nur zu zählen.
