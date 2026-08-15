/**
 * Farblogik der generierten Kachel.
 *
 * Es gibt keine echten Thumbnails der HTML-Dokumente. Jedes Dokument bekommt
 * eine deterministisch erzeugte Kachel: Farbton aus der Dokument-ID, Muster aus
 * dem beim Import erkannten Dokumenttyp.
 *
 * Der Farbton wird NICHT gespeichert, sondern jedes Mal aus der ID gerechnet —
 * derselbe Ausweis ergibt immer dieselbe Farbe.
 */
import { text, withAlpha } from './colors';

export type DocType = 'table' | 'chart' | 'text' | 'calculator' | 'list';

export type TileState =
  /** Normale Darstellung */
  | 'default'
  /** Papierkorb: gedaempft — wiedererkennbar, aber sichtbar ausser Dienst */
  | 'trashed'
  /** Offline nicht geladen: entsaettigt, Muster unveraendert */
  | 'unavailable';

/**
 * Stabiler 32-Bit-Hash (FNV-1a) → Farbton 0–360.
 * Muss ueber Sitzungen und Geraete hinweg denselben Wert liefern, deshalb
 * keine eingebaute Hash-Funktion und keine Zufallsquelle.
 */
export function hueFromId(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    // FNV-Primzahl 16777619, in 32 Bit gehalten
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 360;
}

/**
 * Zwei Verlaufsstopps. Saettigung bleibt zwischen 8 % und 14 %, damit fuenfzehn
 * Kacheln nebeneinander eine ruhige Flaeche bleiben.
 */
export function tileGradient(id: string, state: TileState = 'default'): [string, string] {
  const hue = hueFromId(id);

  if (state === 'trashed') {
    return [`hsl(${hue} 9% 15%)`, `hsl(${hue} 6% 10%)`];
  }
  if (state === 'unavailable') {
    // Entsaettigt: gleiche Helligkeit, kein Farbton mehr.
    return [`hsl(${hue} 0% 19%)`, `hsl(${hue} 0% 10%)`];
  }
  return [`hsl(${hue} 13% 19%)`, `hsl(${hue} 9% 10%)`];
}

/**
 * Verlaufsrichtung 150 Grad, als Start- und Endpunkt in normierten Koordinaten.
 * Richtungsvektor (sin 150°, -cos 150°) = (0.5, 0.866), um die Mitte gelegt.
 */
export const tileGradientStart = { x: 0.25, y: 0.067 } as const;
export const tileGradientEnd = { x: 0.75, y: 0.933 } as const;

/**
 * Musterfarbe: immer text/primary mit niedriger Deckkraft — kein eigener Ton.
 * Im Papierkorb wird die Deckkraft halbiert (Untergrenze 0.10).
 */
export function patternColor(alpha: number, state: TileState = 'default'): string {
  const value = state === 'trashed' ? Math.max(0.1, Math.round(alpha * 50) / 100) : alpha;
  return withAlpha(text.primary, value);
}
