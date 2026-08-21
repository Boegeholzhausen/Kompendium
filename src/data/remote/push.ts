/**
 * Der Weg nach oben: lokale Datenbank → Supabase.
 *
 * Die Gegenrichtung zu `pull.ts`, und die zweite Haelfte dessen, was der
 * Kopfkommentar von `data/supabase.ts` schon vorsieht ("Push per Outbox").
 * Ohne sie stuenden alle Aenderungen am Handy nur in SQLite und waeren beim
 * naechsten Abruf ueberschrieben, sobald der PC dieselbe Zeile anfasst.
 *
 * Was hochgeht, steht nicht hier, sondern in der Outbox: das Repository merkt
 * beim Schreiben vor, welche FELDER sich geaendert haben — die Werte holt
 * dieses Modul aus der Dokumentzeile, die immer den neuesten Stand traegt.
 *
 * Kein SQL hier: das steht ausschliesslich im Repository. Dieses Modul
 * uebersetzt in die Begriffe von Supabase und redet mit dem Server.
 *
 * ## Reihenfolge
 *
 *   Ordner → neue Dokumente → geaenderte Felder → Voreinstellungen
 *   → (danach der Abruf in `state/sync.ts`)
 *
 * Die Ordner muessen zuerst: ein Dokument, das in einen Ordner verschoben
 * wurde, kann nur hochgehen, wenn der Ordner oben eine Zeile hat — sein
 * `remote_id` entsteht in diesem Lauf und wird noch im selben Lauf gebraucht.
 * Andersherum bliebe der Outbox-Eintrag mit leerer Nutzlast liegen, und der
 * Sync-Status stuende dauerhaft auf "Änderungen offen".
 *
 * Die neuen Dokumente stehen dazwischen, aus demselben Grund in beide
 * Richtungen: sie brauchen das `folder_id` von eben, und die Feldschleife
 * danach braucht ihre Zeile — ein `update` auf eine Zeile, die es oben nicht
 * gibt, trifft nichts und meldet trotzdem Erfolg.
 */
import * as Crypto from 'expo-crypto';

import {
  clearFolderDeletions,
  clearOutbox,
  countOutbox,
  markUploaded,
  noteOwner,
  readFolderDeletions,
  readFoldersForPush,
  readOutbox,
  readSettings,
  readSyncState,
  readUploadable,
  setFolderRemoteId,
  writeSyncState,
  SYNCED_SETTING_KEYS,
  type DocumentPatch,
  type OutboxEntry,
} from '../db/repository';
import { currentUserId, STORAGE_BUCKET, supabase } from '../supabase';
import { readDocument } from '../cache';
import { previewText } from '../detect';
import { tagPalette } from '../../theme/colors';

/** Wie viele Zeilen tatsaechlich oben angekommen sind. */
export interface PushResult {
  pushed: number;
}

/** Millisekunden der App in den ISO-Text, mit dem Supabase rechnet. */
function iso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

/**
 * Ein geaendertes Feld in Spalte und Wert oben.
 *
 * `undefined` heisst: nicht mitschicken. Das braucht genau ein Fall — ein
 * Ordner, den es oben noch nicht gibt (kein `remote_id`). Ihn als `null` zu
 * schicken hiesse "aus dem Ordner genommen", und das hat der Nutzer nicht
 * getan.
 */
function column(
  field: keyof DocumentPatch,
  entry: OutboxEntry
): { name: string; value: unknown } | undefined {
  const document = entry.document;
  switch (field) {
    case 'title':
      return { name: 'title', value: document.title };
    case 'folderName':
      if (document.folderName !== null && entry.folderRemoteId === null) return undefined;
      return { name: 'folder_id', value: document.folderName === null ? null : entry.folderRemoteId };
    case 'favorite':
      return { name: 'is_favorite', value: document.favorite };
    case 'note':
      return { name: 'note', value: document.note };
    case 'keepOffline':
      return { name: 'keep_offline', value: document.keepOffline };
    case 'trashedAt':
      return { name: 'deleted_at', value: iso(document.trashedAt) };
    case 'openCount':
      return { name: 'open_count', value: document.openCount };
    case 'lastOpenedAt':
      return { name: 'opened_at', value: iso(document.lastOpenedAt) };
    case 'readAt':
      return { name: 'read_at', value: iso(document.readAt) };
    case 'archivedAt':
      return { name: 'archived_at', value: iso(document.archivedAt) };
    case 'scrollOffset':
      return { name: 'scroll_offset', value: entry.scrollOffset };
    default:
      // Alles andere beschreibt dieses Geraet und hat oben nichts zu suchen.
      // Die Outbox nimmt es ohnehin nicht auf (`PUSHABLE` im Repository).
      return undefined;
  }
}

