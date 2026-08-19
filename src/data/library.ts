/**
 * Die Typen der Bibliothek — was ein Dokument und ein Ordner sind.
 *
 * Sie standen bis Schritt 6 in `sampleLibrary.ts`, weil es dort den einzigen
 * Bestand gab. Seit Schritt 7 ist die lokale Datenbank die Wahrheitsquelle und
 * der Beispiel-Bestand nur noch ihre Erstbefuellung; die Typen gehoeren
 * deshalb nicht mehr dorthin. `sampleLibrary` gibt sie weiter aus, damit kein
 * Aufrufer seinen Import aendern muss.
 *
 * `LibraryDocument` ist, was die Screens sehen. `StoredDocument` ist dieselbe
 * Zeile, wie sie in der Datenbank liegt — mit den Feldern, die nur Sheets und
 * Einstellungen brauchen (Notiz, offline behalten, Papierkorb, Herkunft,
 * Schluessel im Dateicache).
 */
import type { DocType } from '../theme/tile';

export interface LibraryFolder {
  /**
   * Zugleich Ausweis. Der Prototyp zeigt ueberall den Namen, und eine eigene
   * Ausweisspalte haette in dieser App keinen zweiten Leser — Umbenennen
   * wirkt dafuer in beiden Tabellen (siehe `renameFolder` im Repository).
   */
  name: string;
  color: string;
  /** "Inhalt offline behalten" — gilt fuer alles im Ordner (Screen 17). */
  keepOffline: boolean;
}

/**
 * Woher das Dokument kam.
 *
 * `pc` ist der Regelfall, sobald der Abgleich laeuft: die Datei wurde am
 * Rechner erzeugt und mit `scripts/upload.mjs` hochgeladen. Die drei
 * Importwege sind der Weg fuer alles, was unterwegs dazukommt. `sample` ist die
 * Erstbefuellung und kein Importweg — sie erscheint nur, solange die App ohne
 * Supabase laeuft.
 */
export type DocumentSource = 'pc' | 'file' | 'clipboard' | 'url' | 'sample';

export const sourceLabels: Record<DocumentSource, string> = {
  pc: 'Vom PC',
  file: 'Datei',
  clipboard: 'Zwischenablage',
  url: 'URL',
  sample: 'Beispiel',
};

export interface LibraryDocument {
  id: string;
  title: string;
  docType: DocType;
  /** null = nicht einsortiert. Diese Dokumente stehen in der Sektion "Neu". */
  folderName: string | null;
  favorite: boolean;
  /** Offline nicht im Cache: die Zeile bleibt sichtbar, ist aber nicht zu oeffnen. */
  cached: boolean;
  sizeBytes: number;
  updatedAt: number;
  importedAt: number;
  /** Wie oft geoeffnet — das Info-Sheet zeigt es unter den Metadaten. */
  openCount: number;
  /**
   * Wann zuletzt geoeffnet; `null` = noch nie. Screen 22 (Blatt `4d`) nennt
   * "Zuletzt geöffnet vor 6 Tagen · 88 KB" — die Zeile, die zeigt, dass das
   * Dokument existiert und nur sein Inhalt fehlt. `updatedAt` waere dafuer die
   * falsche Angabe: Lesen aendert nichts.
   */
  lastOpenedAt: number | null;
}

export interface StoredDocument extends LibraryDocument {
  note: string;
  keepOffline: boolean;
  /** Zeitpunkt des Loeschens; `null` = nicht im Papierkorb. */
  trashedAt: number | null;
  source: DocumentSource;
  /**
   * Schluessel der Datei im lokalen Dateicache. `null` heisst: es gibt keine
   * eigene Datei, der Viewer zeigt den erzeugten Beispielinhalt.
   */
  cacheKey: string | null;
  /**
   * Wo die Datei in Supabase Storage liegt. `null` heisst: diese Zeile war noch
   * nie oben — kein Fehler, sondern der Normalfall fuer alles, was am Handy
   * importiert und noch nicht abgeglichen wurde.
   */
  storagePath: string | null;
  /**
   * Pruefsumme des Inhalts, wie sie oben steht. Weicht sie vom Stand der
   * gecachten Datei ab, ist die Datei veraltet — das Handoff-Dokument nennt
   * Dateien unveraenderlich, ein geaenderter Hash ist deshalb ein neuer Inhalt
   * und kein Konflikt: neu holen, nicht zusammenfuehren.
   */
  contentHash: string | null;
  /**
   * Wann als gelesen markiert; `null` = ungelesen. Lesen setzt das NICHT von
   * selbst — der Status kommt nur ueber die Wischgeste und die gestenfreien
   * Ersatzwege (Kontextmenue, Auswahlleiste, Info-Sheet).
   */
  readAt: number | null;
  /**
   * Wann archiviert; `null` = nicht archiviert. Zweite Achse neben `readAt`
   * und keine dritte Stufe: sonst ginge beim Entarchivieren verloren, dass das
   * Dokument gelesen wurde.
   */
  archivedAt: number | null;
}

/** Frist des Papierkorbs aus Blatt `6a`: "Wird nach 30 Tagen endgültig gelöscht". */
export const TRASH_DAYS = 30;

/**
 * Nicht zu oeffnen — Blatt `4c`, "nicht geladen".
 *
 * Beide Bedingungen zusammen: kein Inhalt im Geraetespeicher UND kein Netz,
 * um ihn zu holen. Mit Netz ist ein ungecachtes Dokument keine Sackgasse,
 * sondern eine Wartezeit; die Zeile dann zu sperren, waere eine
 * Falschauskunft. Diese Regel steht an einer Stelle, weil vier Listen und der
 * Viewer sich darueber einig sein muessen.
 */
export function isUnavailable(document: { cached: boolean }, isOnline: boolean): boolean {
  return !document.cached && !isOnline;
}

/** Liegt das Dokument im Papierkorb? Alle Listen blenden es dann aus. */
export function isTrashed(document: StoredDocument): boolean {
  return document.trashedAt !== null;
}

/** Noch nicht als gelesen markiert — der Filter "Ungelesen" haengt daran. */
export function isUnread(document: { readAt: number | null }): boolean {
  return document.readAt === null;
}

/** Aus dem Alltag genommen, aber nicht geloescht — eigene Achse neben `readAt`. */
export function isArchived(document: { archivedAt: number | null }): boolean {
  return document.archivedAt !== null;
}

/**
 * Was Bibliothek und Ordner-Detail zeigen: alles ausser Papierkorb UND Archiv.
 * Vier Listen und die Suche muessen sich darueber einig sein — deshalb steht
 * die Regel hier und nicht je Screen neu geschrieben.
 */
export function isVisible(document: StoredDocument): boolean {
  return document.trashedAt === null && document.archivedAt === null;
}
