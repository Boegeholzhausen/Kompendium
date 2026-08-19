/**
 * Der Weg vom PC in die Bibliothek.
 *
 * Liest einen Ordner mit HTML-Dateien, legt jede in den Storage-Bucket und
 * schreibt ihre Zeile nach `public.documents`. Danach hat das Handy beim
 * naechsten Abgleich echte Dokumente statt des Beispiel-Bestands.
 *
 *   node scripts/upload.mjs "C:\\Users\\...\\Downloads\\HTML"
 *   node scripts/upload.mjs <ordner> --dry
 *
 * Zwei Dinge macht das Skript bewusst NICHT:
 *
 *   Es sortiert nicht. Jedes Dokument kommt ohne Ordner an und steht damit in
 *   der Sektion "Neu" — das ist der einzige Ort in der App, der Handlungsdruck
 *   erzeugen darf, und genau deshalb funktioniert das Sortieren dort.
 *
 *   Es loescht nicht. Verschwindet eine Datei aus dem Ordner, bleibt ihre
 *   Zeile stehen. Was in der Bibliothek liegt, wirft der Nutzer weg, nicht ein
 *   Aufraeumlauf im Hintergrund.
 *
 * Wiedererkennung ueber zwei Spalten: `source_path` sagt, welche Datei gemeint
 * ist, `content_hash` sagt, ob sie sich geaendert hat. Ein zweiter Lauf ueber
 * denselben Ordner laedt deshalb nichts erneut hoch und legt nichts doppelt an.
 *
 * Zugangsdaten: URL aus `.env` (dieselbe wie die App), der **Service-Role-Key**
 * aus `.env.local`. Der Weg ueber den Anon-Key ginge nicht — er haengt an einer
 * anonymen Identitaet, und die des PCs waere eine andere als die des Handys;
 * die App saehe die hochgeladenen Zeilen dann nie. Der Service-Role-Key umgeht
 * RLS und darf deshalb ausschliesslich hier liegen, niemals in der App.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve, sep } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { detectDescription, detectDocType, detectTitle, previewText } from '../src/data/detect.ts';

const ROOT = resolve(import.meta.dirname, '..');
const BUCKET = 'documents';

/** Ordner, die in einem Downloads-Verzeichnis nichts zur Sache tun. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.expo', 'dist']);

// ── Zugangsdaten ────────────────────────────────────────────────────────────

/**
 * `.env`-Dateien lesen, ohne ein Paket dafuer.
 *
 * Vier Zeilen Format — `KEY=wert`, Kommentare mit `#` — und der einzige Leser
 * ist dieses Skript. Eine Abhaengigkeit mehr im Projekt waere teurer als diese
 * Schleife.
 */
async function readEnv(name) {
  try {
    const text = await readFile(join(ROOT, name), 'utf8');
    const values = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const at = trimmed.indexOf('=');
      if (at === -1) continue;
      values[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim();
    }
    return values;
  } catch {
    return {};
  }
}

function fail(message) {
  console.error(`\nFehler: ${message}\n`);
  process.exit(1);
}

// ── Wer ist der Besitzer ────────────────────────────────────────────────────

/**
 * Die Kennung, unter der die Zeilen liegen sollen.
 *
 * Steht sie in `.env.local`, gilt sie. Sonst schaut das Skript nach, welche
 * Identitaeten es im Projekt gibt: bei genau einer ist die Sache klar — das
 * ist das Handy, das sich beim ersten Start anonym angemeldet hat. Bei
 * mehreren fragt es lieber nach, statt zu raten: unter der falschen Kennung
 * hochgeladen waeren die Dokumente da, aber unsichtbar.
 */
async function ownerId(admin, configured) {
  if (configured) return configured;

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) fail(`Die Identitaeten liessen sich nicht lesen: ${error.message}`);

  const users = data.users ?? [];
  if (users.length === 0) {
    fail(
      'Es gibt noch keine Identitaet in diesem Supabase-Projekt.\n' +
        'Starte die App einmal auf dem Handy — sie meldet sich beim ersten Start\n' +
        'anonym an und legt sie dabei an.'
    );
  }
  if (users.length > 1) {
    console.error('\nEs gibt mehrere Identitaeten in diesem Projekt:\n');
    for (const user of users) {
      console.error(`  ${user.id}   angelegt ${new Date(user.created_at).toLocaleString('de-DE')}`);
    }
    fail(
      'Trage die richtige in .env.local als KOMPENDIUM_OWNER_ID ein.\n' +
        'Welche das ist, zeigen die Einstellungen der App unter "Synchronisierung".'
    );
  }
  return users[0].id;
}

// ── Dateien einsammeln ──────────────────────────────────────────────────────

async function htmlFiles(dir, base = dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...(await htmlFiles(full, base)));
    } else if (/^\.x?html?$/i.test(extname(entry.name))) {
      found.push(full);
    }
  }
  return found;
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Menschenlesbare Byte-Zahl fuer das Protokoll. */
function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

