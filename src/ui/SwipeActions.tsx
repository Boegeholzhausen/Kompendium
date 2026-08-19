/**
 * Wischen mit **sofortiger Wirkung** — die Abkuerzung fuer den Workflow-Status.
 *
 * Anders als die frueheren Wischaktionen der Tag-Verwaltung legt diese Geste
 * keine Schaltflaechen frei, die man danach noch treffen muss: sie fuehrt die
 * Aktion beim Loslassen aus. Die Flaeche hinter der Zeile sagt waehrend des
 * Ziehens an, was gleich passiert.
 *
 * Wichtig aus dem Handoff-Dokument: **Wischen ist immer nur eine Abkuerzung.**
 * Dieselben Aktionen sind ohne Geste erreichbar — ueber das Kontextmenue
 * (langer Druck), die Auswahl-Aktionsleiste und die beiden Schalter im
 * Info-Sheet des Viewers. Diese Komponente erzwingt das nicht, der Screen muss
 * es leisten.
 *
 * Die Geste laeuft ueber `react-native-gesture-handler` und Reanimated auf dem
 * UI-Faden. `activeOffsetX` sorgt dafuer, dass ein senkrechter Bildlauf
 * gewinnt: die Liste zu scrollen ist haeufiger, als eine Zeile umzusortieren.
 *
 * Die Zeile fliegt nicht weg, sondern federt in jedem Fall auf 0 zurueck: beim
 * Archivieren verschwindet sie ohnehin aus der gefilterten Liste, bei
 * "gelesen" bleibt sie stehen und wechselt nur ihr Status-Icon.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { bg, duration, easing, iconSize, size, space } from '../theme';
import { useReduceMotion } from '../theme/useReduceMotion';
import type { Icon } from './icons';
import { Text } from './Text';

export interface SwipeSide {
  icon: Icon;
  label: string;
  /** Flaeche hinter der Zeile, aus dem Theme. */
  surface: string;
  tint: string;
  onTrigger: () => void;
}

export interface SwipeActionsProps {
  /** Geste nach rechts (Flaeche liegt links) — im Einsatz: Archiv. */
  right?: SwipeSide;
  /** Geste nach links (Flaeche liegt rechts) — im Einsatz: gelesen/ungelesen. */
  left?: SwipeSide;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SwipeActions({ right, left, children, style }: SwipeActionsProps) {
  const translateX = useSharedValue(0);
  /** Beginnt die Geste am Bildrand, gehoert sie Androids Zurueck-Geste. */
  const fromEdge = useSharedValue(false);
  const reduceMotion = useReduceMotion();

  const settle = (value: number) => {
    'worklet';
    translateX.value = reduceMotion
      ? value
      : withTiming(value, { duration: duration.standard, easing: easing.standard });
  };

  const pan = Gesture.Pan()
    // Erst ab 12 dp waagerecht uebernimmt die Geste; darunter gehoert die
    // Bewegung der Liste.
    .activeOffsetX([-12, 12])
    .failOffsetY([-8, 8])
    .onBegin((event) => {
      // Eine Bewegung, die am linken Bildrand anfaengt, ist die Zurueck-Geste
      // des Systems. Sie zu uebernehmen hiesse, das Zurueckgehen abzufangen.
      fromEdge.value = event.absoluteX < size.systemGestureEdge;
    })
    .onUpdate((event) => {
      if (fromEdge.value) return;
      const next = event.translationX;
      // Nur die Seiten zulassen, fuer die es eine Aktion gibt.
      if (next > 0 && right === undefined) return;
      if (next < 0 && left === undefined) return;
      translateX.value = next;
    })
    .onEnd(() => {
      if (fromEdge.value) {
        settle(0);
        return;
      }
      const travelled = translateX.value;
      settle(0);
      if (travelled > size.swipeTrigger && right !== undefined) {
        runOnJS(right.onTrigger)();
      } else if (travelled < -size.swipeTrigger && left !== undefined) {
        runOnJS(left.onTrigger)();
      }
    })
    // Nimmt das System die Geste an sich (Zurueckgehen), bleibt die Zeile sonst
    // verschoben stehen.
    .onFinalize(() => {
      if (translateX.value !== 0) settle(0);
    });

  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  /** Die Flaechen liegen jeweils auf der Seite, aus der die Zeile weggezogen wird. */
  const rightStyle = useAnimatedStyle(() => ({ opacity: translateX.value > 0 ? 1 : 0 }));
  const leftStyle = useAnimatedStyle(() => ({ opacity: translateX.value < 0 ? 1 : 0 }));

  return (
    <View style={[styles.container, style]}>
      {right ? (
        <Animated.View
          style={[styles.side, styles.sideLeft, { backgroundColor: right.surface }, rightStyle]}
          pointerEvents="none"
        >
          <right.icon size={iconSize.sm} color={right.tint} weight="regular" />
          <Text variant="labelSm" style={{ color: right.tint }}>
            {right.label}
          </Text>
        </Animated.View>
      ) : null}

      {left ? (
        <Animated.View
          style={[styles.side, styles.sideRight, { backgroundColor: left.surface }, leftStyle]}
          pointerEvents="none"
        >
          <left.icon size={iconSize.sm} color={left.tint} weight="regular" />
          <Text variant="labelSm" style={{ color: left.tint }}>
            {left.label}
          </Text>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={pan}>
        {/* Die wandernde Zeile bleibt auf `bg/base` — sonst schimmerte die
            Flaeche dahinter durch. */}
        <Animated.View style={[styles.front, frontStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: bg.base,
  },
  side: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: size.swipeTrigger,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    paddingHorizontal: space['16'],
  },
  sideLeft: {
    left: 0,
  },
  sideRight: {
    right: 0,
    justifyContent: 'flex-end',
  },
  front: {
    backgroundColor: bg.base,
  },
});
