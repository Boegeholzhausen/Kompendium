/**
 * Endgueltig geloeschte Dokumente nach oben.
 */
import { markDeletionsPushed, readDocumentDeletions } from '../../db/repository';
import { STORAGE_BUCKET, supabase } from '../../supabase';

/**
 * Endgueltig geloeschte Dokumente — der Weg, den die Outbox nicht gehen kann.
 *
 * Ihr Eintrag haengt per `ON DELETE CASCADE` an der Dokumentzeile und geht im
 * Moment des Loeschens mit ihr; die einzige Spur ist der Grabstein aus
 * `document_deletions` (Begruendung in `schema.ts`). Ohne diesen Schritt bliebe
 * die Zeile oben fuer immer stehen — und mit ihr ihre Datei im Bucket, den
 * sonst nichts im Projekt jemals aufraeumt.
 *
 * Zwei Schritte je Grabstein, in dieser Reihenfolge:
 *
 *   deleted_at setzen  damit ein zweites Geraet die Loeschung ueberhaupt
 *                      erfaehrt — ein Soft Delete kommt durch dasselbe
 *                      Wasserzeichen mit wie jede andere Aenderung
 *   Datei loeschen     der Inhalt ist hier bereits weg; ihn oben zu behalten
 *                      hiesse, Platz fuer etwas zu belegen, das niemand mehr
 *                      oeffnen kann
 *
 * Die Zeile oben wird NICHT hart geloescht: ein hartes Loeschen traegt kein
 * `updated_at` und kaeme deshalb bei keinem Abruf mit — das zweite Geraet
 * behielte seine Kopie fuer immer, ohne je zu erfahren, warum. Was bleibt, ist
 * eine Zeile im Papierkorb-Zustand, die dort nach der 30-Tage-Frist von selbst
 * geht.
 *
 * Abgehakt wird nur, was ganz durchkam: bleibt die Datei stehen, kommt der
 * Grabstein beim naechsten Lauf wieder dran.
 */
export async function pushDocumentDeletions(): Promise<string[]> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');

  const deletions = await readDocumentDeletions();
  if (deletions.length === 0) return [];

  const failed: string[] = [];
  const done: string[] = [];

  for (const deletion of deletions) {
    // Kein `select` zur Erfolgskontrolle, anders als in der Feldschleife: hier
    // ist "die Zeile gibt es oben nicht mehr" kein Verlust, sondern das Ziel.
    // Zaehlen wuerde nur, ob der Aufruf ueberhaupt durchkam.
    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', deletion.documentId);
    if (error) {
      failed.push(`Löschen: ${error.message}`);
      continue;
    }

    const removal = await supabase.storage.from(STORAGE_BUCKET).remove([deletion.storagePath]);
    if (removal.error) {
      failed.push(`Datei löschen: ${removal.error.message}`);
      continue;
    }

    done.push(deletion.documentId);
  }

  await markDeletionsPushed(done);
  return failed;
}
