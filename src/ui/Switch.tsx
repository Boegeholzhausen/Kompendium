/**
 * Schalter — 48 x 28, `radius pill`, Knopf 22 x 22 bei 3 Innenabstand.
 *
 * Keine eigene Nummer im Komponenten-Inventar, aber in Screen 7 (Info-Sheet)
 * bis auf den Punkt beschrieben und in 16 (Darstellung) und 17 (Ordner
 * anlegen) wieder gebraucht: an `accent` mit Knopf in `on-accent`, aus
 * `border/strong` mit Knopf in `text/secondary`.
 *
 * Die Flaeche allein traegt die Bedeutung nicht — der Knopf steht links oder
 * rechts, und die Zeile daneben nennt den Zustand in Worten. Beruehrungsziel
 * ist die ganze Zeile, nicht die 28 dp hohe Flaeche: `hitSlop` bringt den
 * Schalter selbst auf 48.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import {
  accent,
  border,
  duration,
  easingNative,
  radius,
  size,
  text as textColor,
} from '../theme';
import { useReduceMotion } from '../theme/useReduceMotion';
import { PressableScale } from './press';

export interface SwitchProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Weg des Knopfes: Breite minus Knopf minus beide Innenabstaende. */
const TRAVEL = size.switchWidth - size.switchKnob - 2 * size.switchPadding;

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  style,
}: SwitchProps) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(value ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: duration.micro,
      easing: easingNative.micro,
      useNativeDriver: true,
    }).start();
  }, [value, progress, reduceMotion]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <PressableScale
      style={[
        styles.track,
        { backgroundColor: disabled ? border.subtle : value ? accent.base : border.strong },
        style,
      ]}
      scaleOnPress={false}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={{
        top: (size.touchTarget - size.switchHeight) / 2,
        bottom: (size.touchTarget - size.switchHeight) / 2,
      }}
    >
      <Animated.View
        style={[
          styles.knob,
          {
            backgroundColor: disabled
              ? textColor.tertiary
              : value
                ? accent.on
                : textColor.secondary,
            transform: [{ translateX }],
          },
        ]}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: {
    width: size.switchWidth,
    height: size.switchHeight,
    borderRadius: radius.pill,
    padding: size.switchPadding,
    justifyContent: 'center',
  },
  knob: {
    width: size.switchKnob,
    height: size.switchKnob,
    borderRadius: radius.pill,
  },
});
