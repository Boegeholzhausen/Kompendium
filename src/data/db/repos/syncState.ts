/**
 * Was der Abgleich sich merkt — Wasserzeichen, erledigte Wanderungen, Konto.
 *
 * Bewusst neben `settings` und nicht darin: das sind Voreinstellungen des
 * Nutzers, die er in der Darstellung wiederfindet. Buchhaltung des Abgleichs
 * hat dort nichts zu suchen.
 */
import { database } from '../connection';

/**
 * Was der Abgleich sich merkt. Zwei Schluessel, beide in `sync_state`:
 *
 *   last_pulled_at  Wasserzeichen des letzten Abrufs, ein SERVER-Zeitstempel
 *                   als ISO-Text. Nie die Geraetezeit — sie geht vor oder nach,
 *                   und beides laesst Zeilen verschwinden.
 *   reset_done      Ob der einmalige Schnitt vom Beispiel-Bestand auf den
 *                   echten schon gelaufen ist.
 *   uuid_ids_done   Ob die einmalige Wanderung der lokalen Import-Kennungen
 *                   auf UUIDs gelaufen ist (`migrateLocalIdsToUuid`).
 *   scroll_moved    Ob die Lesepositionen einmalig aus `settings` in die
 *                   Dokumentzeile gewandert sind (`adoptScrollPositions`).
 *   settings_pushed Die Voreinstellungen, wie sie zuletzt oben ankamen — als
 *                   JSON. Ohne diesen Vergleich schoebe jedes Geraet bei jedem
 *                   Abgleich seinen alten Stand ueber den neuen des anderen.
 *   owner_id        Unter welcher Identitaet der letzte Abruf lief. Aendert sie
 *                   sich (Anmeldung mit E-Mail, Abmelden), sind Wasserzeichen
 *                   und Ordner-Ausweise Aussagen ueber ein fremdes Konto.
 */
export type SyncStateKey =
  | 'last_pulled_at'
  | 'reset_done'
  | 'uuid_ids_done'
  | 'scroll_moved'
  | 'settings_pushed'
  | 'owner_id';

export async function readSyncState(key: SyncStateKey): Promise<string | null> {
  const db = await database();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?',
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function writeSyncState(key: SyncStateKey, value: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]);
}

/**
 * Festhalten, unter welcher Identitaet abgeglichen wird — und aufraeumen, wenn
 * es eine andere ist als beim letzten Mal.
 *
 * Was nach einem Identitaetswechsel nicht mehr gilt:
 *
 * `folders.remote_id` zeigt auf Zeilen eines anderen Kontos. RLS laesst ein
 * `update` darauf nicht scheitern — es trifft schlicht keine Zeile und meldet
 * Erfolg. Der Ordner ginge damit nie oben an, und niemand erfuehre es. Ohne
 * Ausweis sucht `pushFolders` wieder ueber den Namen und legt an, was fehlt.
 *
 * Die Grabsteine gehen aus demselben Grund: eine Loeschung im alten Konto
 * nachzuholen waere ein Eingriff in fremde Daten. Und `settings_pushed` gilt
 * nicht mehr: was das alte Konto zuletzt bekam, sagt nichts ueber das neue.
 *
 * Der Bestand selbst bleibt unangetastet — die lokale Datenbank ist die
 * Wahrheitsquelle, und ein Kontowechsel ist kein Grund, Dokumente zu
 * verlieren. Was frueher schon oben lag, bleibt dort allerdings liegen: seine
 * Zeile gehoert dem alten Konto, und der neue Bestand kennt sie nicht.
 *
 * Rueckgabe: ob wirklich gewechselt wurde. Beim allerersten Lauf steht noch
 * gar keine Identitaet fest — das ist kein Wechsel und raeumt nichts auf.
 */
export async function noteOwner(userId: string): Promise<boolean> {
  const previous = await readSyncState('owner_id');
  if (previous === userId) return false;

  const db = await database();
  if (previous !== null) {
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE folders SET remote_id = NULL');
      await db.runAsync('DELETE FROM folder_deletions');
      // Aus demselben Grund wie die Ordner-Grabsteine: eine Loeschung im alten
      // Konto nachzuholen waere ein Eingriff in fremde Daten — und der Pfad im
      // Grabstein zeigt auf einen Bucket-Bereich, an den RLS uns ohnehin nicht
      // mehr laesst.
      await db.runAsync('DELETE FROM document_deletions');
      await db.runAsync('DELETE FROM sync_state WHERE key IN (?, ?)', [
        'last_pulled_at',
        // Was das alte Konto zuletzt bekam, sagt nichts darueber, was das neue
        // schon hat — sonst schickte der naechste Push die Voreinstellungen gar
        // nicht erst hoch.
        'settings_pushed',
      ]);
    });
  }
  await writeSyncState('owner_id', userId);
  return previous !== null;
}
