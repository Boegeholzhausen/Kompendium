/**
 * 07 · Sektionskopf.
 *
 * `overline` in `text/tertiary`; wahlweise mit Anzahl-Badge (Mint gefuellt,
 * Text `on-accent`, Hoehe 20, Mindestbreite 20) oder rechter Zahl in
 * `text/tertiary`, wahlweise mit "Alle anzeigen" als Mint-Textbutton.
 *
 * Die Sektion "Neu" faerbt ihre Ueberschrift mint (`tone="accent"`) — sie ist
 * der einzige Ort in der App, der Handlungsdruck erzeugen darf.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, radius, size, space } from '../theme';
import { TextButton } from './Button';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  /** Mint-Badge direkt hinter der Ueberschrift. */
  badge?: number;
  /** Zahl am rechten Rand, etwa die Gesamtzahl der Dokumente. */
  count?: number;
  /** Freier Text am rechten Rand, etwa "Relevanz". */
  hint?: string;
  /** Mint-Textbutton am rechten Rand. */
  actionLabel?: string;
  onAction?: () => void;
  accent?: boolean;
  /** Eigene Elemente rechts, etwa der Ansichtsumschalter im Ordner-Detail. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  badge,
  count,
  hint,
  actionLabel,
  onAction,
  accent: isAccent = false,
  right,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.left}>
        <Text variant="overline" tone={isAccent ? 'accent' : 'tertiary'}>
          {title}
        </Text>
        {badge !== undefined ? (
          <View style={styles.badge}>
            <Text variant="caption" tone="onAccent" numeric>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.right}>
        {count !== undefined ? (
          <Text variant="caption" tone="tertiary" numeric>
            {count}
          </Text>
        ) : null}
        {hint ? (
          <Text variant="caption" tone="tertiary">
            {hint}
          </Text>
        ) : null}
        {actionLabel ? <TextButton label={actionLabel} onPress={onAction} compact /> : null}
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: space['24'],
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
  },
  badge: {
    minWidth: space['20'],
    height: size.badgeHeight,
    paddingHorizontal: space['4'] + space['2'],
    borderRadius: radius.pill,
    backgroundColor: accent.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
