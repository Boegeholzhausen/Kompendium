/**
 * Die Verbindung zur Datei: oeffnen, migrieren, beim allerersten Start
 * befuellen.
 *
 * Herausgeloest aus `repository.ts`. Alles hier laeuft genau einmal je
 * Programmlauf; die Arbeit an den einzelnen Zeilen steht in `repos/`.
 */
import {
  openDatabaseAsync,
  type SQLiteBindValue,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { seedFolders, seedLibrary } from '../sampleLibrary';
import { isSupabaseConfigured } from '../supabase';
import type { StoredDocument } from '../library';
import { createSchemaSql, DATABASE_NAME, migrations, SCHEMA_VERSION } from './schema';

let handle: Promise<SQLiteDatabase> | null = null;

export function toBind(value: unknown): SQLiteBindValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value as SQLiteBindValue;
}

/**
 * Oeffnet die Datenbank, legt das Schema an und befuellt sie beim allerersten
 * Start. Das Versprechen wird gemerkt: jeder weitere Aufruf bekommt dieselbe
 * Verbindung, auch wenn zwei Screens gleichzeitig fragen.
 */
export function database(): Promise<SQLiteDatabase> {
  if (handle === null) {
    handle = (async () => {
      const db = await openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(createSchemaSql);
      await migrate(db);
      await seedIfEmpty(db);
      return db;
    })();
  }
  return handle;
}

/**
 * Bringt eine vorhandene Datei auf den heutigen Stand.
 *
 * `createSchemaSql` legt nur an, was fehlt — eine neue Spalte in einer
 * bestehenden Tabelle erreicht es nicht. Die Version steht in der Datei
 * selbst (`user_version`); eine frisch angelegte Datenbank steht auf 0, hat
 * aber schon alle Spalten, deshalb laeuft dort nur das PRAGMA.
 *
 * ## Warum je Zielversion eine Transaktion
 *
 * Frueher liefen alle Schritte einzeln und `user_version` wurde erst ganz am
 * Ende gesetzt. Ein Abbruch mitten in einer Stufe (Absturz, Speichermangel,
 * Beenden durch das System) liess die Datei damit dauerhaft unbrauchbar
 * zurueck: die Version stand noch auf dem alten Wert, der naechste Start
 * wiederholte dieselbe Stufe, und `ALTER TABLE ADD COLUMN` scheiterte an
 * "duplicate column name". Ab da warf `database()` bei jedem Aufruf — und
 * weil das Versprechen gemerkt wird, auch nach jedem Neustart.
 *
 * Jetzt gilt je Stufe: entweder alle ihre Befehle UND die neue Versionsnummer,
 * oder nichts davon. `PRAGMA user_version` ist in SQLite transaktionsfaehig
 * und wird deshalb innerhalb derselben Transaktion gesetzt.
 *
 * Zusaetzlich ueberspringt `alreadyApplied` Schritte, die eine Spalte anlegen
 * wollen, die es laengst gibt — der Rueckweg fuer Datenbanken, die eine
 * frueher abgebrochene Migration bereits halb hinter sich haben.
 */
async function migrate(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ user_version: number }>('PRAGMA user_version');
  const from = rows[0]?.user_version ?? 0;
  if (from === SCHEMA_VERSION) return;

  // Eine leere Datei ist keine alte Datei: sie wurde eben erst aus
  // `createSchemaSql` gebaut und braucht keinen ALTER-Befehl.
  const counted = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM documents'
  );
  const fresh = from === 0 && (counted[0]?.count ?? 0) === 0;

  if (fresh) {
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    return;
  }

  // Die Stufen in aufsteigender Reihenfolge, je Zielversion gebuendelt.
  const targets = [...new Set(migrations.map((step) => step.to))]
    .filter((to) => to > from)
    .sort((a, b) => a - b);

  for (const to of targets) {
    const steps = migrations.filter((step) => step.to === to);
    await db.withTransactionAsync(async () => {
      for (const step of steps) {
        if (await alreadyApplied(db, step.sql)) continue;
        await db.execAsync(step.sql);
      }
      await db.execAsync(`PRAGMA user_version = ${to}`);
    });
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/**
 * Steht die Spalte, die dieser Schritt anlegen will, schon in der Tabelle?
 *
 * Betrifft ausschliesslich `ALTER TABLE … ADD COLUMN` — der einzige Befehl in
 * `migrations`, der sich nicht wiederholen laesst. Alles andere dort ist
 * bereits mit `IF NOT EXISTS` geschrieben und braucht die Frage nicht.
 */
async function alreadyApplied(db: SQLiteDatabase, sql: string): Promise<boolean> {
  const match = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/i.exec(sql.trim());
  if (match === null) return false;

  const [, table, column] = match;
  const info = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return info.some((entry) => entry.name === column);
}

/**
 * Die Erstbefuellung — aber nur, solange es nichts Echtes gibt.
 *
 * Sobald Zugangsdaten in `.env` stehen, kommt der Bestand aus Supabase, und
 * der Beispiel-Bestand haette dann nur eine Wirkung: er stuende beim ersten
 * Start neben den echten Dokumenten und liesse den Nutzer aufraeumen, was er
 * nie angelegt hat. Ohne `.env` bleibt er, was er war — der Grund, warum die
 * App auch ohne Server etwas zu zeigen hat.
 */
async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  if (isSupabaseConfigured) return;

  const rows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM documents');
  if ((rows[0]?.count ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    for (const folder of seedFolders) {
      await db.runAsync('INSERT INTO folders (name, color, keep_offline) VALUES (?, ?, ?)', [
        folder.name,
        folder.color,
        folder.keepOffline ? 1 : 0,
      ]);
    }
    for (const document of seedLibrary) {
      await insertRow(db, document);
    }
  });
}

export async function insertRow(db: SQLiteDatabase, document: StoredDocument): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO documents
       (id, title, doc_type, folder_name, favorite, cached, size_bytes,
        updated_at, imported_at, open_count, last_opened_at, note, keep_offline,
        trashed_at, source, cache_key, storage_path, content_hash, read_at,
        archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      document.id,
      document.title,
      document.docType,
      document.folderName,
      document.favorite ? 1 : 0,
      document.cached ? 1 : 0,
      document.sizeBytes,
      document.updatedAt,
      document.importedAt,
      document.openCount,
      document.lastOpenedAt,
      document.note,
      document.keepOffline ? 1 : 0,
      document.trashedAt,
      document.source,
      document.cacheKey,
      document.storagePath,
      document.contentHash,
      document.readAt,
      document.archivedAt,
    ]
  );
}
