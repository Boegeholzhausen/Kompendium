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
 * ## Mehrere Begriffe
 *
 * Die Abfrage wird an Leerzeichen zerlegt; **alle** Begriffe muessen zutreffen
 * (UND), jeder fuer sich darf aber in Titel, Ordner, Tag ODER Text stehen.
 * "annuität rechner" findet damit ein Dokument, dessen Titel den einen und
 * dessen Text den anderen Begriff traegt. Ein Begriff in Anfuehrungszeichen
 * bleibt als Ganzes stehen ("kurzfristige verbindlichkeiten").
 *
 * ## Umlaute — welche Faltung, und warum diese
 *
 * Zur Wahl standen zwei Wege, die oft in einem Atemzug genannt werden, aber
 * verschiedene Dinge tun:
 *
 *   Akzent-Entfernung   ä→a, ö→o, ü→u (NFD-Zerlegung, Kombinationszeichen
 *                       weg). "annuitat" findet "Annuität", "Muller" findet
 *                       "Müller".
 *   deutsche Umschrift  ä→ae, ö→oe, ü→ue. "Mueller" findet "Müller" — aber
 *                       "Annuität" wird zu "annuitaet", und genau die beiden
 *                       Faelle oben gehen dabei verloren.
 *
 * **Verbindlich gewaehlt ist die Akzent-Entfernung** (plus ß→ss, das keine
 * Akzentfrage ist, sondern eine eigene Buchstabenform). Sie loest die Faelle,
 * derentwegen es die Faltung ueberhaupt gibt: getippt wird die Umlautlose
 * Form, weil der Umlaut auf der Tastatur einen Umweg kostet — nicht die
 * ae-Umschrift, die man schreibt, wenn man gar keinen Umlaut zur Verfuegung
 * hat. "Mueller" findet "Müller" folglich nicht; das ist der bewusst in Kauf
 * genommene Preis.
 *
 * ## Fundstellen trotz Faltung
 *
 * Gesucht wird in der gefalteten Fassung, hervorgehoben wird im **Original**.
 * Weil ß→ss die Laenge verschiebt, ist die Faltung nicht laengentreu — statt
 * die Umschrift auf eine Suchvorstufe zu beschraenken, fuehrt `fold()` deshalb
 * eine zeichenweise Abbildung mit: `map[i]` nennt zu jedem Zeichen der
 * gefalteten Fassung seinen Ursprung im Originaltext. Die Fundstelle wird
 * darueber zurueckgerechnet und liegt damit auch dann richtig, wenn davor ein
 * ß oder ein zerlegtes Zeichen steht.
 *
 * Der Textpuffer haelt beides — Originaltext und gefaltete Fassung samt
 * Abbildung —, damit nicht bei jedem Tastendruck der ganze Bestand neu
 * gefaltet wird.
 *
 * Der Treffer traegt zwei Fundstellen: eine im Titel (falls ein Begriff dort
 * steht) und eine im Textausschnitt. Beide werden mint hinterlegt, weil auf
 * dunklem Grund reine Textfarbe im Fliesstext schwer zu finden ist.
 *
 * Sortiert wird nach Relevanz, nicht nach Datum: Titeltreffer stehen vor
 * Tag- und Ordnertreffern, diese vor reinen Texttreffern; bei mehreren
 * Begriffen zaehlt der **beste** Rang, den ein Begriff erreicht. Bei
 * Gleichstand entscheidet das juengere Datum. Der Sektionskopf nennt
 * "Relevanz" rechts.
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
  /** Bester Rang ueber alle Begriffe: 0 Titel, 1 Tag/Ordner, 2 reiner Text. */
  rank: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Zeichen links und rechts der Fundstelle — zwei Zeilen `body-sm` fassen etwa so viel. */
const SNIPPET_BEFORE = 34;
const SNIPPET_AFTER = 76;

/** Gefaltete Fassung eines Textes samt Ursprung jedes Zeichens im Original. */
interface Folded {
  value: string;
  /** `map[i]` ist der Index im Originaltext, aus dem `value[i]` stammt. */
  map: number[];
}

