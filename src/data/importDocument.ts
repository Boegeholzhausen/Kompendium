/**
 * Import — die drei Wege aus Blatt `3g`, jetzt mit Wirkung.
 *
 * Datei waehlen · Aus Zwischenablage · Von URL laden. Alle drei enden an
 * derselben Stelle: HTML in den lokalen Dateicache legen, Titel und
 * Dokumenttyp einmal erkennen, Zeile anlegen. "Importierte Dokumente landen in
 * „Neu", bis sie einsortiert sind" — das steht in der Fussnote des Sheets und
 * heisst hier schlicht `folderName: null`.
 *
 * Titel- und Typerkennung stehen seit dem Weg vom PC in `detect.ts` — dasselbe
 * Dokument muss dieselbe Kachel bekommen, gleich ob es hier oder ueber
 * `scripts/upload.mjs` in die Bibliothek kommt.
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
 */
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import type { DocType } from '../theme/tile';
import { deleteDocument, writeDocument } from './cache';
import { detectDocType, detectTitle } from './detect';
import type { DocumentSource, StoredDocument } from './library';
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

/** Sieht das ueberhaupt nach HTML aus? */
function looksLikeHtml(html: string): boolean {
  return /<[a-z!][\s\S]*>/i.test(html);
}

/**
 * Die Kennung eines importierten Dokuments — eine UUID.
 *
 * Sie ist dieselbe wie oben in Supabase (`public.documents.id` ist vom Typ
 * `uuid`). Eine eigene lokale Kennung mit einer Zuordnungstabelle daneben
 * waere eine zweite Wahrheit ueber dieselbe Zeile, und die frueheren
 * `doc-import-…`-Kennungen konnten aus genau diesem Grund nie hochgehen.
 *
 * `cache_key` bleibt davon unberuehrt: wo die Datei auf dem Geraet liegt, ist
 * eine Frage dieses Geraets und keine des Ausweises.
 */
function newId(): string {
  return Crypto.randomUUID();
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
      favorite: false,
      cached: true,
      sizeBytes,
      updatedAt: at,
      importedAt: at,
      openCount: 0,
      // Importieren ist kein Oeffnen: die Zeile steht in der Bibliothek, auf
      // dem Bildschirm war das Dokument noch nicht. Aus demselben Grund ist
      // ein frisch importiertes Dokument ungelesen und nicht archiviert.
      lastOpenedAt: null,
      readAt: null,
      archivedAt: null,
      note: '',
      keepOffline: false,
      trashedAt: null,
      source: input.source,
      cacheKey: id,
      // Der Import legt die Datei zuerst auf dem Geraet ab. Nach oben bringt
      // sie der Abgleich; bis dahin gibt es keinen Ablageort und keine
      // Pruefsumme, die von dort stammt.
      storagePath: null,
      contentHash: null,
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
 * Wie viel HTML von einer Adresse hoechstens angenommen wird.
 *
 * Ein selbstgebautes Dokument ist ein paar hundert Kilobyte gross; 8 MB sind
 * dafuer reichlich Luft. Die Grenze steht hier, weil `response.text()` alles
 * am Stueck in den Arbeitsspeicher liest — eine Adresse, hinter der ein
 * Datentraegerabbild liegt, beendete die App sonst durch das System, und zwar
 * bevor `looksLikeHtml` ueberhaupt hinsieht.
 */
const MAX_URL_BYTES = 8 * 1024 * 1024;

/** Wie lange auf eine Antwort gewartet wird, bevor der Versuch abgebrochen wird. */
const URL_TIMEOUT_MS = 30_000;

/**
 * Weg 3 — "Von URL laden · Adresse eingeben".
 *
 * Ohne Schema wird `https` ergaenzt: wer eine Adresse eintippt, schreibt sie
 * selten vollstaendig, und `http` waere die schlechtere Vermutung.
 *
 * Drei Grenzen, die eine fremde Adresse nicht ueberschreiten darf: Zeit,
 * Groesse und Art des Inhalts. Ohne sie haengt das Sheet an einer Adresse, die
 * nie antwortet, oder liest ein Vielfaches des verfuegbaren Speichers ein.
 */
export async function importFromUrl(
  address: string,
  existing: StoredDocument[] = []
): Promise<ImportOutcome> {
  const trimmed = address.trim();
  if (!trimmed) return { ok: false, reason: null };

  const url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), URL_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) {
      return { ok: false, reason: `Die Adresse antwortete mit ${response.status}.` };
    }

    // Der Typ zuerst: ein PDF oder ein Bild waere hier kein Dokument, sondern
    // Zeichensalat mit ein paar spitzen Klammern darin. Fehlt die Angabe, wird
    // weitergemacht — `looksLikeHtml` faengt den Rest.
    const type = response.headers.get('content-type');
    if (type !== null && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(type)) {
      return { ok: false, reason: 'Unter der Adresse liegt kein HTML.' };
    }

    // Die angekuendigte Groesse, sofern der Server sie nennt. Sie ist eine
    // Behauptung und keine Zusage — deshalb wird unten noch einmal gemessen,
    // wenn der Text da ist.
    const announced = Number(response.headers.get('content-length') ?? '');
    if (Number.isFinite(announced) && announced > MAX_URL_BYTES) {
      return { ok: false, reason: 'Die Datei ist zu gross für die Bibliothek.' };
    }

    const html = await response.text();
    if (html.length > MAX_URL_BYTES) {
      return { ok: false, reason: 'Die Datei ist zu gross für die Bibliothek.' };
    }

    return documentFrom({ html, hint: url, source: 'url' }, existing);
  } catch (error: unknown) {
    // Der Abbruch nach 30 Sekunden ist kein Netzfehler und verdient einen
    // eigenen Satz: er sagt dem Nutzer, dass es an der Adresse liegt und nicht
    // an seiner Verbindung.
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      reason: aborted ? 'Die Adresse hat nicht geantwortet.' : 'Die Adresse war nicht erreichbar.',
    };
  } finally {
    clearTimeout(timer);
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
