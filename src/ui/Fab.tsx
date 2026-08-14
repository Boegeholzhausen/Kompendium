/**
 * 13 · FAB.
 *
 * 56 x 56, `radius lg`, `accent`, `plus` 24 in `on-accent`; 16 vom rechten
 * Rand, 112 ueber der Unterkante — damit er ueber der Tab-Bar schwebt und die
 * Liste (Innenabstand unten 88) nicht verdeckt.
 *
 * Entfaellt im Auswahlmodus und auf der leeren Bibliothek: dort traegt der
 * primaere Button dieselbe Aktion.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accent, iconSize, radius, size } from '../theme';
import { Plus } from './icons';
import { PressableScale } from './press';

export interface FabProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Ohne Positionierung — fuer das Komponenten-Blatt. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Fab({
  onPress,
  accessibilityLabel = 'Importieren',
  inline = false,
  style,
}: FabProps) {
  const insets = useSafeAreaInsets();

  return (
    <PressableScale
      style={[
        styles.fab,
        inline ? null : [styles.floating, { bottom: size.fabBottom + insets.bottom }],
        style,
      ]}
      pressedStyle={styles.fabPressed}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Plus size={iconSize.lg} color={accent.on} weight="regular" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: size.fab,
    height: size.fab,
    borderRadius: radius.lg,
    backgroundColor: accent.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floating: {
    position: 'absolute',
    right: size.fabInset,
  },
  fabPressed: {
    backgroundColor: accent.pressed,
  },
});
