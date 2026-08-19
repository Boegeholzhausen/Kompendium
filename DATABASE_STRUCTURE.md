# Database Structure — Kompendium

Zwei Datenschichten: **Supabase** (Postgres + Storage, Sync-Ziel) und
**expo-sqlite** (lokale Wahrheitsquelle der App, `src/data/db/`). Die App
liest und schreibt ausschließlich lokal; Supabase ist ein Hintergrund-Ziel,
noch nicht produktiv verdrahtet (`state/sync.ts` führt den Zustandsverlauf
bisher nur vor).

Leitprinzip **Ablage ≠ Ordnung**:

| | Ablage | Ordnung |
|---|---|---|
| Was | Die HTML-Dateien selbst | Ordner, Tags, Favoriten, Titel, Notizen |
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
| `search_vector` | tsvector, generiert | Volltextsuche Deutsch, gewichtet Titel (A) > Beschreibung (B) > Vorschautext (C), GIN-Index |

Indizes: `documents_search_idx` (GIN auf `search_vector`),
`documents_updated_idx` (`owner_id, updated_at` — Pull-Wasserzeichen),
`documents_folder_idx` (`owner_id, folder_id`).

### Tabellen `tags` und `document_tags`

`tags`: `id`, `owner_id`, `name`, `color` (Default `mint`), `created_at`,
`updated_at`, `deleted_at`, unique `(owner_id, name)`.

`document_tags`: `document_id` → `documents.id`, `tag_id` → `tags.id`,
`owner_id`, `updated_at`, `deleted_at`, PK `(document_id, tag_id)`, beide
Fremdschlüssel `on delete cascade`.

### Trigger, RLS, Storage

- **`touch_updated_at`**-Trigger auf allen vier Tabellen setzt `updated_at`
  bei jedem Update automatisch — das Pull-Wasserzeichen der App verlässt
  sich darauf. Soft Delete setzt `deleted_at` **und** `updated_at`, damit
  Löschungen durch dasselbe Wasserzeichen mitkommen, ohne Sonderweg.
- **RLS** auf allen vier Tabellen aktiv, je eine Policy `owner_id = auth.uid()`
  für `all` (select/insert/update/delete). Damit ist der Publishable/Anon Key
  gefahrlos in der App.
- **Storage:** privater Bucket `documents` (flach, Dateiname `<uuid>.html`),
  vier Policies (`documents_read/write/update/delete`), die den Zugriff auf
  den eigenen Pfad-Präfix (`(storage.foldername(name))[1] = auth.uid()::text`)
  beschränken.
- **Auth:** anonymes Sign-in (`supabase.auth.signInAnonymously()`), kein
  Login-Screen. Ein anonymer Nutzer bekommt eine echte, dauerhafte User-ID,
  die als `owner_id` in den Zeilen landet und auf die RLS zugreift. Upgrade-
  Pfad für ein zweites Gerät: die anonyme Identität später per Magic Link
  mit einer E-Mail verknüpfen.

---

## Lokal — expo-sqlite (`src/data/db/schema.ts`)

`SCHEMA_VERSION = 2`, Datenbankname `kompendium.db`. Vier Tabellen und ein
Schlüssel-Wert-Paar:

| Tabelle | Zweck |
|---|---|
| `documents` | eine Zeile je Dokument, mit allem, was ein Screen zeigt |
| `tags` | Name und Farbe |
| `document_tags` | Zuordnung Dokument↔Tag, `on delete cascade` auf beiden Seiten |
| `folders` | Name (zugleich Ausweis, PK), Farbe, „Inhalt offline behalten" |
| `settings` | Schlüssel-Wert-Paar für Darstellung und Bibliothek-Voreinstellungen |

`documents`-Spalten: `id` (PK), `title`, `doc_type`, `folder_name`,
`favorite`, `cached`, `size_bytes`, `updated_at`, `imported_at`,
`open_count`, `last_opened_at` (seit Version 2), `note`, `keep_offline`,
`trashed_at`, `source`, `cache_key`.

Indizes: `documents_by_recent` (`trashed_at, updated_at DESC` — Bibliothek
sortiert nach zuletzt geändert und blendet den Papierkorb aus, genau diese
beiden Spalten stehen deshalb im Index), `documents_by_folder`
(`folder_name`), `document_tags_by_tag` (`tag_id`).

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
schlechter als keins.

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
gibt es seit Schemaversion 3 (Wasserzeichen `last_pulled_at` und die Marke
`reset_done`); `cache_entries` und `outbox` sind weiterhin offen — der
Dateicache läuft über `src/data/cache.ts`/`persist.ts`, die Suche über
`src/data/search.ts`. Die Outbox-Warteschlange für den Push-Sync ist der
nächste Schritt (siehe unten).