/**
 * Die Umkehrung von `colorFor` in `pull.ts`: unten steht ein Hex-Wert, oben
 * gehoert der Token-Name hin.
 *
 * Ohne diese Ruecksetzung landete `#7DD3B0` in der Datenbank, und der naechste
 * Abruf faende dort keinen Token mehr — die Farbe fiele auf jedem Geraet auf
 * `slate` zurueck. Uebersetzt wird nur an der Grenze, in beiden Richtungen.
 *
 * `slate` ist der Rueckfall: eine Farbe, die nicht aus der Palette stammt, gibt
 * es oben nicht, und eine erfundene Zuordnung waere schlechter als die
 * neutrale.
 */
function tokenFor(color: string): string {
  const found = Object.entries(tagPalette).find(([, value]) => value === color);
  return found?.[0] ?? 'slate';
}

/**
 * Die Ordner nach oben — der erste Schritt jedes Laufs.
 *
 * Kein Outbox-Weg, sondern ein direkter Vergleich des ganzen Bestands mit dem
 * oben (die Begruendung steht im Repository bei `readFoldersForPush`). Der
 * Ablauf:
 *
 *   Grabsteine    zuerst: `deleted_at` auf die Zeilen lokal geloeschter Ordner
 *   Bestand oben  EINMAL lesen, danach je Ordner entscheiden:
 *                   bekannt und gleich   → nichts tun
 *                   bekannt und anders   → fortschreiben
 *                   unbekannt            → anlegen und Ausweis festhalten
 *
 * Der Vergleich ist kein Feinschliff, sondern noetig: ohne ihn schriebe jeder
 * Lauf jeden Ordner fort, der Trigger setzte `updated_at` neu, und der
 * Abgleich meldete fuer immer "es hat sich etwas geaendert".
 *
 * Rueckgabe sind die Fehlermeldungen, nicht ein Wurf: ein Ordner, der nicht
 * durchgeht, soll die Dokumentschleife nicht aufhalten. Gemeldet wird alles
 * gemeinsam am Ende von `pushChanges`.
 */
