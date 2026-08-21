-- Kompendium — Supabase-Schema
-- Einmalig im SQL-Editor des Projekts ausfuehren.
-- Datenmodell aus "Loesungskonzept-HTML-Dokumenten-App.md", Abschnitt 4.1.
--
-- Leitprinzip: Ablage != Ordnung.
--   Ablage  = die HTML-Dateien im Storage-Bucket, flach, Dateiname <uuid>.html
--   Ordnung = Ordner, Tags, Favoriten, Titel, Notizen in diesen Tabellen
-- Ein Dokument in einen Ordner zu verschieben bewegt keine Datei, sondern
-- aendert eine Zeile.

-- ── Ordner ────────────────────────────────────────────────────────────────
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid(),
  parent_id   uuid references public.folders(id) on delete cascade,
  name        text not null,
  icon        text,                    -- Phosphor-Icon-Name
  color       text not null default 'mint',  -- Token-Name aus der Palette, kein Hex
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Dokumente ─────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid(),
  folder_id     uuid references public.folders(id) on delete set null,

  title         text not null,         -- aus <title>, ueberschreibbar
  description   text,
  note          text,

  storage_path  text not null,         -- "<owner_id>/<id>.html"
  file_size     bigint,
  content_hash  text,                  -- sha256 → Aenderungserkennung
  preview_text  text,                  -- erste ~1200 Zeichen Klartext

  -- Beim Import einmal erkannt und persistiert: die Kachel darf sich
  -- zwischen zwei Sitzungen nicht aendern.
  doc_type      text not null default 'text'
                check (doc_type in ('table','chart','text','calculator','list')),

  is_favorite   boolean not null default false,
  keep_offline  boolean not null default false,
  opened_at     timestamptz,
  open_count    int not null default 0,
  source        text not null default 'pc'
                check (source in ('pc','file','clipboard','url')),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz            -- Soft Delete = Papierkorb, 30 Tage
);

-- Volltextsuche (deutsch), serverseitig
alter table public.documents
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('german', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('german', coalesce(description,'')), 'B') ||
    setweight(to_tsvector('german', coalesce(preview_text,'')), 'C')
  ) stored;

create index if not exists documents_search_idx  on public.documents using gin(search_vector);
create index if not exists documents_updated_idx on public.documents(owner_id, updated_at);
create index if not exists documents_folder_idx  on public.documents(owner_id, folder_id);
create index if not exists folders_updated_idx   on public.folders(owner_id, updated_at);

-- Woher die Datei am PC stammt: der Pfad im HTML-Ordner. Nur `scripts/upload.mjs`
-- schreibt ihn — er ist der Ausweis, an dem ein zweiter Lauf dieselbe Datei
-- wiedererkennt, auch wenn sich ihr Inhalt (und damit `content_hash`) geaendert
-- hat. Dokumente, die am Handy importiert wurden, lassen ihn leer.
alter table public.documents add column if not exists source_path text;

create unique index if not exists documents_source_path_idx
  on public.documents(owner_id, source_path) where source_path is not null;

-- Ein Name je Konto, und nur unter den lebenden Zeilen.
--
-- Lokal IST der Name der Ausweis (`folders.name` ist dort Primaerschluessel),
-- und `pushFolders` erkennt einen Ordner ohne `remote_id` genau daran wieder.
-- Ohne diese Bedingung koennen zwei Geraete, die denselben Ordner anlegen
-- bevor sie abgleichen, zwei Zeilen erzeugen — der naechste Abruf reicht beide
-- herunter, lokal gewinnt willkuerlich eine, und die Dokumente der anderen
-- verlieren ihre Zuordnung. Fuer `documents` gibt es dasselbe Netz schon
-- (`documents_source_path_idx`).
--
-- `where deleted_at is null`: ein geloeschter Ordner belegt seinen Namen nicht
-- weiter. Wer "Steuern" wegwirft und spaeter neu anlegt, meint einen neuen
-- Ordner und soll nicht am Grabstein des alten scheitern.
create unique index if not exists folders_name_idx
  on public.folders(owner_id, name) where deleted_at is null;

-- ── Ordner: "Inhalt offline behalten" ─────────────────────────────────────
-- Dieselbe Zusage wie am Dokument, nur fuer den ganzen Ordner. Bis hierher
-- stand sie ausschliesslich lokal — auf einem zweiten Geraet waere sie damit
-- verloren gewesen, obwohl sie eine Entscheidung des Nutzers ist und keine
-- Eigenschaft dieses Geraets.
alter table public.folders add column if not exists keep_offline boolean not null default false;

-- Zur Spalte `color` oben: dort steht ein TOKEN-NAME aus der Palette
-- (`tagPalette` in src/theme/colors.ts), nie ein Hex-Wert. Der Name ueberlebt
-- jede Aenderung an der Palette, waehrend ein gespeicherter Hex-Wert eine
-- Kopie waere, die beim naechsten Feinschliff des Themes zurueckbleibt.
-- Uebersetzt wird deshalb erst an der Grenze: `colorFor` in
-- src/data/remote/pull.ts herein, `tokenFor` in src/data/remote/push.ts hinaus.

-- ── Workflow-Status ───────────────────────────────────────────────────────
-- Zwei Spalten statt einer Status-Spalte mit drei Werten: Archiv ist eine
-- zweite Achse neben gelesen/ungelesen. Ein archiviertes Dokument ist in aller
-- Regel auch gelesen, und mit nur einer Spalte ginge beim Entarchivieren die
-- Leseinformation verloren. `null` heisst ungelesen bzw. nicht archiviert.
alter table public.documents add column if not exists read_at     timestamptz;
alter table public.documents add column if not exists archived_at timestamptz;

