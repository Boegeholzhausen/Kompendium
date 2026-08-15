/**
 * Text mit Varianten aus der Typo-Skala.
 *
 * `variant` waehlt Groesse, Zeilenhoehe, Schnitt und Tracking; `tone` waehlt die
 * Textfarbe. Beides sind Tokens — direkte fontSize- oder color-Angaben sind in
 * Komponenten nicht vorgesehen.
 *
 * `numeric` schaltet Tabellenziffern ein: Pflicht fuer alle Zahlen in Listen
 * (Dateigroessen, Anzahlen, Daten, Prozente, Restfristen).
 */
import React from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { accent, semantic, text as textColor } from '../theme/colors';
import { tabularNums, typeScale, type TypeVariant } from '../theme/typography';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'onAccent'
  | 'danger'
  | 'warning'
  | 'info';

const toneColor: Record<TextTone, string> = {
  primary: textColor.primary,
  secondary: textColor.secondary,
  tertiary: textColor.tertiary,
  accent: accent.base,
  onAccent: accent.on,
  danger: semantic.danger,
  warning: semantic.warning,
  info: semantic.info,
};

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Tabellenziffern — fuer jede Zahl, die sich aendern kann. */
  numeric?: boolean;
}

export function Text({
  variant = 'body',
  tone = 'primary',
  numeric = false,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      // Systemweite Schriftvergroesserung bis Faktor 1.3 zulassen; darueber
      // brechen die festen Zeilenhoehen der Skala.
      maxFontSizeMultiplier={1.3}
      style={StyleSheet.flatten([
        typeScale[variant],
        { color: toneColor[tone] },
        numeric && tabularNums,
        style,
      ])}
    />
  );
}

/** Kurzform fuer Zahlen — identisch zu <Text numeric />. */
export function NumText(props: TextProps) {
  return <Text {...props} numeric />;
}
