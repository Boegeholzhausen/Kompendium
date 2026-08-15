/**
 * 04 · Tag-Chip.
 *
 * Hoehe 28 (32 im Sheet), `radius pill`, Flaeche 12 % der Tag-Farbe, Punkt
 * 6 x 6 + Name `label` in derselben Farbe. Die entfernbare Variante traegt ein
 * `x` 14 rechts — ohne sie haette das Zuweisen im Info-Sheet keinen sichtbaren
 * Rueckweg.
 *
 * Deaktiviert: `bg/raised`, Punkt `border/strong`, Text `text/tertiary` —
 * ein Farbwechsel, keine Deckkraft.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { bg, border, radius, size, space, tagSurface, text as textColor } from '../theme';
import { Plus, X } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface TagChipProps {
  label: string;
  /** Farbe aus der Tag-Palette. */
  color: string;
  /** Im Sheet sind die Chips 32 hoch, in Listen 28. */
  large?: boolean;
  disabled?: boolean;
  /** Zeigt das `x`; die ganze Flaeche loest dann `onRemove` aus. */
  removable?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function TagChip({
  label,
  color,
  large = false,
  disabled = false,
  removable = false,
  onPress,
  onRemove,
  style,
}: TagChipProps) {
  const surface = disabled ? bg.raised : tagSurface(color);
  const dotColor = disabled ? border.strong : color;
  const textColorValue = disabled ? textColor.tertiary : color;

  return (
    <PressableScale
      style={[
        styles.chip,
        { height: large ? size.tagChipHeightSheet : size.tagChipHeight, backgroundColor: surface },
        style,
      ]}
      disabled={disabled || (!onPress && !onRemove)}
      onPress={removable ? onRemove : onPress}
      accessibilityRole="button"
      accessibilityLabel={removable ? `Tag ${label} entfernen` : `Tag ${label}`}
      accessibilityState={{ disabled }}
      // 28 (bzw. 32) hoch; hitSlop bringt das Ziel auf 48, ohne die Zeile zu dehnen.
      hitSlop={{
        top: (size.touchTarget - (large ? size.tagChipHeightSheet : size.tagChipHeight)) / 2,
        bottom: (size.touchTarget - (large ? size.tagChipHeightSheet : size.tagChipHeight)) / 2,
      }}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text variant="label" style={{ color: textColorValue }}>
        {label}
      </Text>
      {removable ? <X size={14} color={textColorValue} weight="regular" /> : null}
    </PressableScale>
  );
}

/**
 * "+ Tag" — der Chip, ueber den im Info-Sheet ein Tag zugewiesen wird.
 * Neutral gehalten: er fuehrt in eine Auswahl, ist also keine Aktion mit Gewicht.
 */
export function AddTagChip({
  onPress,
  large = false,
  style,
}: {
  onPress?: () => void;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      style={[
        styles.chip,
        styles.addChip,
        { height: large ? size.tagChipHeightSheet : size.tagChipHeight },
        style,
      ]}
      pressedStyle={styles.addChipPressed}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Tag hinzufuegen"
    >
      <Plus size={14} color={textColor.secondary} weight="regular" />
      <Text variant="label" tone="secondary">
        Tag
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'] + space['2'],
    paddingHorizontal: space['8'] + space['2'],
    borderRadius: radius.pill,
  },
  dot: {
    width: size.tagDot,
    height: size.tagDot,
    borderRadius: radius.pill,
  },
  addChip: {
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  addChipPressed: {
    backgroundColor: bg.overlay,
    borderColor: border.strong,
  },
});