async function pushFolders(): Promise<string[]> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');
  const failed: string[] = [];

  // Die Grabsteine zuerst: sonst faende der Schritt darunter den Namen oben
  // noch als lebende Zeile und uebernaehme ausgerechnet die, die gerade weg
  // soll.
  const deletions = await readFolderDeletions();
  if (deletions.length > 0) {
    const { error } = await supabase
      .from('folders')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', deletions);
    if (error) failed.push(`Ordner löschen: ${error.message}`);
    // Nur wegraeumen, was durchging — sonst bliebe der Ordner oben fuer immer
    // stehen, weil die einzige Spur der Loeschung fort waere.
    else await clearFolderDeletions(deletions);
  }

  const local = await readFoldersForPush();
  if (local.length === 0) return failed;

  // Der Bestand oben, EINMAL gelesen. Zwei Gruende dafuer, dass er ueberhaupt
  // gelesen wird:
  //
  //   1. Ohne Vergleich schriebe jeder Lauf jeden Ordner fort. Der Trigger
  //      setzt dabei `updated_at` neu, der naechste Abruf holte alle Ordner
  //      zurueck, und der Abgleich meldete fuer immer "es hat sich etwas
  //      geaendert" — samt Neuaufbau der Liste, durch die der Nutzer scrollt.
  //   2. Der Name-Abgleich fuer Ordner ohne `remote_id` braucht ihn ohnehin;
  //      eine Abfrage je Ordner waere dieselbe Auskunft in Scheiben.
  const { data: remoteRows, error: listError } = await supabase
    .from('folders')
    .select('id, name, color, keep_offline')
    .is('deleted_at', null);
  if (listError) return [...failed, `Ordner: ${listError.message}`];

  interface RemoteRow {
    id: string;
    name: string;
    color: string | null;
    keep_offline: boolean | null;
  }
  const rows = (remoteRows ?? []) as RemoteRow[];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  const byName = new Map(rows.map((row) => [String(row.name), row]));

  for (const folder of local) {
    const payload = {
      name: folder.name,
      color: tokenFor(folder.color),
      keep_offline: folder.keepOffline,
    };

    // "Gleicher Name = derselbe Ordner": lokal IST der Name der Ausweis. Wer
    // auf zwei Geraeten "Steuern" anlegt, meint einen Ordner und nicht zwei —
    // eine zweite Zeile waere ein Doppel, das der naechste Abruf als zwei
    // Ordner herunterreicht und das niemand mehr auseinandersortieren kann.
    const known =
      folder.remoteId === null ? byName.get(folder.name) : byId.get(folder.remoteId);

    // Ein Ordner MIT Ausweis, zu dem oben keine lebende Zeile mehr gehoert,
    // wurde dort geloescht — auf einem anderen Geraet. Ihn hier neu anzulegen
    // hiesse, die Loeschung stillschweigend zurueckzunehmen; der Abruf gleich
    // danach nimmt ihn auch lokal aus der Liste.
    if (known === undefined && folder.remoteId !== null) continue;

    if (known === undefined) {
      // `owner_id` nicht mitschicken — das erledigt der Vorgabewert
      // (`default auth.uid()`), und RLS prueft dagegen.
      const { data: created, error } = await supabase
        .from('folders')
        .insert(payload)
        .select('id')
        .single();
      if (error) {
        failed.push(`${folder.name}: ${error.message}`);
        continue;
      }
      if (created?.id) await setFolderRemoteId(folder.name, String(created.id));
      continue;
    }

    // Erst die Zuordnung festhalten, dann fortschreiben: bricht der zweite
    // Schritt ab, ist der Ordner trotzdem verknuepft und der naechste Lauf
    // legt keine zweite Zeile an.
    if (folder.remoteId !== String(known.id)) {
      await setFolderRemoteId(folder.name, String(known.id));
    }

    const same =
      String(known.name) === payload.name &&
      String(known.color ?? '') === payload.color &&
      (known.keep_offline === true) === payload.keep_offline;
    if (same) continue;

    const { error } = await supabase.from('folders').update(payload).eq('id', known.id);
    if (error) failed.push(`${folder.name}: ${error.message}`);
  }

  return failed;
}

/**
 * Dokumente, die es oben noch nicht gibt — der zweite Schritt jedes Laufs.
 *
 * Am Handy importierte Dokumente hatten bis hierher `storage_path = null`, und
 * `queueForPush` laesst solche Zeilen bewusst aus: ein `update` traefe oben
 * nichts. Sie existierten damit ausschliesslich auf diesem Geraet — still,
 * ohne Hinweis in der Oberflaeche. Dieser Schritt loest das auf: erst die
 * Datei in den Bucket, dann die Zeile, danach laeuft das Dokument den normalen
 * Outbox-Weg wie jedes PC-Dokument.
 *
 * `source_path` wird NICHT gesetzt: den schreibt ausschliesslich
 * `scripts/upload.mjs`, und er ist dort der Ausweis, an dem ein zweiter Lauf
 * dieselbe Datei am PC wiedererkennt. Ein Dokument vom Handy hat keinen.
 *
 * `updated_at` ebenfalls nicht — dieselbe Regel wie unten in der
 * Feldschleife: das Wasserzeichen ist ein Server-Zeitstempel.
 */
