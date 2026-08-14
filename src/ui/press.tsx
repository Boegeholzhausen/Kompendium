/**
 * Druckfeedback — eine Stelle fuer alle Komponenten.
 *
 * Regel aus dem Handoff-Dokument: "Gedrueckt ist immer Skalierung 0.97 plus
 * eine Flaechenstufe hoeher." Die Skalierung laeuft in 100 ms und darf das
 * Layout nicht verschieben, deshalb `transform` und kein Groessenwechsel.
 *
 * Bei aktiver Systemeinstellung "Bewegung reduzieren" entfaellt die
 * Skalierung; der Flaechenwechsel bleibt, damit der Druck sichtbar bleibt.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { duration, easingNative, pressScale } from '../theme/motion';
import { useReduceMotion } from '../theme/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  /** Ruhezustand. */
  style?: StyleProp<ViewStyle>;
  /** Wird zusaetzlich gelegt, solange der Finger liegt — die Flaechenstufe. */
  pressedStyle?: StyleProp<ViewStyle>;
  /** Skalierung abschalten, wenn die Flaeche selbst nicht springen soll (Zeilen in Listen). */
  scaleOnPress?: boolean;
  children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
}

export function PressableScale({
  style,
  pressedStyle,
  scaleOnPress = true,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const animate = useCallback(
    (toValue: number) => {
      if (reduceMotion || !scaleOnPress) {
        scale.setValue(1);
        return;
      }
      Animated.timing(scale, {
        toValue,
        duration: duration.press,
        easing: easingNative.micro,
        useNativeDriver: true,
      }).start();
    },
    [reduceMotion, scale, scaleOnPress]
  );

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      setPressed(true);
      animate(pressScale);
      onPressIn?.(event);
    },
    [animate, onPressIn]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      setPressed(false);
      animate(1);
      onPressOut?.(event);
    },
    [animate, onPressOut]
  );

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, pressed && !disabled ? pressedStyle : null, { transform: [{ scale }] }]}
    >
      {typeof children === 'function' ? children({ pressed: pressed && !disabled }) : children}
    </AnimatedPressable>
  );
}
