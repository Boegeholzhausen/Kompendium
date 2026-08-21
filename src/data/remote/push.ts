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
 * ## Was in dieser Datei steht
 *
 * Nur noch die Reihenfolge. Die vier Schritte selbst liegen daneben, weil
 * jeder von ihnen seine eigene Ueberlegung mitbringt und sie zusammen die
 * Datei auf ueber 500 Zeilen brachten:
 *
 *   push/folders.ts    die Ordner, samt Grabsteinen und Farbuebersetzung
 *   push/uploads.ts    Dokumente, die es oben noch nicht gibt
 *   push/deletions.ts  endgueltig geloeschte Dokumente
 *   push/settings.ts   die Voreinstellungen
 *   push/shared.ts     Zeitstempel und die Feld-zu-Spalte-Uebersetzung
 *
 * Die Reihenfolge ist das, was zwischen ihnen steht — und sie ist der Grund,
 * warum sie nicht einfach nebeneinander laufen koennen:
 *
 * ## Reihenfolge
 *
 *   Ordner → neue Dokumente → Grabsteine → geaenderte Felder → Voreinstellungen
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
import { clearOutbox, countOutbox, noteOwner, readOutbox, readSyncState } from '../db/repository';
import { currentUserId, supabase } from '../supabase';
import { pushDocumentDeletions } from './push/deletions';
import { pushFolders } from './push/folders';
import { pushSettings } from './push/settings';
import { column } from './push/shared';
import { uploadNewDocuments } from './push/uploads';

/** Wie viele Zeilen tatsaechlich oben angekommen sind. */
export interface PushResult {
  pushed: number;
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

  // Die Grabsteine VOR der Feldschleife: was endgueltig weg ist, soll nicht
  // vorher noch ein `read_at` von einem Eintrag bekommen, der im selben Lauf
  // ohnehin ins Leere liefe. Ihre Zeilen sind ausserdem disjunkt von der Outbox
  // — deren Eintraege sind mit den Dokumentzeilen gegangen.
  failed.push(...(await pushDocumentDeletions()));

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

    // `select('id')` ist kein Feinschliff, sondern die Erfolgskontrolle:
    // PostgREST meldet fuer ein `update`, das KEINE Zeile trifft, keinen
    // Fehler. Ohne die Rueckgabe raeumte `clearOutbox` den Eintrag ab, obwohl
    // oben nichts ankam — die Aenderung waere weg und der Status stuende auf
    // "Synchron". `noteOwner` faengt davon nur den Kontowechsel ab; die Zeile
    // kann auch oben hart geloescht oder die lokale Datenbank aus einer
    // Sicherung zurueckgespielt worden sein.
    const { data: written, error } = await supabase
      .from('documents')
      .update(payload)
      .eq('id', entry.documentId)
      .select('id');
    if (error) {
      failed.push(`${entry.documentId}: ${error.message}`);
      continue;
    }
    if ((written ?? []).length === 0) {
      failed.push(`${entry.document.title}: diese Zeile gibt es oben nicht (mehr).`);
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
