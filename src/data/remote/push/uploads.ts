/**
 * Dokumente, die es oben noch nicht gibt — Datei in den Bucket, dann die Zeile.
 */
import * as Crypto from 'expo-crypto';

import { markUploaded, readUploadable } from '../../db/repository';
import { STORAGE_BUCKET, supabase } from '../../supabase';
import { readDocument } from '../../cache';
import { previewText } from '../../detect';
import { iso } from './shared';

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
export async function uploadNewDocuments(userId: string): Promise<string[]> {
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

    // `upsert` und nicht `insert`: zwischen dem Anlegen der Zeile und
    // `markUploaded` liegt ein Fenster. Wird die App darin beendet, steht
    // `storage_path` lokal weiter auf NULL, der naechste Lauf findet dasselbe
    // Dokument erneut ueber `readUploadable` — und ein `insert` scheiterte dann
    // fuer immer an der doppelten Kennung. Der Abgleich meldete daraufhin bei
    // JEDEM Lauf "1 Änderung(en) blieben offen", und das Dokument fande nie auf
    // den normalen Outbox-Weg. Ein zweiter Lauf ueber dieselbe Zeile schreibt
    // hier schlicht denselben Stand noch einmal.
    const { error } = await supabase.from('documents').upsert(
      {
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
      },
      { onConflict: 'id' }
    );
    if (error) {
      failed.push(`${document.title}: ${error.message}`);
      continue;
    }

    await markUploaded(document.id, storagePath, contentHash);
  }

  return failed;
}
