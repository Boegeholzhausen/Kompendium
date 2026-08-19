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
  foreach t in array array['folders','documents'] loop
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
  foreach t in array array['folders','documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I
       for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t, t);
  end loop;
end $$;

-- ── Storage ───────────────────────────────────────────────────────────────
-- Bucket "documents", privat. Zugriff nur auf den eigenen Pfad-Praefix.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

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
