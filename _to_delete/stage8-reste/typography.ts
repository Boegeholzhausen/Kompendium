/**
 * Typografie — Inter. Skala aus dem Handoff-Dokument.
 * Tracking ist dort in em angegeben und hier bereits in dp umgerechnet
 * (React Native kennt nur absolute letterSpacing-Werte).
 */
import type { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export type TypeVariant =
  | 'display'
  | 'titleLg'
  | 'title'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'caption'
  | 'overline'
  /**
   * Zwei abgeleitete Stufen aus dem Komponenten-Inventar, keine eigenen
   * Stufen der Grundskala: Buttons tragen "title/600 16" (Komponente 10),
   * Textbuttons "label/600 13" (Komponente 12).
   */
  | 'button'
  | 'labelStrong'
  /**
   * 11 / 14 · 500 — die Beschriftungen unter den Icons des schwebenden
   * Aktionsbalkens im Viewer (Screen 5: "Icon 22 + Label 11/14"). Diese
   * Groesse gibt es sonst nur als `overline`, das aber Grossbuchstaben setzt.
   *
   * Die harte Regel "Metadaten nie unter 12 px" bleibt gewahrt: das sind
   * Bedienbeschriftungen, keine Metadaten — und sie stehen ueberhaupt nur da,
   * damit im Dunkeln niemand vier Symbole raten muss.
   */
  | 'labelSm';

type VariantStyle = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontFamily' | 'letterSpacing' | 'textTransform'
>;

export const typeScale: Record<TypeVariant, VariantStyle> = {
  /** 30 / 36 · 700 · -0.02em */
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: fontFamily.bold,
    letterSpacing: -0.6,
  },
  /** 22 / 28 · 600 · -0.01em */
  titleLg: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: fontFamily.semiBold,
    letterSpacing: -0.22,
  },
  /** 18 / 24 · 600 */
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0,
  },
  /** 16 / 24 · 400 — Fliesstext, nie kleiner */
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamily.regular,
    letterSpacing: 0,
  },
  /** 14 / 20 · 400 */
  bodySm: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.regular,
    letterSpacing: 0,
  },
  /** 13 / 18 · 500 */
  label: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.medium,
    letterSpacing: 0,
  },
  /** 12 / 16 · 500 · +0.01em — Metadaten, nie kleiner */
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fontFamily.medium,
    letterSpacing: 0.12,
  },
  /** 11 / 14 · 600 · +0.08em · Grossbuchstaben */
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
  },
  /** 16 / 24 · 600 — Beschriftung gefuellter und sekundaerer Buttons */
  button: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0,
  },
  /** 13 / 18 · 600 — Textbutton */
  labelStrong: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fontFamily.semiBold,
    letterSpacing: 0,
  },
  /** 11 / 14 · 500 — Beschriftung im schwebenden Aktionsbalken des Viewers */
  labelSm: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFamily.medium,
    letterSpacing: 0,
  },
};

/**
 * Beispielinhalt — NICHT Teil des Designsystems.
 *
 * Die Papier-Vorschau des Textgroessen-Reglers (Blatt `6b`) setzt Georgia
 * 17 / 27; der Regler multipliziert beides. Das gehoert zum gezeigten
 * Dokument, nicht zur App — genau wie die Farben unter `sampleDocument` in
 * `theme/colors.ts`. Die Werte stehen hier nur, weil ausserhalb des Themes
 * keine freien Schriftgroessen erlaubt sind.
 *
 * Als Funktion und nicht als Konstante, damit der Bildschirm die Multiplikation
 * nicht selbst schreiben muss — sonst staende dort wieder ein `fontSize`.
 */
export function sampleDocumentPreview(scale: number): TextStyle {
  return {
    fontFamily: 'Georgia',
    fontSize: 17 * scale,
    lineHeight: 27 * scale,
  };
}

/**
 * Tabellenziffern fuer alle Zahlen in Listen (Dateigroessen, Anzahlen, Daten,
 * Prozente, Restfristen) — damit beim Aktualisieren nichts springt.
 */
export const tabularNums: TextStyle = {
  fontVariant: ['tabular-nums'],
};