Zwei Spalten sind gegenüber dem Konzept dazugekommen. Lokal tragen
`documents.storage_path` und `documents.content_hash` den Stand von oben mit,
damit der Viewer eine Datei nachladen kann und erkennt, wann die gecachte
veraltet ist; `folders.remote_id` hält die Zuordnung zwischen dem lokalen
Ausweis (dem **Namen**) und dem oberen (einer UUID). Oben trägt
`documents.source_path` den Pfad der Datei im HTML-Ordner am PC — daran
erkennt `scripts/upload.mjs` beim zweiten Lauf dieselbe Datei wieder.

---

## Sync-Strategie (Zielbild)

Bewusst simpel gehalten für einen Einzelnutzer mit zwei Geräten, kein Team
mit Merge-Konflikten.

**Stand:** Pull ist gebaut (`src/data/remote/pull.ts`, angestoßen beim Start
und über „Jetzt synchronisieren"), das Nachladen der Dateien ebenfalls
(`src/data/remote/download.ts`). Push fehlt noch — lokale Änderungen stehen in
SQLite und noch nicht oben; der Sync-Status bleibt deshalb nach jeder Änderung
am Handy ehrlich auf `pending`.

**Pull (Supabase → App):** Die App merkt sich `last_pulled_at` als
**Server**-Zeitstempel (nie die Gerätezeit, sonst driftet es). Bei App-Start,
Pull-to-Refresh und beim Wechsel in den Vordergrund:
`select * from <tabelle> where updated_at > last_pulled_at order by updated_at`,
Zeilen per `INSERT OR REPLACE` in SQLite schreiben, `last_pulled_at` auf das
größte empfangene `updated_at` setzen. Löschungen brauchen keinen
Sonderweg, weil Soft Delete `updated_at` mitsetzt.

**Push (App → Supabase):** Jede lokale Änderung schreibt sofort nach SQLite
(UI reagiert instant) und legt einen Outbox-Eintrag an. Ein Worker arbeitet
die Outbox ab, sobald Netz da ist (`upsert` auf die jeweilige Tabelle);
Erfolg löscht den Eintrag, Fehler erhöht `attempts` mit exponentiellem
Backoff, ab 5 Versuchen sichtbar im Sync-Status.

**Konflikte:** Last-Write-Wins auf Zeilenebene — bei zwei Geräten und
größtenteils additiven Änderungen (Tag setzen, Favorit toggeln) das
Verhalten, das man erwartet.

**Die Dateien selbst** gelten als unveränderlich. Ändert sich der Inhalt am
PC, ändert sich `content_hash`, und die App lädt beim nächsten Öffnen neu —
kein Diff, kein Merge. Cache-Regeln: Download erst beim ersten Öffnen, nicht
beim Sync; Cache-Budget (z. B. 200 MB) mit LRU-Verdrängung nach
`last_used_at`; gepinnte Dokumente ("Offline behalten") sind von der
Verdrängung ausgenommen; ein Ordner lässt sich komplett vorab laden.

**Der PC-Weg:** `scripts/upload.mjs`, aufzurufen mit `npm run upload -- <ordner>`.
Es macht pro Datei genau das, was das Konzept vorsah: sha256 bilden (bei
gleichem `content_hash` überspringen), `<title>`/`<meta name="description">`/
erste `<h1>` parsen, Tags strippen zu `preview_text`, die Datei in den
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
„Synchronisierung", und bei genau einer Identität im Projekt findet das Skript
sie allein). Dieser Schlüssel umgeht RLS vollständig und gehört ausschließlich
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
   aktivieren und speichern — ohne diese Einstellung schlägt jeder Login
   fehl und es fließen keine Daten.

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
| Fehler „Anonymous sign-ins are disabled" | Schritt „Anonymous sign-ins" fehlt | Provider einschalten und speichern |
| Alles leer, keine Fehlermeldung | RLS aktiv, aber `owner_id` wird beim Schreiben nicht gesetzt | Code-Thema, kein Setup-Thema |
| Nichts geht, App startet trotzdem | So gewollt: ohne `.env` läuft die App im lokalen Modus weiter | Kein Fehler, nur kein Sync |

## Referenzdokumente

- [TECH_STACK.md](TECH_STACK.md) — Architekturdiagramm, Pakete, Expo-Go-Grenzen
- [README.md](README.md) — Start, Produktbeschreibung, offene Punkte
- `C:\Projekte\HTML-Dokumenten-Ordner\Loesungskonzept-HTML-Dokumenten-App.md`
  — ursprüngliches Architektur- und Sync-Konzept (Original dieser Inhalte)