/**
 * Ein Zeichen falten: kleinschreiben, ß aufloesen, danach die NFD-Zerlegung
 * ohne Kombinationszeichen. Ergebnis kann laenger (ß→ss) oder leer sein (ein
 * alleinstehendes Kombinationszeichen).
 */
function foldChar(character: string): string {
  const lower = character.toLowerCase();
  if (lower === 'ß') return 'ss';
  return lower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Text falten und dabei die Herkunft jedes Zeichens mitschreiben. */
function fold(value: string): Folded {
  let folded = '';
  const map: number[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const piece = foldChar(value[index]);
    for (let step = 0; step < piece.length; step += 1) {
      folded += piece[step];
      map.push(index);
    }
  }
  return { value: folded, map };
}

/**
 * Dieselbe Faltung ohne Abbildung — fuer die Abfrage und fuer Ordner- und
 * Tag-Namen, bei denen nichts hervorgehoben wird.
 */
export function normalize(value: string): string {
  let folded = '';
  for (const character of value) folded += foldChar(character);
  return folded;
}

const textCache = new Map<string, string>();
const foldedCache = new Map<string, Folded>();

/** Text eines importierten Dokuments ablegen — beim Import und beim Warmlauf. */
export function indexDocumentText(documentId: string, html: string): void {
  textCache.set(documentId, plainText(html));
  // Die gefaltete Fassung gehoert zum alten Text und waere sonst falsch.
  foldedCache.delete(documentId);
}

/**
 * Text wieder vergessen — fuer einen Import, den der Nutzer nach der
 * Duplikat-Rueckfrage doch nicht wollte: seine Datei ist dann weg, und ein
 * Eintrag im Puffer wuerde einen Treffer auf ein Dokument liefern, das es
 * nicht gibt.
 */
export function forgetDocumentText(documentId: string): void {
  textCache.delete(documentId);
  foldedCache.delete(documentId);
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

/** Gefaltete Fassung des Volltextes — einmal je Dokument, dann gepuffert. */
function foldedTextOf(document: StoredDocument): Folded {
  const cached = foldedCache.get(document.id);
  if (cached !== undefined) return cached;
  const folded = fold(textOf(document));
  foldedCache.set(document.id, folded);
  return folded;
}

/**
 * Fundstelle in der gefalteten Fassung suchen und auf den Originaltext
 * zurueckrechnen. `map` liefert zu Anfang und Ende des Fundes die
 * urspruenglichen Zeichen — deshalb stimmt die Hervorhebung auch hinter einem
 * ß, das in der Faltung zwei Zeichen belegt.
 */
function find(folded: Folded, needle: string): Highlight | null {
  if (needle === '') return null;
  const at = folded.value.indexOf(needle);
  if (at === -1) return null;

  const start = folded.map[at];
  const end = folded.map[at + needle.length - 1] + 1;
  return { start, length: end - start };
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

/** Ein Begriff der Abfrage: wie getippt (fuer Meldungen) und wie gesucht. */
export interface SearchTerm {
  raw: string;
  folded: string;
}

/**
 * Abfrage in Begriffe zerlegen. Leerzeichen trennen; was in Anfuehrungszeichen
 * steht, bleibt als ein Begriff stehen — sonst waere eine Wortgruppe wie
 * "kurzfristige verbindlichkeiten" nicht zu suchen.
 */
export function searchTerms(query: string): SearchTerm[] {
  const terms: SearchTerm[] = [];
  const pattern = /"([^"]*)"|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(query)) !== null) {
    const raw = (match[1] ?? match[2]).trim();
    const folded = normalize(raw);
    if (folded === '') continue;
    // Zweimal derselbe Begriff aendert nichts am Ergebnis, kostet aber einen
    // vollen Durchlauf durch den Bestand.
    if (terms.some((entry) => entry.folded === folded)) continue;
    terms.push({ raw, folded });
  }

  return terms;
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

/** Rang eines einzelnen Begriffs: 0 Titel, 1 Tag/Ordner, 2 Text, 3 kein Fund. */
const NO_MATCH = 3;

function matchAll(
  document: StoredDocument,
  input: SearchInput,
  terms: SearchTerm[]
): SearchResult | null {
  const { title, folderName } = document;

  const foldedTitle = fold(title);
  const foldedFolder = folderName === null ? '' : normalize(folderName);
  const foldedTags = document.tagIds.map((id) => {
    const tag = input.tags.find((entry) => entry.id === id);
    return tag === undefined ? '' : normalize(tag.name);
  });
  const foldedText = foldedTextOf(document);

  let bestRank = NO_MATCH;
  let titleHit: Highlight | null = null;
  let textHit: Highlight | null = null;

  for (const term of terms) {
    const inTitle = find(foldedTitle, term.folded);
    const inFolder = foldedFolder.includes(term.folded);
    const inTag = foldedTags.some((name) => name !== '' && name.includes(term.folded));
    const inText = find(foldedText, term.folded);

    // UND ueber die Begriffe: schon einer ohne Fund laesst das Dokument fallen.
    if (inTitle === null && !inFolder && !inTag && inText === null) return null;

    // Die erste Fundstelle je Ort bleibt stehen — hervorgehoben wird eine
    // Stelle, nicht alle; mehrere Kaesten in einer Zeile waeren Unruhe.
    if (titleHit === null && inTitle !== null) titleHit = inTitle;
    if (textHit === null && inText !== null) textHit = inText;

    const rank = inTitle !== null ? 0 : inFolder || inTag ? 1 : 2;
    if (rank < bestRank) bestRank = rank;
  }

  const { snippet, hit } = snippetFor(textOf(document), textHit);
  return { document, title, folderName, snippet, snippetHit: hit, titleHit, rank: bestRank };
}

export function searchDocuments(input: SearchInput): SearchResult[] {
  const terms = searchTerms(input.query);
  if (terms.length === 0) return [];

  const now = input.now ?? Date.now();
  const results: SearchResult[] = [];

  for (const document of input.documents) {
    if (!passesFilters(document, input, now)) continue;
    const result = matchAll(document, input, terms);
    if (result !== null) results.push(result);
  }

  results.sort((a, b) => {
    const byRank = a.rank - b.rank;
    if (byRank !== 0) return byRank;
    return b.document.updatedAt - a.document.updatedAt;
  });

  return results;
}

/** Trefferzahl ohne jeden Filter — Grundlage des Satzes in der Leerdarstellung. */
export function countWithoutFilters(input: SearchInput): number {
  const terms = searchTerms(input.query);
  if (terms.length === 0) return 0;

  let count = 0;
  for (const document of input.documents) {
    if (document.trashedAt !== null) continue;
    if (matchAll(document, input, terms) !== null) count += 1;
  }
  return count;
}

/**
 * Der ergiebigste **einzelne** Begriff einer mehrteiligen Abfrage.
 *
 * Ergibt die Kombination null Treffer, ist die Frage des Nutzers "welches
 * Wort war zu viel?" — die Leerdarstellung beantwortet sie mit einem Satz
 * ("„annuität" allein: 12 Treffer"). Die Filter bleiben dabei gesetzt: ihre
 * Wirkung nennt der Satz davor schon getrennt.
 */
export function bestSingleTerm(input: SearchInput): { term: string; count: number } | null {
  const terms = searchTerms(input.query);
  if (terms.length < 2) return null;

  const now = input.now ?? Date.now();
  let best: { term: string; count: number } | null = null;

  for (const term of terms) {
    let count = 0;
    for (const document of input.documents) {
      if (!passesFilters(document, input, now)) continue;
      if (matchAll(document, input, [term]) !== null) count += 1;
    }
    if (count > 0 && (best === null || count > best.count)) best = { term: term.raw, count };
  }

  return best;
}
