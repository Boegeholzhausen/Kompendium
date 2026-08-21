/**
 * Die Ordner nach oben — der erste Schritt jedes Laufs.
 */
import {
  clearFolderDeletions,
  readFolderDeletions,
  readFoldersForPush,
  setFolderRemoteId,
} from '../../db/repository';
import { supabase } from '../../supabase';
import { tagPalette } from '../../../theme/colors';

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
export async function pushFolders(): Promise<string[]> {
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
    //
    // Hier reicht die Abwesenheit eines Fehlers, anders als in der Feldschleife
    // weiter unten: das Ziel des Grabsteins ist "oben lebt dieser Ordner
    // nicht mehr". Trifft das `update` keine Zeile, weil es sie gar nicht
    // (mehr) gibt, ist das Ziel ebenfalls erreicht — den Grabstein dann stehen
    // zu lassen hiesse, ihn bei jedem weiteren Lauf erfolglos zu wiederholen.
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
