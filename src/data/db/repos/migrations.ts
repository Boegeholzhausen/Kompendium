/**
 * Die einmaligen Datenwanderungen.
 *
 * Sie stehen NICHT in `schema.ts`: dort steht ausschliesslich SQL, und diese
 * beiden muessen Zeile fuer Zeile rechnen. Abgesichert sind sie ueber
 * `sync_state` und nicht ueber `user_version` — ein zweiter Lauf waere
 * harmlos, aber die Absicht "genau einmal" gehoert dorthin, wo sie nachlesbar
 * ist. Gerufen werden sie beim Start aus `state/hydrate.ts`.
 */
import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { database } from '../connection';
import { SETTING_SCROLL_POSITIONS } from './settings';
import { readSyncState, writeSyncState } from './syncState';

// ── Dokumente vom Handy nach oben ───────────────────────────────────────────

/** Sieht eine Kennung nach einer UUID aus? */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Die einmalige Wanderung der lokalen Import-Kennungen auf UUIDs.
 *
 * Frueher hiessen sie `doc-import-mf3x…`; oben ist `public.documents.id` eine
 * `uuid`. Solche Zeilen konnten deshalb prinzipiell nie hochgehen — sie
 * existierten ausschliesslich auf diesem Geraet, still und ohne Hinweis in der
 * Oberflaeche.
 *
 * Warum das keine Migration in `schema.ts` ist: dort steht ausschliesslich SQL,
 * und hier muss je Zeile eine neue Kennung erzeugt und an drei weiteren
 * Stellen nachgezogen werden. Abgesichert ist der Lauf ueber `sync_state`
 * (`uuid_ids_done`) und nicht ueber `user_version`: ein zweiter Lauf waere
 * harmlos, aber die Absicht "genau einmal" gehoert dorthin, wo sie nachlesbar
 * ist.
 *
 * `cache_key` bleibt bewusst unveraendert: die Datei im Cache wird nicht
 * umbenannt. Wo sie liegt, ist eine Frage dieses Geraets — und ein
 * Dateisystemlauf ueber Hunderte Dokumente waere ein Risiko ohne Gegenwert.
 *
 * Der Suchindex braucht nichts: er liegt im Arbeitsspeicher und wird nach
 * diesem Lauf erst gefuellt (`warmSearchIndex` in `state/hydrate.ts`).
 *
 * Rueckgabe ist die Zahl gewanderter Zeilen — fuer das Protokoll, nicht fuer
 * die Oberflaeche.
 */
export async function migrateLocalIdsToUuid(): Promise<number> {
  if ((await readSyncState('uuid_ids_done')) !== null) return 0;

  const db = await database();
  // Nur Zeilen, die nie oben waren. Alles mit `storage_path` traegt bereits
  // die Kennung, unter der es dort steht — die darf sich nie aendern.
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM documents WHERE storage_path IS NULL'
  );
  const stale = rows.filter((row) => !UUID.test(row.id));

  for (const row of stale) {
    const next = Crypto.randomUUID();
    await db.withTransactionAsync(async () => {
      // `PRAGMA foreign_keys` steht auf ON, und `outbox.document_id` zeigt auf
      // `documents(id)` — beim Umschreiben der Elternzeile haenge der Eintrag
      // sonst in der Luft. Er wird deshalb gemerkt, entfernt und unter der
      // neuen Kennung wieder eingetragen; `queued_at` bleibt stehen, damit
      // `clearOutbox` ihn spaeter wiedererkennt.
      const open = await db.getAllAsync<{ fields: string; queued_at: number }>(
        'SELECT fields, queued_at FROM outbox WHERE document_id = ?',
        [row.id]
      );
      await db.runAsync('DELETE FROM outbox WHERE document_id = ?', [row.id]);
      await db.runAsync('UPDATE documents SET id = ? WHERE id = ?', [next, row.id]);

      const entry = open[0];
      if (entry !== undefined) {
        await db.runAsync(
          'INSERT INTO outbox (document_id, fields, queued_at) VALUES (?, ?, ?)',
          [next, entry.fields, entry.queued_at]
        );
      }

      await moveScrollPosition(db, row.id, next);
    });
  }

  await writeSyncState('uuid_ids_done', new Date().toISOString());
  return stale.length;
}

/**
 * Die Leseposition auf die neue Kennung umhaengen.
 *
 * Ohne diesen Schritt faenge jedes gewanderte Dokument wieder oben an — die
 * Positionen liegen als ein JSON-Objekt in `settings`, geschluesselt nach der
 * Dokumentkennung (siehe `state/viewer.ts`).
 */
async function moveScrollPosition(
  db: SQLiteDatabase,
  from: string,
  to: string
): Promise<void> {
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTING_SCROLL_POSITIONS]
  );
  const raw = rows[0]?.value;
  if (raw === undefined) return;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return;
    const positions = parsed as Record<string, unknown>;
    if (!(from in positions)) return;

    positions[to] = positions[from];
    delete positions[from];
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      SETTING_SCROLL_POSITIONS,
      JSON.stringify(positions),
    ]);
  } catch {
    // Kaputtes JSON ist kein Grund, die Wanderung abzubrechen: dann faengt das
    // Dokument eben wieder oben an. `state/viewer.ts` verwirft es ohnehin.
  }
}

/**
 * Die einmalige Uebernahme der Lesepositionen aus `settings` in die
 * Dokumentzeile.
 *
 * Bis Schema 6 lagen sie als ein JSON-Objekt unter einem `settings`-Schluessel
 * — ein Wert ueber ein Dokument, der nicht am Dokument hing und deshalb auch
 * nie mit ihm nach oben ging. Nach dem Umzug ist das eine Spalte wie jede
 * andere und laeuft ueber die vorhandene Outbox mit.
 *
 * Bewusst OHNE Outbox-Eintrag: das waere ein Schwung Eintraege fuer Positionen,
 * die der Nutzer nie neu gesetzt hat. Sie gehen mit, sobald das Dokument das
 * naechste Mal gelesen wird.
 *
 * Laeuft nach `migrateLocalIdsToUuid`: die Kennungen im JSON-Objekt muessen
 * schon die neuen sein, sonst trifft das UPDATE keine Zeile.
 */
export async function adoptScrollPositions(): Promise<number> {
  if ((await readSyncState('scroll_moved')) !== null) return 0;

  const db = await database();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTING_SCROLL_POSITIONS]
  );

  let moved = 0;
  const raw = rows[0]?.value;
  if (raw !== undefined) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object') {
        const entries = Object.entries(parsed as Record<string, unknown>).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isFinite(entry[1])
        );
        await db.withTransactionAsync(async () => {
          for (const [id, offset] of entries) {
            await db.runAsync('UPDATE documents SET scroll_offset = ? WHERE id = ?', [
              Math.max(0, Math.round(offset)),
              id,
            ]);
          }
          // Der alte Eintrag geht im selben Zug: zwei Wahrheiten ueber dieselbe
          // Stelle waeren schlimmer als keine.
          await db.runAsync('DELETE FROM settings WHERE key = ?', [SETTING_SCROLL_POSITIONS]);
        });
        moved = entries.length;
      }
    } catch {
      // Kaputtes JSON ist kein Grund, den Start abzubrechen — dann faengt jedes
      // Dokument eben wieder oben an.
    }
  }

  await writeSyncState('scroll_moved', new Date().toISOString());
  return moved;
}