// ── Lauf ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const target = args.find((arg) => !arg.startsWith('--'));

  const env = { ...(await readEnv('.env')), ...(await readEnv('.env.local')) };

  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const directory = resolve(target ?? env.KOMPENDIUM_HTML_DIR ?? '');

  // Der Probelauf kommt ohne Zugangsdaten aus: er soll zeigen, was das Skript
  // erkennen wuerde — welcher Titel, welche Kachel, welche Datei ist neu. Dafuer
  // erst einen Service-Role-Key zu besorgen waere eine Huerde vor der Antwort
  // auf die Frage "stimmt das ueberhaupt?".
  const offline = dry && (!url || !serviceKey);

  if (!url && !offline) fail('EXPO_PUBLIC_SUPABASE_URL fehlt in .env.');
  if (!serviceKey && !offline) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local.\n' +
        'Supabase-Dashboard → Project Settings → API → service_role.\n' +
        'Die Datei steht in .gitignore und gehoert nicht ins App-Bundle.'
    );
  }
  if (!target && !env.KOMPENDIUM_HTML_DIR) {
    fail(
      'Kein Ordner angegeben.\n' +
        '  node scripts/upload.mjs "C:\\Pfad\\zu\\deinen\\HTML-Dateien"\n' +
        'oder KOMPENDIUM_HTML_DIR in .env.local eintragen.'
    );
  }
  if (!(await stat(directory).catch(() => null))?.isDirectory()) {
    fail(`Kein Ordner: ${directory}`);
  }

  const admin = offline
    ? null
    : createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

  const owner = admin ? await ownerId(admin, env.KOMPENDIUM_OWNER_ID) : '<noch-keine-kennung>';
  const files = await htmlFiles(directory);

  console.log(`\nOrdner    ${directory}`);
  console.log(`Besitzer  ${owner}`);
  console.log(`Gefunden  ${files.length} HTML-Datei(en)${dry ? '   [Probelauf]' : ''}`);
  if (offline) console.log('          ohne Zugangsdaten — jede Datei zaehlt als neu');
  console.log('');
  if (files.length === 0) return;

  // Was schon oben liegt — einmal gelesen statt einmal je Datei.
  const byPath = new Map();
  if (admin) {
    const { data: known, error: knownError } = await admin
      .from('documents')
      .select('id, source_path, content_hash, storage_path')
      .eq('owner_id', owner)
      .not('source_path', 'is', null);
    if (knownError) fail(`Der Bestand liess sich nicht lesen: ${knownError.message}`);
    for (const row of known ?? []) byPath.set(row.source_path, row);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files) {
    // Immer mit "/", damit derselbe Ordner unter Windows und anderswo
    // dieselben Ausweise ergibt.
    const sourcePath = relative(directory, file).split(sep).join('/');
    const html = await readFile(file, 'utf8');
    const hash = sha256(html);
    const existing = byPath.get(sourcePath);

    if (existing && existing.content_hash === hash) {
      skipped += 1;
      continue;
    }

    const id = existing?.id ?? crypto.randomUUID();
    const storagePath = existing?.storage_path ?? `${owner}/${id}.html`;
    const bytes = Buffer.byteLength(html, 'utf8');
    const title = detectTitle(html, basename(file));
    const label = existing ? 'aktualisiert' : 'neu';

    if (dry) {
      const type = detectDocType(html);
      console.log(`  ${label.padEnd(12)} ${type.padEnd(10)} ${title}  (${kb(bytes)}, ${sourcePath})`);
      if (existing) updated += 1;
      else created += 1;
      continue;
    }

    const upload = await admin.storage
      .from(BUCKET)
      .upload(storagePath, html, { contentType: 'text/html; charset=utf-8', upsert: true });
    if (upload.error) {
      console.error(`  FEHLER  ${sourcePath}: ${upload.error.message}`);
      continue;
    }

    // `created_at` bleibt beim Aktualisieren stehen: wann das Dokument in die
    // Bibliothek kam, aendert sich nicht dadurch, dass sein Inhalt neu ist.
    const row = {
      id,
      owner_id: owner,
      title,
      description: detectDescription(html),
      storage_path: storagePath,
      source_path: sourcePath,
      file_size: bytes,
      content_hash: hash,
      preview_text: previewText(html),
      doc_type: detectDocType(html),
      source: 'pc',
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin.from('documents').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`  FEHLER  ${sourcePath}: ${error.message}`);
      continue;
    }

    console.log(`  ${label.padEnd(12)} ${title}  (${kb(bytes)})`);
    if (existing) updated += 1;
    else created += 1;
  }

  const parts = [`${created} neu`, `${updated} aktualisiert`, `${skipped} unveraendert`];
  console.log(`\n${parts.join(' · ')}${dry ? '   [nichts geschrieben]' : ''}\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
