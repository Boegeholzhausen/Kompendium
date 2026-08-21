# Database Structure — Kompendium

Zwei Datenschichten: **Supabase** (Postgres + Storage, Sync-Ziel) und
**expo-sqlite** (lokale Wahrheitsquelle der App, `src/data/db/`). Die App
liest und schreibt ausschließlich lokal; Supabase ist ein Hintergrund-Ziel,
noch nicht produktiv verdrahtet (`state/sync.ts` führt den Zustandsverlauf
bisher nur vor).

Leitprinzip **Ablage ≠ Ordnung**:

| | Ablage | Ordnung |
|---|---|---|
| Was | Die HTML-Dateien selbst | Ordner, Status, Favoriten, Titel, Notizen |
| Wo | Supabase Storage, ein flacher Bucket | Postgres-Tabellen / SQLite-Spiegel |
| Struktur | Keine. Dateiname = `<uuid>.html` | Beliebig komplex, jederzeit änderbar |
| Änderbar von | PC (künftiges Upload-Skript), Handy (Import) | Handy **und** PC, sync synchron |

Konsequenz: Ein Dokument in einen Ordner verschieben ändert nie eine Datei,
nur eine Datenbankzeile.

---

## Supabase (Postgres) — `supabase/schema.sql`

### Tabelle `folders`

| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | uuid, PK | `gen_random_uuid()` |
| `owner_id` | uuid | Default `auth.uid()`, RLS-Schlüssel |
| `parent_id` | uuid → `folders.id` | `on delete cascade` |
| `name` | text | |
| `icon` | text | Phosphor-Icon-Name |
| `color` | text | Token-Name aus der Palette, kein Hex, Default `mint` |
| `sort_order` | int | Default 0 |
| `keep_offline` | boolean | Default `false` — „Inhalt offline behalten" gilt für den Nutzer, nicht für ein Gerät |
| `created_at` / `updated_at` | timestamptz | `updated_at` per Trigger fortgeschrieben |
| `deleted_at` | timestamptz | Soft Delete |

### Tabelle `documents`

| Spalte | Typ | Bemerkung |
|---|---|---|
| `id` | uuid, PK | |
| `owner_id` | uuid | RLS-Schlüssel |
| `folder_id` | uuid → `folders.id` | `on delete set null` |
| `title` | text | aus `<title>`, überschreibbar |
| `description` | text | |
| `note` | text | freie Notiz |
| `storage_path` | text | `<owner_id>/<id>.html` |
| `file_size` | bigint | |
| `content_hash` | text | sha256 → Änderungserkennung |
| `preview_text` | text | erste ~1200 Zeichen Klartext |
| `doc_type` | text | `table` / `chart` / `text` / `calculator` / `list` — beim Import einmal erkannt und persistiert, ändert sich zwischen Sitzungen nicht |
| `is_favorite` | boolean | Default `false` |
| `keep_offline` | boolean | Default `false` |
| `opened_at` | timestamptz | |
| `open_count` | int | Default 0 |
| `source` | text | `pc` / `file` / `clipboard` / `url` |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | Soft Delete = Papierkorb, 30 Tage |
| `read_at` | timestamptz | Workflow-Status: gelesen; `null` = ungelesen |
| `archived_at` | timestamptz | Workflow-Status: archiviert (zweite Achse) |
| `scroll_offset` | int | Leseposition in dp, Default 0 — gehört zum Dokument und geht über die Outbox mit |
| `source_path` | text | Pfad der Datei im HTML-Ordner am PC; nur `scripts/upload.mjs` schreibt ihn |
| `search_vector` | tsvector, generiert | Volltextsuche Deutsch, gewichtet Titel (A) > Beschreibung (B) > Vorschautext (C), GIN-Index |

Indizes: `documents_search_idx` (GIN auf `search_vector`),
`documents_updated_idx` (`owner_id, updated_at` — Pull-Wasserzeichen),
`documents_folder_idx` (`owner_id, folder_id`).

### Tabelle `user_settings`