-- Frueher standen hier `tags` und `document_tags`. Beide sind mit dem
-- Workflow-Status entfallen: "gelesen" ist ein einwertiger Lebenszyklus und
-- keine mehrwertige Klassifikation — ueber eine Zuordnungstabelle abgebildet
-- erlaubte die Datenbank Zustaende, die es fachlich nicht gibt.
drop table if exists public.document_tags;
drop table if exists public.tags;

-- Kein Index auf den Status: gefiltert wird in der App ueber den Bestand im
-- Zustand, nicht in einer Abfrage.

-- ── Leseposition ──────────────────────────────────────────────────────────
-- Sie gehoert zum Dokument und nicht in eine Voreinstellungstabelle: "wie weit
-- bin ich" ist eine Eigenschaft dieses einen Textes. Als Spalte geht sie ueber
-- die vorhandene Outbox mit und braucht keinen eigenen Weg.
alter table public.documents add column if not exists scroll_offset int not null default 0;

-- ── Voreinstellungen je Konto ─────────────────────────────────────────────
-- Textgroesse, Darstellung, Sortierung. Bewusst als Schluessel-Wert-Tabelle und
-- nicht als Spaltensatz: die Menge waechst mit jeder neuen Einstellung, und
-- jede davon waere sonst eine Migration auf beiden Seiten.
--
-- Was hier NICHT hingehoert, sind geraetebezogene Werte (zuletzt gesuchte
-- Begriffe, Cachegroessen): sie beschreiben dieses Geraet, nicht den Nutzer.
create table if not exists public.user_settings (
  owner_id   uuid not null default auth.uid(),
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, key)
);

-- ── updated_at automatisch fortschreiben ──────────────────────────────────
-- Das Pull-Wasserzeichen der App verlaesst sich darauf. Soft Delete setzt
-- deleted_at UND updated_at, damit Loeschungen durch dasselbe Wasserzeichen
-- mitkommen und keinen Sonderweg brauchen.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['folders','documents','user_settings'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format(
      'create trigger %I_touch before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ── Row Level Security ────────────────────────────────────────────────────
-- Damit ist der Publishable Key gefahrlos in der App.
do $$
declare t text;
begin
  foreach t in array array['folders','documents','user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I
       for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
end $$;

-- Der Ordner eines Dokuments muss demselben Konto gehoeren.
--
-- Die Richtlinie oben prueft nur `owner_id` der Dokumentzeile selbst; `folder_id`
-- laeuft als Fremdschluessel daran vorbei. Lesen liesse sich ein fremder Ordner
-- dadurch nie — RLS auf `folders` bleibt wirksam —, aber es entstuende eine
-- Zeile, die auf etwas Unsichtbares zeigt. Bei einem Projekt mit einem Konto
-- ist das folgenlos; die Bedingung kostet nichts und schliesst es sauber ab.
drop policy if exists documents_owner on public.documents;
create policy documents_owner on public.documents
  for all
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      folder_id is null
      or exists (
        select 1 from public.folders f
         where f.id = folder_id and f.owner_id = auth.uid()
      )
    )
  );

-- ── Storage ───────────────────────────────────────────────────────────────
-- Bucket "documents", privat. Zugriff nur auf den eigenen Pfad-Praefix.
--
-- Mit Groessengrenze: ohne sie nimmt der Bucket jede Datei jeder Groesse an.
-- Ein HTML-Dokument der Bibliothek ist ein paar hundert Kilobyte gross; 10 MB
-- sind reichlich Luft und zugleich eine Obergrenze fuer den Fall, dass jemand
-- mit dem Anon Key aus der APK ein Konto anlegt (siehe SETUP.md:
-- Selbstregistrierung gehoert im Dashboard abgeschaltet). An fremde Daten
-- kaeme er dadurch nie — die Policies unten binden jeden Zugriff an den
-- eigenen Pfad-Praefix —, wohl aber an den Speicher des Projekts.
--
-- Bewusst OHNE `allowed_mime_types`: beide Upload-Wege senden
-- "text/html; charset=utf-8", und ob die Pruefung den Parameter hinter dem
-- Semikolon abschneidet oder auf Gleichheit vergleicht, laesst sich nur am
-- laufenden Projekt feststellen. Eine Liste, die "text/html" verlangt, koennte
-- damit jeden Upload abweisen — ein Riegel gegen ein Missbrauchsszenario, der
-- den Normalbetrieb bricht, ist der schlechtere Tausch. Wer es nachstellen
-- will, setzt die Liste im Dashboard und laedt einmal hoch.
--
-- `do update`, damit ein zweiter Lauf die Grenze auch auf einen Bucket legt,
-- den es schon gibt. `public` bleibt dabei ausdruecklich `false`.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 10485760)
on conflict (id) do update
  set public          = false,
      file_size_limit = excluded.file_size_limit;

drop policy if exists documents_read   on storage.objects;
drop policy if exists documents_write  on storage.objects;
drop policy if exists documents_update on storage.objects;
drop policy if exists documents_delete on storage.objects;

create policy documents_read on storage.objects
  for select using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_write on storage.objects
  for insert with check (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_update on storage.objects
  for update using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy documents_delete on storage.objects
  for delete using (
    bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text
  );
