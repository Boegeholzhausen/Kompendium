/**
 * Farb-Tokens aus dem Handoff-Dokument (README.md, Abschnitt "Design Tokens").
 *
 * Diese Datei ist die einzige Stelle im Projekt, an der Hex-Werte stehen duerfen.
 * Komponenten importieren ausschliesslich die hier benannten Tokens.
 * Dark Mode ist der einzige Modus.
 */

/** Flaechen — vier Stufen, aufsteigend. Tiefe entsteht aus Stufe + 1 px border/subtle. */
export const bg = {
  /** App-Hintergrund */
  base: '#0E1012',
  /** Karten, Listenzeilen, Tab-Bar */
  surface: '#15181B',
  /** Angehobene Karten, Eingabefelder, Chips */
  raised: '#1C2024',
  /** Bottom-Sheets, Menues, Dialoge */
  overlay: '#23282D',
} as const;

/** Linien */
export const border = {
  subtle: '#262C31',
  strong: '#343B41',
} as const;

/** Text */
export const text = {
  /** Titel, Fliesstext */
  primary: '#E8EDF0',
  /** Metadaten, Beschreibungen */
  secondary: '#98A3AC',
  /** Platzhalter, deaktiviert */
  tertiary: '#6E7A83',
} as const;

/** Akzent — Mint. Sparsam: pro Screen genau eine primaere Aktion. */
export const accent = {
  base: '#34D399',
  pressed: '#2BBA85',
  surface: 'rgba(52,211,153,0.12)',
  border: 'rgba(52,211,153,0.28)',
  /** Text auf gefuelltem Mint */
  on: '#06120D',
} as const;

/** Semantik */
export const semantic = {
  danger: '#F87171',
  warning: '#FBBF24',
  info: '#60A5FA',
} as const;

/** Semantische Flaechen — 14 % derselben Farbe (README: Sync-Fehler-Streifen, Wisch-Aktion "Loeschen"). */
export const semanticSurface = {
  danger: 'rgba(248,113,113,0.14)',
  warning: 'rgba(251,191,36,0.14)',
  info: 'rgba(96,165,250,0.14)',
} as const;

/** Tag-Palette — acht Farben. Darstellung immer 12-%-Flaeche + vollfarbiger Text + 6x6-Punkt. */
export const tagPalette = {
  mint: '#34D399',
  sky: '#60A5FA',
  violet: '#A78BFA',
  rose: '#FB7185',
  amber: '#FBBF24',
  teal: '#2DD4BF',
  lime: '#A3E635',
  slate: '#94A3B8',
} as const;

export type TagColorName = keyof typeof tagPalette;
export const tagColorNames = Object.keys(tagPalette) as TagColorName[];

/**
 * Ordnerfarben — sechs statt acht (README 17): mehr Auswahl macht Ordner nicht
 * unterscheidbarer, und in dieser Zahl bleiben die Auswahlkacheln 48 dp breit.
 */
export const folderColorNames = ['mint', 'sky', 'violet', 'rose', 'amber', 'teal'] as const;
export type FolderColorName = (typeof folderColorNames)[number];

/** Ueberlagerungen und Blur-Flaechen (README: Sheets, Viewer-Chrome, Dokumente abdunkeln). */
export const overlay = {
  /** Scrim unter Bottom-Sheets und Kontextmenue */
  scrim: 'rgba(0,0,0,0.55)',
  /** Viewer-Kopfzeile: bg/base mit 72 % Deckkraft + Blur 14 */
  viewerHeader: 'rgba(14,16,18,0.72)',
  /** Trennlinie unter der Viewer-Kopfzeile: border/subtle mit 80 % Deckkraft */
  viewerHeaderBorder: 'rgba(38,44,49,0.8)',
  /** Schwebender Aktionsbalken: bg/overlay mit 92 % Deckkraft + Blur 14 */
  viewerActionBar: 'rgba(35,40,45,0.92)',
  /** "Dokumente abdunkeln" — Overlay ueber der WebView, keine Farbinvertierung */
  dimDocument: 'rgba(0,0,0,0.18)',
  /** Griffbalken der Gestensteuerung auf hellem Dokument (reiner Lesemodus) */
  gestureBarOnLight: 'rgba(26,26,26,0.35)',
} as const;

/**
 * Beispielinhalt — NICHT Teil des Designsystems.
 * Nur fuer die Papier-Vorschau des Textgroessen-Reglers (README 16).
 */
export const sampleDocument = {
  paper: '#F6F5F1',
  ink: '#1A1A1A',
  accent: '#9A7B2F',
} as const;

/** Blur-Intensitaet fuer expo-blur (Viewer-Chrome). */
export const blurIntensity = 14;

/**
 * Erzeugt aus einem Hex-Token eine transparente Variante.
 * Verwendung: Tag-Flaechen (0.12), Auswahlrand einer Ordnerfarbe (0.5).
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Flaeche eines Tag-Chips: 12 % der Tag-Farbe. */
export function tagSurface(color: string): string {
  return withAlpha(color, 0.12);
}

export const colors = {
  bg,
  border,
  text,
  accent,
  semantic,
  semanticSurface,
  tagPalette,
  overlay,
  sampleDocument,
} as const;
