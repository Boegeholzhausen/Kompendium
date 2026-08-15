/**
 * Formate fuer Metazeilen.
 *
 * Die Dokumentzeile traegt "vor 3 Tagen · 240 KB" (Komponenten-Inventar 1),
 * die Karte in der Sektion "Neu" dasselbe Format. Alle Zahlen werden mit
 * Tabellenziffern gesetzt (`<Text numeric>`), damit beim Aktualisieren nichts
 * springt.
 *
 * Bewusst von Hand statt ueber Intl: die Ausgabe muss auf jedem Geraet und in
 * jeder Hermes-Variante identisch sein, und es geht nur um sechs Faelle.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

function plural(count: number, one: string, many: string): string {
  return `vor ${count} ${count === 1 ? one : many}`;
}

/**
 * Relative Zeitangabe in Alltagssprache.
 * Unter einer Minute steht "gerade eben" — eine Zahl waere dort nur Rauschen.
 */
export function formatRelative(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp);

  if (diff < MINUTE) return 'gerade eben';
  if (diff < HOUR) return plural(Math.floor(diff / MINUTE), 'Minute', 'Minuten');
  if (diff < DAY) return plural(Math.floor(diff / HOUR), 'Stunde', 'Stunden');
  if (diff < WEEK) return plural(Math.floor(diff / DAY), 'Tag', 'Tagen');
  if (diff < MONTH) return plural(Math.floor(diff / WEEK), 'Woche', 'Wochen');
  if (diff < YEAR) return plural(Math.floor(diff / MONTH), 'Monat', 'Monaten');
  return plural(Math.floor(diff / YEAR), 'Jahr', 'Jahren');
}

/** Deutsches Dezimalkomma. */
function withComma(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

/**
 * Dateigroesse. Unter einem Megabyte ohne Nachkommastelle — "240 KB" ist
 * genauso brauchbar wie "240,3 KB" und bleibt in der Zeile schmal.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${withComma(mb)} MB`;

  return `${withComma(mb / 1024)} GB`;
}

/** Die vollstaendige Metazeile der Dokumentzeile und der Karte. */
export function formatDocumentMeta(updatedAt: number, sizeBytes: number, now?: number): string {
  return `${formatRelative(updatedAt, now)} · ${formatBytes(sizeBytes)}`;
}

/**
 * Restfrist im Papierkorb (Blatt `6a`). Angebrochene Tage zaehlen mit: wer
 * "1 Tag übrig" liest, hat noch heute Zeit — "0 Tage übrig" waere eine
 * Falschauskunft, solange das Dokument noch dasteht.
 */
export function trashDaysLeft(trashedAt: number, days: number, now: number = Date.now()): number {
  const elapsed = Math.max(0, now - trashedAt);
  return Math.max(0, days - Math.floor(elapsed / DAY));
}

/** Metazeile im Papierkorb: "gelöscht vor 2 Tagen · 28 Tage übrig". */
export function formatTrashMeta(trashedAt: number, days: number, now?: number): string {
  const left = trashDaysLeft(trashedAt, days, now);
  const rest = left === 1 ? '1 Tag übrig' : `${left} Tage übrig`;
  return `gelöscht ${formatRelative(trashedAt, now)} · ${rest}`;
}

/** Uhrzeit ohne Datum — die Sync-Statuszeile nennt "zuletzt 21:44". */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Tagesdatum fuer die Metadaten im Info-Sheet ("Importiert am"). */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}
