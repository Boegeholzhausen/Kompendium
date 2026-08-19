/**
 * 05 · Filter-Chip.
 *
 * Hoehe 40 (36 im kollabierten Header), `radius pill`, Innenabstand 16.
 *   inaktiv    bg/raised + border/subtle + text/primary
 *   aktiv      accent/surface + accent/border + accent
 *   gedrueckt  bg/overlay + border/strong + Skalierung 0.97
 *
 * Varianten: mit Farbpunkt (Ordnerfarbe), mit fuehrendem Icon (Ungelesen,
 * mit `caret-down` (Auswahl-Chip in der Suche) und mit `x` (aktiver Filter,
 * der sich abwerfen laesst).
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, border, radius, size, space, text as textColor } from '../theme';
import { CaretDown, X, type Icon } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface FilterChipProps {
  label: string;
  active?: boolean;
  /** Im kollabierten Header sind die Chips 36 hoch. */
  compact?: boolean;
  /** Fuehrendes Icon, etwa `star` fuer den Favoriten-Filter. */
  icon?: Icon;
  /** Farbpunkt, etwa eine Ordnerfarbe. */
  dotColor?: string;
  /** Auswahl-Chip: `caret-down` rechts. */
  dropdown?: boolean;
  /** Abwerfbarer aktiver Filter: `x` rechts. */
  removable?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function FilterChip({
  label,
  active = false,
  compact = false,
  icon: LeadingIcon,
  dotColor,
  dropdown = false,
  removable = false,
  onPress,
  style,
}: FilterChipProps) {
  const tint = active ? accent.base : textColor.primary;

  return (
    <PressableScale
      style={[
        styles.chip,
        { height: compact ? size.filterChipHeightCollapsed : size.filterChipHeight },
        active ? styles.chipActive : styles.chipIdle,
        style,
      ]}
      pressedStyle={styles.chipPressed}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      // Der Chip ist 40 (bzw. 36) hoch; hitSlop bringt das Beruehrungsziel auf
      // die geforderten 48, ohne die Zeile hoeher zu machen.
      hitSlop={{
        top: (size.touchTarget - (compact ? size.filterChipHeightCollapsed : size.filterChipHeight)) / 2,
        bottom: (size.touchTarget - (compact ? size.filterChipHeightCollapsed : size.filterChipHeight)) / 2,
      }}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      {LeadingIcon ? <LeadingIcon size={16} color={tint} weight={active ? 'fill' : 'regular'} /> : null}
      <Text variant="label" style={{ color: tint }}>
        {label}
      </Text>
      {dropdown ? <CaretDown size={14} color={tint} weight="regular" /> : null}
      {removable ? <X size={14} color={tint} weight="regular" /> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'] + space['2'],
    paddingHorizontal: size.screenPadding,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipIdle: {
    backgroundColor: bg.raised,
    borderColor: border.subtle,
  },
  chipActive: {
    backgroundColor: accent.surface,
    borderColor: accent.border,
  },
  chipPressed: {
    backgroundColor: bg.overlay,
    borderColor: border.strong,
  },
  dot: {
    width: size.tagDot,
    height: size.tagDot,
    borderRadius: radius.pill,
  },
});
