/**
 * Suchlauf ueber den Bestand (Blatt `3d`).
 *
 * Gesucht wird in Titel, Ordnername, Tag-Namen und im Text des Dokuments.
 * Woher der Text kommt, entscheidet die Herkunft des Dokuments: importierte
 * Dokumente haben eine Datei im Cache, die Erstbefuellung hat ihren erzeugten
 * Beispielinhalt. Beides landet in derselben Textablage, und die Suche selbst
 * kennt den Unterschied nicht.
 *
 * Die Ablage ist bewusst synchron: die Suche laeuft bei jedem Tastendruck ueber
 * den ganzen Bestand, und ein `await` je Dokument waere dort nicht einholbar.
 * Gefuellt wird sie einmal nach dem Start (`warmSearchIndex`) und bei jedem
 * Import.
 *
 * Der Treffer traegt zwei Fundstellen: eine im Titel (falls der Begriff dort
 * steht) und eine im Textausschnitt. Beide werden mint hinterlegt, weil auf
 * dunklem Grund reine Textfarbe im Fliesstext schwer zu finden ist.
 *
 * Sortiert wird nach Relevanz, nicht nach Datum: Titeltreffer stehen vor
 * Tag- und Ordnertreffern, diese vor reinen Texttreffern; bei Gleichstand
 * entscheidet das juengere Datum. Der Sektionskopf nennt "Relevanz" rechts.
 */
import { readDocument } from './cache';
import { plainText } from './plainText';
import type { LibraryTag, StoredDocument } from './library';
import { sampleDocumentText } from './sampleDocumentHtml';
import { periodDays, type SearchFilters } from '../state/search';

/** Eine hervorzuhebende Stelle: Anfang und Laenge im jeweiligen Text. */
export interface Highlight {
  start: number;
  length: number;
}

export interface SearchResult {
  document: StoredDocument;
  title: string;
  folderName: string | null;
  /** Zweizeiliger Textausschnitt mit Auslassungszeichen an den Raendern. */
  snippet: string;
  snippetHit: Highlight | null;
  titleHit: Highlight | null;
}

const DAY = 24 * 60 * 60 * 1000;

/** Zeichen links und rechts der Fundstelle — zwei Zeilen `body-sm` fassen etwa so viel. */
const SNIPPET_BEFORE = 34;
const SNIPPET_AFTER = 76;

const textCache = new Map<string, string>();

/** Text eines importierten Dokuments ablegen — beim Import und beim Warmlauf. */
export function indexDocumentText(documentId: string, html: string): void {
  textCache.set(documentId, plainText(html));
}

/**
 * Liest die Dateien der importierten Dokumente einmal ein, damit die Suche
 * auch ihren Inhalt findet. Dokumente der Erstbefuellung haben keine Datei —
 * ihr Text entsteht weiter aus `sampleDocumentHtml`.
 */
export async function warmSearchIndex(documents: StoredDocument[]): Promise<void> {
  for (const document of documents) {
    if (document.cacheKey === null || textCache.has(document.id)) continue;
    try {
      const html = await readDocument(document.cacheKey);
      if (html !== null) indexDocumentText(document.id, html);
    } catch {
      // Eine unlesbare Datei kostet den Textteil dieses einen Treffers, nicht
      // die Suche. Titel, Ordner und Tags finden das Dokument weiterhin.
    }
  }
}

/**
 * Der Volltext eines Dokuments. Gepuffert, weil die Suche bei jedem Tastendruck
 * ueber den ganzen Bestand laeuft und der Text sich nicht aendert.
 */
function textOf(document: StoredDocument): string {
  const indexed = textCache.get(document.id);
  if (indexed !== undefined) return indexed;

  // Kein Eintrag und keine Datei: die Erstbefuellung. Ihr Text wird erzeugt
  // und danach genauso gepuffert.
  const text =
    document.cacheKey === null
      ? sampleDocumentText({
          id: document.id,
          title: document.title,
          docType: document.docType,
          folderName: document.folderName,
        })
      : '';
  textCache.set(document.id, text);
  return text;
}

function find(haystack: string, needle: string): Highlight | null {
  const at = haystack.toLowerCase().indexOf(needle);
  return at === -1 ? null : { start: at, length: needle.length };
}