async function uploadNewDocuments(userId: string): Promise<string[]> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');
  const failed: string[] = [];

  for (const entry of await readUploadable()) {
    const document = entry.document;
    if (document.cacheKey === null) continue;

    // Ein Ordner ohne `remote_id` heisst: `pushFolders` ist eben gescheitert.
    // Die Zeile jetzt mit `folder_id = null` anzulegen hiesse, die Einsortierung
    // stillschweigend zu verlieren — und weil ein frisch hochgeladenes Dokument
    // keinen Outbox-Eintrag hat, holte das nie jemand nach. Lieber melden und
    // beim naechsten Lauf wiederkommen.
    if (document.folderName !== null && entry.folderRemoteId === null) {
      failed.push(`${document.title}: der Ordner "${document.folderName}" fehlt oben noch.`);
      continue;
    }

    const html = await readDocument(document.cacheKey);
    if (html === null) {
      failed.push(`${document.title}: die Datei liegt nicht mehr im Cache.`);
      continue;
    }

    const contentHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      html
    );

    // Der Pfad MUSS mit der eigenen User-ID beginnen — die Storage-Policy
    // prueft genau den ersten Abschnitt (`storage.foldername(name))[1]`).
    const storagePath = `${userId}/${document.id}.html`;
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, html, { contentType: 'text/html; charset=utf-8', upsert: true });
    if (upload.error) {
      failed.push(`${document.title}: ${upload.error.message}`);
      continue;
    }

    const { error } = await supabase.from('documents').insert({
      id: document.id,
      owner_id: userId,
      folder_id: entry.folderRemoteId,
      title: document.title,
      doc_type: document.docType,
      // Die CHECK-Bedingung oben kennt nur 'pc','file','clipboard','url'.
      // 'sample' kaeme hier nie an — `readUploadable` laesst den
      // Beispiel-Bestand aus, er ist Erstbefuellung und kein Bestand.
      source: document.source,
      storage_path: storagePath,
      file_size: document.sizeBytes,
      content_hash: contentHash,
      preview_text: previewText(html),
      note: document.note,
      is_favorite: document.favorite,
      keep_offline: document.keepOffline,
      open_count: document.openCount,
      opened_at: iso(document.lastOpenedAt),
      read_at: iso(document.readAt),
      archived_at: iso(document.archivedAt),
      scroll_offset: entry.scrollOffset,
      // Wann das Dokument in die Bibliothek kam, ist der Importzeitpunkt und
      // nicht der Moment, in dem es hochgeladen wurde.
      created_at: iso(document.importedAt),
    });
    if (error) {
      failed.push(`${document.title}: ${error.message}`);
      continue;
    }

    await markUploaded(document.id, storagePath, contentHash);
  }

  return failed;
}

/**
 * Die Voreinstellungen — der letzte Schritt.
 *
 * Textgroesse, Abdunkeln, Darstellung, Sortierung. Sie haengen am Konto und
 * nicht am Geraet, gehen aber NICHT ueber die Outbox: die kennt nur Dokumente,
 * und eine zweite Buchhaltung fuer fuenf Schluessel waere Aufwand ohne Nutzen.
 *
 * Stattdessen merkt sich der Abgleich, was er zuletzt hochgeschickt hat
 * (`settings_pushed`), und schickt nur, was seither anders ist. Ohne diesen
 * Vergleich schoebe jedes Geraet bei jedem Abgleich seinen alten Stand ueber
 * den neuen des anderen — die Textgroesse spraenge dann zwischen zwei Werten
 * hin und her, je nachdem, wer zuletzt synchronisiert hat.
 *
 * Konflikt: der juengere `updated_at`-Wert gewinnt (der Abruf schreibt in
 * dieser Reihenfolge). Eine Zusammenfuehrung waere fuer eine Voreinstellung
 * Aufwand ohne Nutzen — es gibt nichts zu vereinigen, nur zu waehlen.
 */
async function pushSettings(userId: string): Promise<string[]> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');

  const current = await readSettings(SYNCED_SETTING_KEYS);
  const last = parseSnapshot(await readSyncState('settings_pushed'));

  const changed = Object.keys(current).filter((key) => current[key] !== last[key]);
  if (changed.length === 0) return [];

  const { error } = await supabase.from('user_settings').upsert(
    changed.map((key) => ({ owner_id: userId, key, value: current[key] })),
    { onConflict: 'owner_id,key' }
  );
  if (error) return [`Einstellungen: ${error.message}`];

  await writeSyncState('settings_pushed', JSON.stringify(current));
  return [];
}

