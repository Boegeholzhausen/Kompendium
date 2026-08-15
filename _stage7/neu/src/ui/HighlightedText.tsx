/**
 * Text mit hervorgehobener Fundstelle.
 *
 * Regel aus dem Handoff-Dokument (Screen 9): Fundstellen sind **mint
 * hinterlegt** (`accent/surface`, `radius xs`, Innenabstand 3) und mint
 * gefaerbt — auf dunklem Grund ist reine Textfarbe im Fliesstext schwer zu
 * finden, deshalb Flaeche UND Farbe.
 *
 * Ohne Fundstelle bleibt der Text unveraendert; die Komponente ist damit
 * gefahrlos ueberall dort einsetzbar, wo eine Suche im Spiel sein kann.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { accent, radius, space } from '../theme';
import { Text, type TextProps } from './Text';

export interface Hit {
  start: number;
  length: number;
}

export interface HighlightedTextProps extends TextProps {
  text: string;
  hit: Hit | null;
}

export function HighlightedText({ text, hit, ...rest }: HighlightedTextProps) {
  if (hit === null || hit.start < 0 || hit.start + hit.length > text.length) {
    return <Text {...rest}>{text}</Text>;
  }

  return (
    <Text {...rest}>
      {text.slice(0, hit.start)}
      {/*
        Der innere Text erbt nur die Variante, nicht die uebrigen Angaben des
        aeusseren. Vor allem nicht `numberOfLines`: das macht aus dem
        eingebetteten Stueck einen eigenen Block, der im Web-Export die ganze
        Zeile fuellt und den Rest des Satzes umbricht.
      */}
      <Text variant={rest.variant} tone="accent" style={styles.hit}>
        {text.slice(hit.start, hit.start + hit.length)}
      </Text>
      {text.slice(hit.start + hit.length)}
    </Text>
  );
}

const styles = StyleSheet.create({
  hit: {
    backgroundColor: accent.surface,
    borderRadius: radius.xs,
    // 3 Innenabstand aus dem Handoff-Dokument; als Summe zweier Tokens, weil
    // die Skala 3 nicht kennt.
    paddingHorizontal: space['2'],
  },
});
