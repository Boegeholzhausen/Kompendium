/**
 * 13 · FAB.
 *
 * 56 x 56, `radius lg`, `accent`, `plus` 24 in `on-accent`; 16 vom rechten
 * Rand. Ueber der Tab-Bar (`withTabBar`) 112 ueber der Unterkante, damit er
 * ueber ihr schwebt und die Liste (Innenabstand unten 88) nicht verdeckt.
 * Ohne Tab-Bar — Push-Screens wie Ordner-Detail — nur `fabInset` (16) plus
 * Safe Area: dort steht darunter kein zweites Element, das den Abstand
 * fuellt, ein FAB in Tab-Bar-Hoehe haenge sonst sichtbar mitten im Screen.
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
  /**
   * Der Screen liegt in der Tab-Navigation. Die 112 zaehlen von der Unterkante
   * des Bildschirms, der FAB steckt aber in der Flaeche ueber der Tab-Bar —
   * deren Hoehe samt Safe Area geht also ab. Ohne Tab-Bar (Push-Screens)
   * steht der FAB stattdessen dicht ueber der Unterkante.
   */
  withTabBar?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Fab({
  onPress,
  accessibilityLabel = 'Importieren',
  inline = false,
  withTabBar = false,
  style,
}: FabProps) {
  const insets = useSafeAreaInsets();
  const bottom = withTabBar
    ? Math.max(size.fabInset, size.fabBottom - size.tabBarHeight - insets.bottom)
    : size.fabInset + insets.bottom;

  return (
    <PressableScale
      style={[styles.fab, inline ? null : [styles.floating, { bottom }], style]}
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