/** Der gemerkte Stand; ein kaputter Text heisst schlicht "noch nichts". */
function parseSnapshot(raw: string | null): Record<string, string> {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Alles Offene hochschicken.
 *
 * Zeile fuer Zeile statt in einem Rutsch: die Nutzlasten unterscheiden sich je
 * Eintrag (nur geaenderte Felder), und ein Sammelaufruf muesste die
 * Vereinigung aller Felder schicken — also auch Werte, die der Nutzer gar
 * nicht angefasst hat, ueber einen fremden Stand hinweg.
 *
 * `update`, nicht `upsert`: es geht ausschliesslich um Zeilen, die es oben
 * schon gibt (die Outbox nimmt nichts ohne `storage_path` auf). Deshalb
 * braucht es hier auch kein `owner_id` — RLS greift ueber die vorhandene
 * Zeile.
 *
 * `updated_at` wird bewusst NICHT mitgeschickt: das Wasserzeichen des Abrufs
 * ist ein Server-Zeitstempel, und eine Geraetezeit hineinzuschreiben koennte
 * die Reihenfolge dauerhaft verderben — eine nachgehende Uhr liesse die Zeile
 * beim naechsten Abruf fuer immer unter dem Wasserzeichen liegen.
 *
 * Vor dem allerersten Abruf passiert hier gar nichts: bis dahin steht lokal
 * der Beispiel-Bestand, und der ist Erstbefuellung und kein Bestand.
 */
export async function pushChanges(): Promise<PushResult> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');

  const userId = await currentUserId();
  if (userId === null) throw new Error('Keine Anmeldung bei Supabase.');

  // Solange der einmalige Schnitt nicht gefallen ist, steht hier der
  // Beispiel-Bestand und nicht der des Nutzers. Ihn hochzuschicken hiesse, ihm
  // Ordner anzulegen, die er nie angelegt hat — und der Abruf gleich danach
  // (`reset_done` in `pull.ts`) wirft sie lokal ohnehin weg. Der Weg nach oben
  // beginnt deshalb erst nach dem ersten Abruf.
  if ((await readSyncState('reset_done')) === null) return { pushed: 0 };

  // Zuerst die Frage, WEM das oben gehoert. Wechselt die Identitaet (Anmeldung
  // mit E-Mail, Abmelden), zeigen `folders.remote_id` und das Wasserzeichen auf
  // ein fremdes Konto — ein `update` darauf trifft unter RLS keine Zeile und
  // meldet trotzdem Erfolg. Genau die Klasse Fehler, die still bleibt.
  await noteOwner(userId);

  // Die Ordner laufen IMMER, auch bei leerer Outbox: ein neu angelegter Ordner
  // ohne verschobenes Dokument steht in keiner Outbox und kaeme sonst nie oben
  // an. Frueher stand hier ein Ausstieg auf `countOutbox() === 0`.
  const failed: string[] = await pushFolders();

  // Und ebenso immer: ein frisch importiertes Dokument steht in keiner Outbox
  // (`queueForPush` nimmt nichts ohne `storage_path` auf) und kaeme sonst nie
  // oben an.
  failed.push(...(await uploadNewDocuments(userId)));

  const done: { documentId: string; queuedAt: number }[] = [];
  // Die Ordner haben jetzt ihr `remote_id` — der Ausweis, den `column()` fuer
  // `folderName` braucht. Erst danach lohnt der Blick in die Outbox.
  const entries = (await countOutbox()) === 0 ? [] : await readOutbox();

  for (const entry of entries) {
    const payload: Record<string, unknown> = {};
    for (const field of entry.fields) {
      const mapped = column(field, entry);
      if (mapped !== undefined) payload[mapped.name] = mapped.value;
    }

    // Blieb nichts uebrig (nur ein Ordner, den es oben nicht gibt), waere ein
    // leeres `update` ein Aufruf ohne Wirkung. Der Eintrag bleibt stehen und
    // geht mit, sobald der Ordner oben angelegt ist.
    if (Object.keys(payload).length === 0) continue;

    const { error } = await supabase.from('documents').update(payload).eq('id', entry.documentId);
    if (error) {
      failed.push(`${entry.documentId}: ${error.message}`);
      continue;
    }
    done.push({ documentId: entry.documentId, queuedAt: entry.queuedAt });
  }

  // Erst aufraeumen, dann melden: was oben angekommen ist, soll auch dann
  // nicht ein zweites Mal geschickt werden, wenn eine andere Zeile scheitert.
  await clearOutbox(done);

  failed.push(...(await pushSettings(userId)));

  if (failed.length > 0) {
    throw new Error(`${failed.length} Änderung(en) blieben offen: ${failed[0]}`);
  }

  return { pushed: done.length };
}
