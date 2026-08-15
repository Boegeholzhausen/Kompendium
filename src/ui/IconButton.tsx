/**
 * Icon-Schaltflaeche in Kopfzeilen — 48 x 48.
 *
 * Keine eigene Nummer im Komponenten-Inventar, sondern die Form, die dort in
 * den Screens beschrieben ist: "zwei 48 x 48-Icon-Buttons — Ansicht umschalten
 * (aktive Ansicht mit `bg/raised` + `border/subtle` + `radius md` hinterlegt)
 * und Sortieren". Dieselbe Schaltflaeche traegt spaeter den Zurueck-Pfeil und
 * das Ueberlaufmenue im Ordner-Detail.
 *
 * `active` hinterlegt die Flaeche — das ist der einzige Unterschied, und er
 * kommt aus Flaeche + Linie, nicht aus Farbe.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { bg, border, iconSize, radius, size, text as textColor } from '../theme';
import type { Icon } from './icons';
import { PressableScale } from './press';

export interface IconButtonProps {
  icon: Icon;
  accessibilityLabel: string;
  /** Hinterlegte Flaeche — etwa die gerade gewaehlte Ansicht. */
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon: ButtonIcon,
  accessibilityLabel,
  active = false,
  disabled = false,
  onPress,
  style,
}: IconButtonProps) {
  const tint = disabled ? textColor.tertiary : active ? textColor.primary : textColor.secondary;

  return (
    <PressableScale
      style={[styles.button, active ? styles.active : styles.idle, style]}
      pressedStyle={styles.pressed}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active, disabled }}
    >
      <ButtonIcon size={iconSize.md} color={tint} weight="regular" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: size.touchTarget,
    height: size.touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    // Der Rahmen ist immer da und im Ruhezustand durchsichtig, damit das
    // Hinterlegen die Flaeche nicht um 2 wachsen laesst.
    borderWidth: 1,
  },
  idle: {
    borderColor: 'transparent',
  },
  active: {
    backgroundColor: bg.raised,
    borderColor: border.subtle,
  },
  pressed: {
    backgroundColor: bg.overlay,
    borderColor: border.strong,
  },
});
