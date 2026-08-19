/**
 * Was in einem HTML-Dokument steht: Titel und Dokumenttyp.
 *
 * Die Regeln standen bis hierher in `importDocument.ts`, weil es dort den
 * einzigen Leser gab. Seit es den Weg vom PC gibt (`scripts/upload.mjs`), gibt
 * es einen zweiten — und beide muessen sich einig sein: eine Datei, die am PC
 * hochgeladen wird, muss dieselbe Kachel bekommen wie dieselbe Datei, die am
 * Handy importiert wird. Zwei Kopien derselben Regel waeren genau der Fehler,
 * der erst auffaellt, wenn eine Kachel in der Bibliothek springt.
 *
 * Deshalb liegt hier nichts als Textarbeit: kein `expo-`, kein React, keine
 * Datenbank. Node laedt diese Datei direkt (Type-Stripping ab Node 22), die
 * App importiert sie wie jedes andere Modul.
 */
import { plainText } from './plainText.ts';
import type { DocType } from '../theme/tile';

function count(html: string, pattern: RegExp): number {
  return html.match(pattern)?.length ?? 0;
}

/**
 * Der Dokumenttyp aus dem Inhalt.
 *
 * Die Reihenfolge der Pruefungen ist die Entscheidung: ein Rechner enthaelt
 * fast immer auch eine Tabelle, ein Report fast immer eine Liste. Gewinnen
 * darf deshalb nicht "was zuerst vorkommt", sondern was am meisten ueber das
 * Dokument aussagt — Eingabefelder sind das staerkste Zeichen, Fliesstext das
 * schwaechste.
 *
 * Erkannt wird ueber Zaehlung, nicht ueber einen HTML-Parser: React Native hat
 * kein DOM, und fuer fuenf Formen genuegt es, die Auszeichnungen zu zaehlen.
 * Ein fehlerhaftes Dokument fuehrt so hoechstens zur falschen Kachel, nie zu
 * einem Absturz.
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

/**
 * Die Kurzbeschreibung, wenn das Dokument eine mitbringt.
 *
 * Nur `<meta name="description">` — eine erfundene Beschreibung aus dem ersten
 * Absatz waere schlechter als keine: der Vorschautext leistet das bereits, und
 * zwei fast gleiche Texte untereinander lesen sich wie ein Fehler.
 */
export function detectDescription(html: string): string | null {
  const tag = /<meta[^>]+name=["']description["'][^>]*>/i.exec(html);
  if (tag === null) return null;
  const content = /content=["']([\s\S]*?)["']/i.exec(tag[0]);
  const text = content ? plainText(content[1]) : '';
  return text || null;
}

/** Wie viel Klartext als Vorschau mitgeht — genug fuer die Suche, nicht mehr. */
export const PREVIEW_LENGTH = 1200;

/** Die ersten Zeichen Klartext; Grundlage der serverseitigen Volltextsuche. */
export function previewText(html: string): string {
  return plainText(html).slice(0, PREVIEW_LENGTH);
}