/**
 * Schneidet den Ausschnitt um die Fundstelle heraus und rueckt die Fundstelle
 * mit. Ohne Fundstelle steht der Anfang des Textes da — der Treffer kam dann
 * aus Titel, Ordner oder Tag, und der Anfang sagt am meisten ueber das
 * Dokument aus.
 */
function snippetFor(text: string, hit: Highlight | null): { snippet: string; hit: Highlight | null } {
  if (hit === null) {
    const cut = text.slice(0, SNIPPET_BEFORE + SNIPPET_AFTER);
    return { snippet: cut.length < text.length ? `${cut.trimEnd()} …` : cut, hit: null };
  }

  const from = Math.max(0, hit.start - SNIPPET_BEFORE);
  const to = Math.min(text.length, hit.start + hit.length + SNIPPET_AFTER);
  const head = from > 0 ? '… ' : '';
  const tail = to < text.length ? ' …' : '';

  return {
    snippet: `${head}${text.slice(from, to)}${tail}`,
    hit: { start: hit.start - from + head.length, length: hit.length },
  };
}

export interface SearchInput {
  query: string;
  filters: SearchFilters;
  /** Der Bestand aus der Datenbank — Titel, Ordner und Tags stehen in der Zeile. */
  documents: StoredDocument[];
  tags: LibraryTag[];
  /** Bezugspunkt des Zeitraum-Filters; als Parameter, damit das Ergebnis pruefbar bleibt. */
  now?: number;
}

/**
 * Wendet nur die Filter an — die Leerdarstellung braucht die Trefferzahl
 * OHNE Filter, um die Ursache benennen zu koennen ("Ohne Ordner- und
 * Zeitfilter gibt es 7 Treffer").
 */
function passesFilters(document: StoredDocument, input: SearchInput, now: number): boolean {
  const { filters } = input;

  if (document.trashedAt !== null) return false;

  if (filters.folderName !== null && document.folderName !== filters.folderName) return false;

  if (filters.tagIds.length > 0) {
    if (!filters.tagIds.every((id) => document.tagIds.includes(id))) return false;
  }

  if (filters.period !== null) {
    if (now - document.updatedAt > periodDays[filters.period] * DAY) return false;
  }

  return true;
}

function matchOne(
  document: StoredDocument,
  input: SearchInput,
  needle: string
): SearchResult | null {
  const { title, folderName } = document;

  const titleHit = find(title, needle);
  const folderHit = folderName !== null && folderName.toLowerCase().includes(needle);
  const tagHit = document.tagIds.some((id) => {
    const tag = input.tags.find((entry) => entry.id === id);
    return tag !== undefined && tag.name.toLowerCase().includes(needle);
  });

  const text = textOf(document);
  const textHit = find(text, needle);

  if (titleHit === null && !folderHit && !tagHit && textHit === null) return null;

  const { snippet, hit } = snippetFor(text, textHit);
  return { document, title, folderName, snippet, snippetHit: hit, titleHit };
}

/** Titeltreffer wiegen am schwersten, dann Tag oder Ordner, dann reiner Text. */
function rank(result: SearchResult): number {
  if (result.titleHit !== null) return 0;
  if (result.snippetHit === null) return 1;
  return 2;
}

export function searchDocuments(input: SearchInput): SearchResult[] {
  const needle = input.query.trim().toLowerCase();
  if (!needle) return [];

  const now = input.now ?? Date.now();
  const results: SearchResult[] = [];

  for (const document of input.documents) {
    if (!passesFilters(document, input, now)) continue;
    const result = matchOne(document, input, needle);
    if (result !== null) results.push(result);
  }

  results.sort((a, b) => {
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return b.document.updatedAt - a.document.updatedAt;
  });

  return results;
}

/** Trefferzahl ohne jeden Filter — Grundlage des Satzes in der Leerdarstellung. */
export function countWithoutFilters(input: SearchInput): number {
  const needle = input.query.trim().toLowerCase();
  if (!needle) return 0;

  let count = 0;
  for (const document of input.documents) {
    if (document.trashedAt !== null) continue;
    if (matchOne(document, input, needle) !== null) count += 1;
  }
  return count;
}