| Spalte | Typ | Bemerkung |
|---|---|---|
| `owner_id` | uuid | Default `auth.uid()`, RLS-Schlüssel, Teil des PK |
| `key` | text | Teil des PK |
| `value` | text | |
| `updated_at` | timestamptz | per Trigger; der jüngere Wert gewinnt |

Schlüssel-Wert statt Spaltensatz: die Menge wächst mit jeder neuen
Einstellung, und jede davon wäre sonst eine Migration auf beiden Seiten.
Hoch gehen ausschließlich die Schlüssel aus `SYNCED_SETTING_KEYS`
(`repository.ts`) — Textgröße, Abdunkeln, Bildschirm anlassen, Ansicht,
Sortierung. Gerätebezogenes bleibt lokal: `search.recentQueries` ist ein
Verlauf dieses Geräts und keine Voreinstellung des Nutzers.

### Weggefallen: `tags` und `document_tags`

Beide Tabellen sind mit dem Workflow-Status entfallen (siehe README,
„Abweichungen"). Der Status ist ein einwertiger Lebenszyklus und steht
deshalb als Spalte in der Dokumentzeile, nicht als Zuordnung. Eigene
RLS-Regeln braucht das nicht: die Rechte hängen an der Zeile, nicht an der
Spalte.

### Trigger, RLS, Storage

- **`touch_updated_at`**-Trigger auf allen Tabellen setzt `updated_at`
  bei jedem Update automatisch — das Pull-Wasserzeichen der App verlässt
  sich darauf. Soft Delete setzt `deleted_at` **und** `updated_at`, damit
  Löschungen durch dasselbe Wasserzeichen mitkommen, ohne Sonderweg.
- **RLS** auf allen Tabellen aktiv, je eine Policy `owner_id = auth.uid()`
  für `all` (select/insert/update/delete). Damit ist der Publishable/Anon Key
  gefahrlos in der App.
- **Storage:** privater Bucket `documents` (flach, Dateiname `<uuid>.html`),
  vier Policies (`documents_read/write/update/delete`), die den Zugriff auf
  den eigenen Pfad-Präfix (`(storage.foldername(name))[1] = auth.uid()::text`)
  beschränken.
- **Auth:** ein Konto mit E-Mail und Passwort, angemeldet über ein Sheet in den
  Einstellungen (`screens/settings/LoginSheet.tsx`). Kein Anmeldeschirm vor der
  App: die lokale Datenbank ist die Wahrheitsquelle, jeder Screen rendert
  offline vollständig — ein Schirm davor machte die Bibliothek ohne Netz
  unbenutzbar. Nicht angemeldet ist ein normaler Zustand (`signed-out` im
  Sync-Status), kein Fehler.
  Die Session liegt in AsyncStorage und überlebt den Neustart; das Passwort
  wird nirgends abgelegt. Im App-Bundle stehen nur URL und Anon Key, beide ohne
  Anmeldung wertlos.
  **Kein anonymer Rückfall:** er wäre neben einem Login eine Falle — nach dem
  Abmelden entstünde still eine zweite Identität mit leerer Bibliothek.
  Das Konto selbst legt `scripts/account.mjs` (`npm run konto`) an: es setzt
  E-Mail und Passwort per `auth.admin.updateUserById` an der **vorhandenen**
  Zeile, damit die Kennung bleibt — sonst wären alle bisherigen Zeilen
  verwaist.

---

## Lokal — expo-sqlite (`src/data/db/schema.ts`)

`SCHEMA_VERSION = 7`, Datenbankname `kompendium.db`. Sechs Tabellen:

| Tabelle | Zweck |
|---|---|
| `documents` | eine Zeile je Dokument, mit allem, was ein Screen zeigt |
| `folders` | Name (zugleich Ausweis, PK), Farbe, „Inhalt offline behalten", `remote_id` |
| `outbox` | was lokal geändert wurde und noch nach oben muss |
| `folder_deletions` | Grabsteine gelöschter Ordner (`remote_id`, `queued_at`) |
| `settings` | Schlüssel-Wert-Paar für Darstellung und Bibliothek-Voreinstellungen |
| `sync_state` | Buchhaltung des Abgleichs (siehe unten) |

`documents`-Spalten: `id` (PK, seit Version 6 eine **UUID** — dieselbe wie
oben), `title`, `doc_type`, `folder_name`, `favorite`, `cached`, `size_bytes`,
`updated_at`, `imported_at`, `open_count`, `last_opened_at` (seit Version 2),
`note`, `keep_offline`, `trashed_at`, `source`, `cache_key`, `storage_path`,
`content_hash` (beide seit Version 3), `read_at`, `archived_at` (beide seit
Version 4), `scroll_offset` (seit Version 7).

`sync_state`-Schlüssel: `last_pulled_at` (Wasserzeichen, ein **Server**-
Zeitstempel), `reset_done` (einmaliger Schnitt vom Beispiel-Bestand),
`uuid_ids_done` und `scroll_moved` (die beiden einmaligen Datenwanderungen),
`settings_pushed` (was zuletzt an `user_settings` hochging) und `owner_id`
(unter welcher Identität abgeglichen wurde).

**Warum Ordner keine Outbox haben:** bei einer Handvoll Ordner ist der direkte
Vergleich des ganzen Bestands mit oben der einfachere richtige Weg
(`readFoldersForPush`). Genau ein Fall entzieht sich dem Vergleich — eine
gelöschte Zeile hinterlässt lokal nichts, was er noch finden könnte. Dafür gibt
es `folder_deletions`.

`read_at` und `archived_at` sind zwei Spalten und nicht eine Status-Spalte
mit drei Werten: Archiv ist eine zweite Achse neben gelesen/ungelesen — ein
archiviertes Dokument ist in aller Regel auch gelesen, und mit nur einer
Spalte ginge beim Entarchivieren die Leseinformation verloren.

`outbox`-Spalten: `document_id` (PK, `references documents(id) on delete
cascade`), `fields` (JSON-Liste der geänderten Feldnamen), `queued_at`.
Gespeichert werden die **Namen**, nicht die Werte: die stehen in `documents`
und sind dort immer der neueste Stand — ein zweites Mal abgelegte Werte wären
eine zweite Wahrheit, die veralten kann.

Indizes: `documents_by_recent` (`trashed_at, updated_at DESC` — Bibliothek
sortiert nach zuletzt geändert und blendet den Papierkorb aus, genau diese
beiden Spalten stehen deshalb im Index), `documents_by_folder`
(`folder_name`). Für den Workflow-Status gibt es keinen Index: gefiltert wird
in den Screens über den Bestand im Zustand, die Datenbank liefert `SELECT *`.

**Ordner sind ein Name, kein Fremdschlüssel:** `documents.folder_name` zeigt
direkt auf `folders.name` (PK). Der Prototyp zeigt überall den Namen, ein
zweiter Ausweis hätte in dieser App keinen Leser. Umbenennen fasst deshalb
beide Tabellen in einer Transaktion an (`repository.renameFolder`) — genau
eine Stelle im Code, an der das passiert.

**Migrationen:** `CREATE TABLE IF NOT EXISTS` legt eine fehlende Tabelle an,
ändert aber keine vorhandene — eine neue Spalte erreicht damit nur
Neuinstallationen und braucht eine `ALTER TABLE`-Migration in
`migrations`. Version 2 (Schritt 8): `last_opened_at` für "Zuletzt geöffnet
vor 6 Tagen" — vorhandene Zeilen bekommen `NULL`, ein erfundenes Datum wäre
schlechter als keins. Version 3: `storage_path`, `content_hash`,
`folders.remote_id`, `sync_state`. Version 4: `read_at` und `archived_at`,
`outbox`, und `document_tags`/`tags` fallen weg — in dieser Reihenfolge, denn
`document_tags` hängt per Fremdschlüssel an `tags` und `PRAGMA foreign_keys`
steht auf `ON`. Bestehende Zeilen starten mit `read_at = NULL`, sind also
ungelesen: was vor dem Umbau gelesen wurde, weiß niemand mehr, und "alles
gelesen" wäre eine Behauptung. Version 5: `folder_deletions`. Version 7:
`documents.scroll_offset`.

**Zwei Datenwanderungen stehen bewusst NICHT in `migrations`** — dort steht
ausschließlich SQL, und beide müssen Zeile für Zeile rechnen. Sie liegen im
Repository und sind über `sync_state` abgesichert, nicht über `user_version`:

- `migrateLocalIdsToUuid` (Version 6, Schlüssel `uuid_ids_done`) tauscht die
  alten `doc-import-…`-Kennungen gegen UUIDs. `public.documents.id` ist oben
  eine `uuid`; solche Zeilen konnten deshalb prinzipiell nie hochgehen. Je
  Zeile in einer Transaktion, weil der Outbox-Fremdschlüssel mitzieht — der
  Eintrag wird gemerkt, entfernt und unter der neuen Kennung neu geschrieben.
  `cache_key` bleibt unverändert: die Datei im Cache wird nicht umbenannt.
- `adoptScrollPositions` (Version 7, Schlüssel `scroll_moved`) holt die
  Lesepositionen aus dem `settings`-Schlüssel `viewer.scrollPositions` in die
  Dokumentzeile und entfernt den alten Eintrag. Läuft nach der ID-Wanderung:
  die Positionen sind nach der Dokumentkennung geschlüsselt.

**Zugriff:** `repository.ts` ist die einzige Stelle im Projekt mit SQL.
Screens und Zustand-Stores kennen die Datenbank nicht — sie lesen/schreiben
über die Stores in `src/state/`, die beim Start einmal `loadSnapshot()`
laden und Änderungen danach feldweise zurückschreiben (nie ganze Zeilen).

**Web-Fallback:** `expo-sqlite`/WASM braucht im Browser
Cross-Origin-Opener-/Embedder-Policy-Header, die ein einfacher
`python3 -m http.server` nicht schickt. `repository.web.ts` bietet deshalb
dieselbe Schnittstelle im Arbeitsspeicher; jeder Seitenaufruf startet dort
mit dem Beispiel-Bestand.

### Unterschied zum ursprünglichen Lösungskonzept

Das Lösungskonzept sah zusätzlich lokale Tabellen `cache_entries` (Datei-
Cache-Status mit LRU/Pins), `outbox` (Push-Warteschlange) und `sync_state`
(Sync-Wasserzeichen) sowie eine `documents_fts`-Volltextsuche vor. `sync_state`
gibt es seit Schemaversion 3, `outbox` seit Version 4; offen bleibt allein
`cache_entries` — der Dateicache läuft über `src/data/cache.ts`/`persist.ts`,
die Suche über `src/data/search.ts`.

Zwei Spalten sind gegenüber dem Konzept dazugekommen. Lokal tragen
`documents.storage_path` und `documents.content_hash` den Stand von oben mit,
damit der Viewer eine Datei nachladen kann und erkennt, wann die gecachte
veraltet ist; `folders.remote_id` hält die Zuordnung zwischen dem lokalen
Ausweis (dem **Namen**) und dem oberen (einer UUID). Oben trägt
`documents.source_path` den Pfad der Datei im HTML-Ordner am PC — daran
erkennt `scripts/upload.mjs` beim zweiten Lauf dieselbe Datei wieder.

Später dazugekommen: lokal `folder_deletions` (Grabsteine) und
`documents.scroll_offset`, oben `folders.keep_offline`,
`documents.scroll_offset` und die Tabelle `user_settings`.

---

## Sync-Strategie (Zielbild)

Bewusst simpel gehalten für einen Einzelnutzer mit zwei Geräten, kein Team
mit Merge-Konflikten.

**Stand:** Beide Richtungen sind gebaut — Push (`src/data/remote/push.ts`)
und Pull (`src/data/remote/pull.ts`), in dieser Reihenfolge, angestoßen beim
Start und über „Jetzt synchronisieren"; das Nachladen der Dateien ebenfalls
(`src/data/remote/download.ts`). `pending` heißt seitdem, was das Wort sagt:
die Outbox ist nicht leer (`countOutbox`). Ordner, am Handy importierte
Dokumente samt Datei, Leseposition und Voreinstellungen gehen inzwischen
ebenfalls hoch.

**Pull (Supabase → App):** Die App merkt sich `last_pulled_at` als
**Server**-Zeitstempel (nie die Gerätezeit, sonst driftet es). Bei App-Start,
Pull-to-Refresh und beim Wechsel in den Vordergrund:
`select * from <tabelle> where updated_at > last_pulled_at order by updated_at`,
Zeilen per `INSERT OR REPLACE` in SQLite schreiben, `last_pulled_at` auf das
größte empfangene `updated_at` setzen. Löschungen brauchen keinen
Sonderweg, weil Soft Delete `updated_at` mitsetzt.

**Push (App → Supabase), vier Schritte in fester Reihenfolge:**

1. **Ordner** (`pushFolders`). Grabsteine zuerst, dann der Bestand: Ordner mit
   `remote_id` werden fortgeschrieben, Ordner ohne einen erst über den Namen
   gesucht (*gleicher Name = derselbe Ordner*) und sonst angelegt. Die
   zurückgegebene `id` wird sofort lokal festgehalten. Die Farbe wird dabei
   zurück in den Token-Namen übersetzt (`tokenFor`, Gegenstück zu `colorFor`
   im Pull) — ein Hex-Wert oben wäre eine Kopie, die beim nächsten Feinschliff
   des Themes zurückbleibt.
2. **Neue Dokumente** (`uploadNewDocuments`). Alles ohne `storage_path`, mit
   Datei im Cache und `source != 'sample'`: HTML lesen, sha256 bilden, Datei
   nach `<owner_id>/<uuid>.html` legen, Zeile einfügen, `markUploaded`. Ab dann
   läuft das Dokument den normalen Outbox-Weg.
3. **Geänderte Felder** — die Outbox (unten).
4. **Voreinstellungen** (`pushSettings`) in `user_settings`.

Die Reihenfolge hängt fest: ein Dokument in einem Ordner kann nur hochgehen,
wenn der Ordner oben eine Zeile hat, und ein `update` auf eine Zeile, die es
oben nicht gibt, trifft nichts und meldet trotzdem Erfolg.

Wechselt die Identität (E-Mail-Anmeldung, Abmelden), verliert der Abgleich
zuerst seine Merkposten (`noteOwner`): Wasserzeichen, `folders.remote_id` und
`settings_pushed` sind dann Aussagen über ein fremdes Konto, und unter RLS
scheitert ein `update` darauf nicht — es trifft keine Zeile und meldet Erfolg.

**Die Outbox selbst:** Jede lokale Änderung schreibt sofort nach SQLite
(UI reagiert instant) und legt einen Outbox-Eintrag an. Das passiert an genau
einer Stelle — in `repository.updateDocuments`, im selben Zug wie das
Schreiben: dort läuft jede Änderung eines Screens durch, und damit kann
nichts vergessen werden. `pushChanges()` arbeitet die Outbox vor jedem Abruf
ab (`update`, nicht `upsert`: es geht nur um Zeilen, die es oben schon gibt,
und RLS greift über die Zeile). Erfolg löscht den Eintrag, aber nur bei
unverändertem `queued_at` — sonst ginge eine Änderung verloren, die während
des Hochschickens kam. Ein Fehler lässt den Eintrag stehen; der Abgleich
meldet `error` und versucht es beim nächsten Lauf erneut.

Abweichend vom Konzept schickt der Push **kein `updated_at`** mit: das
Wasserzeichen des Abrufs ist ein Server-Zeitstempel, und eine Gerätezeit
hineinzuschreiben könnte die Reihenfolge dauerhaft verderben.

**Konflikte:** Last-Write-Wins auf Zeilenebene — mit einer Ausnahme, die das
Konzept nicht vorsah: eine Zeile mit **offenem Outbox-Eintrag** behält beim
Abruf ihre Nutzerfelder. Sonst nähme der Pull zurück, was gerade offline
gewischt wurde, und der folgende Push schriebe den alten Wert wieder hoch.
Technische Felder (`doc_type`, `size_bytes`, `updated_at`, `source`,
`storage_path`, `content_hash`) kommen weiterhin immer vom Server.
Für `user_settings` gilt schlicht: der jüngere `updated_at`-Wert gewinnt — bei
einer Voreinstellung gibt es nichts zu vereinigen, nur zu wählen.

**Die Leseposition** steht seit Version 7 in `documents.scroll_offset` und
geht damit über dieselbe Outbox wie „gelesen". Geschrieben wird nur beim
Verlassen des Viewers und beim Wechsel in den Hintergrund (`flushScroll` in
`state/viewer.ts`): jede Schreibung reiht das Dokument in die Outbox ein, und
beim Lesen eines langen Textes spränge der Sync-Status sonst dauernd zwischen
„Synchron" und „Änderungen offen".

**Die Dateien selbst** gelten als unveränderlich. Ändert sich der Inhalt am
PC, ändert sich `content_hash`, und die App lädt beim nächsten Öffnen neu —
kein Diff, kein Merge. Cache-Regeln: Download erst beim ersten Öffnen, nicht
beim Sync; Cache-Budget (z. B. 200 MB) mit LRU-Verdrängung nach
`last_used_at`; gepinnte Dokumente ("Offline behalten") sind von der
Verdrängung ausgenommen; ein Ordner lässt sich komplett vorab laden.

**Der PC-Weg:** `scripts/upload.mjs`, aufzurufen mit `npm run upload -- <ordner>`.
Es macht pro Datei genau das, was das Konzept vorsah: sha256 bilden (bei
gleichem `content_hash` überspringen), `<title>`/`<meta name="description">`/
erste `<h1>` parsen, Markup strippen zu `preview_text`, die Datei in den
Storage-Bucket hochladen (`<owner_id>/<uuid>.html`), die Zeile in `documents`
anlegen bzw. aktualisieren. Neue Dokumente landen dabei nicht direkt irgendwo,
sondern unsortiert in der Sektion „Neu" — das ist der einzige Ort, der
Handlungsdruck erzeugen darf, und genau deshalb funktioniert das Sortieren.

Titel- und Typerkennung teilt sich das Skript mit dem Import in der App
(`src/data/detect.ts`, von Node direkt geladen): dieselbe Datei muss dieselbe
Kachel bekommen, gleich auf welchem Weg sie hereinkommt.

Zwei Dinge tut es bewusst nicht: sortieren und löschen. Verschwindet eine Datei
aus dem Ordner, bleibt ihre Zeile stehen — was in der Bibliothek liegt, wirft
der Nutzer weg, nicht ein Aufräumlauf im Hintergrund.

**Warum der Service-Role-Key:** Das Skript kann sich nicht mit dem Anon-Key
anmelden. Der hängt an einer anonymen Identität, und die des PCs wäre eine
andere als die des Handys — die App sähe die hochgeladenen Zeilen nie. Es
schreibt deshalb mit dem Service-Role-Key aus `.env.local` und setzt `owner_id`
selbst auf die Kennung des Geräts (sie steht in den Einstellungen unter
„Konto", und bei genau einer Identität im Projekt findet das Skript sie
allein). `npm run konto` ändert diese Kennung nicht — eine einmal eingetragene
`KOMPENDIUM_OWNER_ID` bleibt gültig. Dieser Schlüssel umgeht RLS vollständig und gehört ausschließlich
auf den Rechner — niemals in die App, niemals ins Repository.

---

## Supabase einrichten

Ca. 15–20 Minuten, zwei Schritte.

### 1. Supabase-Projekt

1. Auf **supabase.com** anmelden (GitHub oder E-Mail), Organisation anlegen
   (Plan Free reicht).
2. **New project**: Name `kompendium`, ein starkes Datenbank-Passwort im
   Passwortmanager sichern (Supabase zeigt es nie wieder), Region
   `Central EU (Frankfurt)`.
3. **SQL Editor → New query**: Inhalt von `supabase/schema.sql` einfügen,
   ausführen. Erwartetes Ergebnis: `Success. No rows returned`.
4. **Kontrolle RLS:** Table Editor öffnen — oben darf **kein** roter Hinweis
   „RLS is disabled" stehen; unter Authentication → Policies muss jede
   Tabelle mindestens eine Policy haben.
5. **Kontrolle Bucket:** Storage öffnen, Bucket `documents` muss existieren
   und **Private** sein.
6. **Authentication → Sign In / Providers:** `Anonymous sign-ins`
   aktivieren und speichern. Nur für den Anfang: bei einem frischen Projekt
   legt die App damit die erste Identität an, die in Schritt 7 zum Konto wird.
   Danach darf der Schalter wieder aus.
7. Am selben Ort **Email** aktivieren, dann einmal `npm run konto --
   "meine@adresse.de" "ein-langes-passwort"` und in der App unter
   *Einstellungen → Konto → Anmelden* eintippen. Schritt für Schritt:
   [supabase/SETUP.md](supabase/SETUP.md).

### 2. `.env` anlegen

```powershell
cd C:\Projekte\Kompendium
Copy-Item .env.example .env
```

Aus dem Dashboard (**Project Settings → API**) **Project URL** und
**anon/public key** eintragen:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefghijklm.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

Die Variablennamen müssen exakt so heißen (bei Expo mit `EXPO_PUBLIC_`
beginnend, sonst landen sie nicht im App-Bundle) — `src/data/supabase.ts`
liest genau diese beiden. Keine Anführungszeichen, keine Leerzeichen um
`=`, kein Zeilenumbruch im Key. Danach `npx expo start -c` (leert den
Metro-Cache, sonst erscheinen unter Umständen die alten leeren Werte).

**Sicherheit:** `.env` gehört nicht in Git (steht in `.gitignore`). Der Anon
Key ist zum Ausliefern gedacht und landet ohnehin im App-Bundle — er ist
kein Geheimnis, die Daten schützt allein RLS (deshalb Schritt „Kontrolle RLS"
ernst nehmen). Ein `service_role`-Key gehört **niemals** in die App, er
umgeht RLS komplett. Ohne `.env` startet die App trotzdem und läuft rein
lokal mit expo-sqlite (`isSupabaseConfigured` in `supabase.ts` prüft das).

### Fehlerbilder

| Symptom | Ursache | Lösung |
|---|---|---|
| SQL-Fehler `relation … already exists` | Skript lief schon (teilweise) | Bei neuem Projekt: frisches Supabase-Projekt anlegen |
| SQL-Fehler bei `storage.…` | Storage-Policies brauchen teils erhöhte Rechte | Rest des Skripts läuft; Bucket notfalls per Hand unter Storage → New bucket (`documents`, Private) anlegen |
| App startet, zeigt aber keine Daten | `.env` nicht geladen | `npx expo start -c`, Variablennamen gegen `.env.example` prüfen |
| Fehler „Anonymous sign-ins are disabled" | Schritt „Anonymous sign-ins" fehlt, und es gibt noch keine Identität | Provider einschalten, App einmal starten, dann Schritt 7 |
| Statuszeile sagt „Nicht angemeldet" | so gewollt, solange niemand angemeldet ist | Einstellungen → Konto → Anmelden |
| Alles leer, keine Fehlermeldung | RLS aktiv, aber `owner_id` wird beim Schreiben nicht gesetzt | Code-Thema, kein Setup-Thema |
| Nichts geht, App startet trotzdem | So gewollt: ohne `.env` läuft die App im lokalen Modus weiter | Kein Fehler, nur kein Sync |

## Referenzdokumente

- [TECH_STACK.md](TECH_STACK.md) — Architekturdiagramm, Pakete, Expo-Go-Grenzen
- [README.md](README.md) — Start, Produktbeschreibung, offene Punkte
- `C:\Projekte\HTML-Dokumenten-Ordner\Loesungskonzept-HTML-Dokumenten-App.md`
  — ursprüngliches Architektur- und Sync-Konzept (Original dieser Inhalte)
