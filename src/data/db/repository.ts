/**
 * Das Repository — die Schicht, in der als einziger Ort SQL steht.
 *
 * Die Zustaende (`src/state/*`) lesen beim Start einmal `loadSnapshot()` und
 * schreiben danach jede Aenderung hierher zurueck. Kein Screen kennt die
 * Datenbank; er kennt nur seinen Zustand.
 *
 * Geschrieben wird **feldweise** (`updateDocuments(ids, patch)`), nicht als
 * ganze Zeile: die Screens aendern immer nur ein paar Spalten, und eine ganze
 * Zeile zurueckzuschreiben hiesse, den Rest aus dem Zustand neu zu belegen —
 * jede Abweichung dort waere ein stiller Datenverlust.
 *
 * ## Warum diese Datei nur noch weiterreicht
 *
 * Sie war einmal die ganze Schicht und dabei auf ueber 1300 Zeilen gewachsen:
 * Verbindung, Migration, Dokumente, Ordner, Outbox, Voreinstellungen,
 * Abgleichsbuchhaltung und Datenwanderungen untereinander. Wer eine dieser
 * Sachen suchte, las an sieben anderen vorbei.
 *
 * Zerlegt ist sie jetzt entlang der Entitaeten:
 *
 *   connection.ts     oeffnen, migrieren, erstbefuellen
 *   rows.ts           wie eine Zeile aussieht und wie sie uebersetzt wird
 *   repos/documents   die Dokumentzeilen samt Grabsteinen
 *   repos/folders     die Ordnerzeilen, lokal und auf dem Weg nach oben
 *   repos/outbox      geaenderte Felder und noch nie hochgeladene Dokumente
 *   repos/settings    die Voreinstellungen
 *   repos/syncState   Wasserzeichen, Konto, erledigte Wanderungen
 *   repos/migrations  die einmaligen Datenwanderungen
 *   repos/remote      was der Abruf in die Datenbank schreibt
 *
 * Die Regel aus CLAUDE.md gilt unveraendert, nur eine Ebene hoeher: SQL steht
 * ausschliesslich unterhalb von `src/data/db/`. Nach aussen aendert sich
 * nichts — jeder Aufrufer importiert weiterhin aus dieser Datei, und die
 * Aufteilung dahinter bleibt eine Sache dieser Schicht.
 *
 * Fuer den Web-Export gibt es `repository.web.ts` mit derselben Schnittstelle
 * im Arbeitsspeicher: expo-sqlite laeuft im Browser ueber WebAssembly und
 * verlangt dafuer eigene HTTP-Kopfzeilen, die der statische Build (`python3
 * -m http.server`) nicht liefert. Der Web-Build dient allein der
 * Bildkontrolle gegen den Prototyp — dieselbe Ueberlegung wie bei
 * `DocumentView.web.tsx`.
 */
export type { DocumentPatch, Snapshot } from './rows';

export {
  clearLibrary,
  deleteDocuments,
  expiredTrashIds,
  insertDocument,
  loadSnapshot,
  markDeletionsPushed,
  readDocumentDeletions,
  updateDocuments,
  type DocumentDeletion,
} from './repos/documents';

export {
  clearFolderDeletions,
  deleteFolder,
  readFolderDeletions,
  readFoldersForPush,
  renameFolder,
  setFolderRemoteId,
  upsertFolder,
  type FolderForPush,
} from './repos/folders';

export {
  clearOutbox,
  countOutbox,
  markUploaded,
  readOutbox,
  readUploadable,
  type OutboxEntry,
  type UploadableDocument,
} from './repos/outbox';

export {
  readSettings,
  setSetting,
  writeSettings,
  SETTING_SCROLL_POSITIONS,
  SYNCED_SETTING_KEYS,
} from './repos/settings';

export { noteOwner, readSyncState, writeSyncState, type SyncStateKey } from './repos/syncState';

export { adoptScrollPositions, migrateLocalIdsToUuid } from './repos/migrations';

export {
  applyRemote,
  type RemoteDocument,
  type RemoteFolder,
  type RemoteSnapshot,
} from './repos/remote';
