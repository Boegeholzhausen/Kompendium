/**
 * Die Typen der Bibliothek — was ein Dokument, ein Tag und ein Ordner sind.
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

export interface LibraryTag {
  id: string;
  name: string;
  color: string;
}

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

/** Woher das Dokument kam. `sample` ist die Erstbefuellung, kein Importweg. */
export type DocumentSource = 'file' | 'clipboard' | 'url' | 'sample';

export const sourceLabels: Record<DocumentSource, string> = {
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
  tagIds: string[];
  favorite: boolean;
  /** Offline nicht im Cache: die Zeile bleibt sichtbar, ist aber nicht zu oeffnen. */
  cached: boolean;
  sizeBytes: number;
  updatedAt: number;
  importedAt: number;
  /** Wie oft geoeffnet — das Info-Sheet zeigt es unter den Metadaten. */
  openCount: number;
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
}

/** Frist des Papierkorbs aus Blatt `6a`: "Wird nach 30 Tagen endgültig gelöscht". */
export const TRASH_DAYS = 30;

/** Liegt das Dokument im Papierkorb? Alle Listen blenden es dann aus. */
export function isTrashed(document: StoredDocument): boolean {
  return document.trashedAt !== null;
}

/** Tags eines Dokuments als vollstaendige Eintraege, in der gesetzten Reihenfolge. */
export function documentTags(tags: LibraryTag[], ids: string[]): LibraryTag[] {
  return ids
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is LibraryTag => tag !== undefined);
}
