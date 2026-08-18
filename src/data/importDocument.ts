/**
 * Import — die drei Wege aus Blatt `3g`, jetzt mit Wirkung.
 *
 * Datei waehlen · Aus Zwischenablage · Von URL laden. Alle drei enden an
 * derselben Stelle: HTML in den lokalen Dateicache legen, Titel und
 * Dokumenttyp einmal erkennen, Zeile anlegen. "Importierte Dokumente landen in
 * „Neu", bis sie einsortiert sind" — das steht in der Fussnote des Sheets und
 * heisst hier schlicht `folderName: null`.
 *
 * Die Typerkennung folgt dem Handoff-Dokument woertlich: "Der Dokumenttyp wird
 * beim Import einmal erkannt (Auszaehlen von `<table>`, `<canvas>`/`<svg>`,
 * `<input>`, `<ul>/<ol>`, Textmenge) und **persistiert** — die Kachel darf sich
 * nicht zwischen zwei Sitzungen aendern." Deshalb steht das Ergebnis in der
 * Datenbank und wird nie neu gerechnet.
 *
 * Dieselbe Datei zweimal zu importieren ist meist ein Versehen. Erkannt wird
 * das an **Titel und Groesse in Bytes** — keine Pruefsumme: ein Hashlauf ueber
 * ein paar hundert Kilobyte bei jedem Import waere spuerbar, und fuer die
 * Rueckfrage "hast du das nicht schon?" reicht das Paar aus. Zwei wirklich
 * verschiedene Dokumente mit demselben Titel UND derselben Byte-Zahl sind
 * selten, und die Antwort darauf ist ohnehin nur eine Frage, keine Sperre.
 *
 * Erkannt wird ueber Zaehlung, nicht ueber einen HTML-Parser: React Native hat
 * kein DOM, und fuer fuenf Formen genuegt es, die Auszeichnungen zu zaehlen.
 * Ein fehlerhaftes Dokument fuehrt so hoechstens zur falschen Kachel, nie zu
 * einem Absturz.
 */
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import type { DocType } from '../theme/tile';
import { deleteDocument, writeDocument } from './cache';
import type { DocumentSource, StoredDocument } from './library';
import { plainText } from './plainText';
import { forgetDocumentText, indexDocumentText } from './search';

/** Was ein Importweg liefert, bevor daraus eine Zeile wird. */
export interface ImportedFile {
  html: string;
  /** Dateiname oder Adresse — nur als Rueckfallebene fuer den Titel. */
  hint: string;
  source: DocumentSource;
}

export type ImportOutcome =
  | {
      ok: true;
      document: StoredDocument;
      /**
       * Gleicher Titel, gleiche Byte-Zahl, nicht im Papierkorb: das Sheet
       * fragt dann nach, statt stumm einen zweiten Eintrag anzulegen. Das
       * Dokument ist trotzdem fertig — wer "Trotzdem importieren" waehlt, soll
       * nicht auf einen zweiten Lauf warten. Bei "Abbrechen" raeumt
       * `discardImport` die Datei wieder weg.
       */
      duplicateOf?: StoredDocument;
    }
  | { ok: false; reason: string }
  /** Der Nutzer hat den Picker geschlossen — kein Fehler, keine Meldung. */
  | { ok: false; reason: null };

function count(html: string, pattern: RegExp): number {
  return html.match(pattern)?.length ?? 0;
}

/**
 * Der Dokumenttyp aus dem Inhalt.
 *
 * Die Reihenfolge der Pruefungen ist die Entscheidung: ein Rechner enthaelt
 * fast immer auch eine Tabelle, ein Report fast immer eine Liste. Gewinnt
 * darf deshalb nicht "was zuerst vorkommt", sondern was am meisten ueber das
 * Dokument aussagt — Eingabefelder sind das staerkste Zeichen, Fliesstext das
 * schwaechste.
 */
export function detectDocType(html: string): DocType {
  const inputs = count(html, /<input\b/gi) + count(html, /<select\b/gi);
  const charts = count(html, /<canvas\b/gi) + count(html, /<svg\b/gi);
  const tables = count(html, /<table\b/gi);
  const listItems = count(html, /<li\b/gi);
  const words = plainText(html).split(' ').length;

  // Zwei Eingabefelder sind noch ein Formular im Report; ab drei rechnet
  // jemand mit dem Dokument.
  if (inputs >= 3) return 'calculator';
  if (charts >= 1 && tables === 0) return 'chart';
  if (tables >= 1 && charts === 0) return 'table';
  if (charts >= 1 && tables >= 1) return charts > tables ? 'chart' : 'table';
  // Eine Liste mit vier Punkten in einem langen Text ist kein Listendokument.
  if (listItems >= 4 && words < listItems * 40) return 'list';
  return 'text';
}

/**
 * Der Titel aus dem Dokument: `<title>`, sonst die erste Ueberschrift, sonst
 * der Dateiname. Ein Dokument ohne jeden Hinweis bekommt ein Datum — besser
 * als "Unbenannt", das nach dem dritten Import nicht mehr unterscheidbar ist.
 */
