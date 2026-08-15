/**
 * Theme-Modul — einzige Quelle fuer Farben, Typografie, Raster und Bewegung.
 *
 * Regel aus dem Handoff-Dokument: keine freihaendigen Hex-Codes in Komponenten.
 * `npm run lint:tokens` prueft das.
 */
export * from './colors';
export * from './typography';
export * from './layout';
export * from './motion';
export * from './tile';

import * as colorTokens from './colors';
import { typeScale, fontFamily, tabularNums } from './typography';
import { space, radius, iconSize, size, floatingShadow, hairline, focusRing } from './layout';

export const theme = {
  bg: colorTokens.bg,
  border: colorTokens.border,
  text: colorTokens.text,
  accent: colorTokens.accent,
  semantic: colorTokens.semantic,
  semanticSurface: colorTokens.semanticSurface,
  tagPalette: colorTokens.tagPalette,
  overlay: colorTokens.overlay,
  type: typeScale,
  fontFamily,
  tabularNums,
  space,
  radius,
  iconSize,
  size,
  floatingShadow,
  hairline,
  focusRing,
} as const;

export type Theme = typeof theme;
