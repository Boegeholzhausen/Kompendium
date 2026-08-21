/**
 * Die Voreinstellungen — Darstellung, Sortierung, Textgroesse.
 *
 * Schluessel und Wert, mehr braucht es nicht: die Menge waechst mit jeder
 * neuen Einstellung, und ein Spaltensatz waere fuer jede davon eine Migration
 * auf beiden Seiten.
 */
import { database } from '../connection';

/**
 * Der `settings`-Schluessel, unter dem die Lesepositionen liegen — ein
 * JSON-Objekt `{ dokumentId: offset }` (siehe `state/viewer.ts`).
 *
 * Er steht hier und nicht dort, weil die ID-Wanderung ihn mitziehen muss: die
 * Positionen sind nach der Dokumentkennung geschluesselt, und eine neue Kennung
 * ohne diesen Schritt hiesse, dass jedes gewanderte Dokument wieder oben
 * anfaengt. Wuerde das Repository ihn aus `state/viewer.ts` holen, entstuende
 * ein Modulzyklus — dort wird bereits `setSetting` von hier importiert.
 */
export const SETTING_SCROLL_POSITIONS = 'viewer.scrollPositions';

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// ── Voreinstellungen: der Weg in beide Richtungen ───────────────────────────

/**
 * Welche `settings`-Schluessel zum KONTO gehoeren und nicht zum Geraet.
 *
 * Textgroesse, Abdunkeln, Bildschirm anlassen, Darstellung und Sortierung
 * beschreiben, wie der Nutzer lesen will — das gilt auf jedem seiner Geraete.
 *
 * Ausdruecklich NICHT dabei:
 *
 *   search.recentQueries    was hier zuletzt gesucht wurde, ist ein Verlauf
 *                           dieses Geraets und keine Voreinstellung
 *   viewer.scrollPositions  gibt es seit Schema 7 nicht mehr — die Position
 *                           steht in der Dokumentzeile
 */
export const SYNCED_SETTING_KEYS = [
  'appearance.viewerTextScale',
  'appearance.dimDocuments',
  'appearance.keepScreenOn',
  'library.viewMode',
  'library.sort',
];

export async function readSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const db = await database();
  const placeholders = keys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    keys
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Mehrere Voreinstellungen in einem Zug — der Abruf bringt sie gebuendelt. */
export async function writeSettings(entries: Record<string, string>): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const key of keys) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        key,
        entries[key],
      ]);
    }
  });
}