export function detectTitle(html: string, hint: string): string {
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const fromTitle = titleTag ? plainText(titleTag[1]) : '';
  if (fromTitle) return fromTitle;

  const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const fromHeading = heading ? plainText(heading[1]) : '';
  if (fromHeading) return fromHeading;

  const fromHint = hint
    .split(/[/\\]/)
    .pop()
    ?.replace(/\.[a-z0-9]+$/i, '')
    .trim();
  if (fromHint) return fromHint;

  return `Import vom ${new Date().toLocaleDateString('de-DE')}`;
}

/** Sieht das ueberhaupt nach HTML aus? */
function looksLikeHtml(html: string): boolean {
  return /<[a-z!][\s\S]*>/i.test(html);
}

function newId(): string {
  return `doc-import-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/**
 * Der gemeinsame Abschluss aller drei Wege. Er kennt keinen Picker und keine
 * Adresse mehr — nur HTML, einen Hinweis auf den Namen und die Herkunft.
 */
export async function documentFrom(
  input: ImportedFile,
  /** Der vorhandene Bestand — Grundlage der Duplikat-Rueckfrage. */
  existing: StoredDocument[] = []
): Promise<ImportOutcome> {
  if (!input.html.trim()) return { ok: false, reason: 'Der Inhalt ist leer.' };
  if (!looksLikeHtml(input.html)) {
    return { ok: false, reason: 'Das sieht nicht nach HTML aus.' };
  }

  const id = newId();
  const sizeBytes = await writeDocument(id, input.html);
  // Der Text steht jetzt schon fest — ihn gleich abzulegen erspart es, die
  // Datei beim naechsten Suchlauf noch einmal zu lesen.
  indexDocumentText(id, input.html);
  const at = Date.now();

  const title = detectTitle(input.html, input.hint);
  const duplicateOf = existing.find(
    (document) =>
      document.trashedAt === null && document.title === title && document.sizeBytes === sizeBytes
  );

  return {
    ok: true,
    duplicateOf,
    document: {
      id,
      title,
      docType: detectDocType(input.html),
      // Importierte Dokumente landen in "Neu", bis sie einsortiert sind.
      folderName: null,
      tagIds: [],
      favorite: false,
      cached: true,
      sizeBytes,
      updatedAt: at,
      importedAt: at,
      openCount: 0,
      // Importieren ist kein Oeffnen: die Zeile steht in der Bibliothek, auf
      // dem Bildschirm war das Dokument noch nicht.
      lastOpenedAt: null,
      note: '',
      keepOffline: false,
      trashedAt: null,
      source: input.source,
      cacheKey: id,
    },
  };
}

/** Weg 1 — "Datei wählen · HTML-Datei vom Gerät". */
export async function importFromFile(existing: StoredDocument[] = []): Promise<ImportOutcome> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/html', 'application/xhtml+xml'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return { ok: false, reason: null };

  const asset = result.assets[0];
  if (asset === undefined) return { ok: false, reason: null };

  try {
    const html = await new File(asset.uri).text();
    return documentFrom({ html, hint: asset.name, source: 'file' }, existing);
  } catch {
    return { ok: false, reason: 'Die Datei liess sich nicht lesen.' };
  }
}

/** Weg 2 — "Aus Zwischenablage · HTML-Code einfügen". */
export async function importFromClipboard(
  existing: StoredDocument[] = []
): Promise<ImportOutcome> {
  const html = await Clipboard.getStringAsync();
  if (!html.trim()) return { ok: false, reason: 'Die Zwischenablage ist leer.' };
  return documentFrom({ html, hint: '', source: 'clipboard' }, existing);
}

/**
 * Weg 3 — "Von URL laden · Adresse eingeben".
 *
 * Ohne Schema wird `https` ergaenzt: wer eine Adresse eintippt, schreibt sie
 * selten vollstaendig, und `http` waere die schlechtere Vermutung.
 */
export async function importFromUrl(
  address: string,
  existing: StoredDocument[] = []
): Promise<ImportOutcome> {
  const trimmed = address.trim();
  if (!trimmed) return { ok: false, reason: null };

  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { ok: false, reason: `Die Adresse antwortete mit ${response.status}.` };
    }
    const html = await response.text();
    return documentFrom({ html, hint: url, source: 'url' }, existing);
  } catch {
    return { ok: false, reason: 'Die Adresse war nicht erreichbar.' };
  }
}

/**
 * Einen vorbereiteten Import wieder wegwerfen — nach "Abbrechen" in der
 * Duplikat-Rueckfrage. Eine Datenbankzeile gibt es zu diesem Zeitpunkt noch
 * nicht, nur die Datei im Cache und den Text im Suchpuffer.
 */
export async function discardImport(document: StoredDocument): Promise<void> {
  forgetDocumentText(document.id);
  if (document.cacheKey !== null) await deleteDocument(document.cacheKey);
}
