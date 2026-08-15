/**
 * Zeile mit Wischaktionen (Blatt `3f`).
 *
 * Wischen nach links legt die Aktionen frei; sie tragen Icon **und** Wort, weil
 * ein Symbol allein hier zu wenig sagt. "Umbenennen" ist deshalb 88 breit statt
 * 48 — sonst braeche das Wort um.
 *
 * Wichtig aus dem Handoff-Dokument: **Wischen ist immer nur eine Abkuerzung.**
 * Dieselben Aktionen muessen an anderer Stelle ohne Geste erreichbar sein
 * (in der Tag-Verwaltung hinter dem Chevron). Diese Komponente erzwingt das
 * nicht, der Screen muss es leisten.
 *
 * Nur eine Zeile darf offen stehen. Die Entscheidung faellt beim Screen: er
 * haelt `openKey` und gibt sie hier hinein — zwei offene Zeilen waeren zwei
 * Angebote, von denen eines vergessen wurde.
 *
 * Die Geste laeuft ueber `react-native-gesture-handler` und Reanimated auf dem
 * UI-Faden. `activeOffsetX` sorgt dafuer, dass ein senkrechter Bildlauf
 * gewinnt: die Liste zu scrollen ist haeufiger als eine Zeile umzubenennen.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { bg, duration, easing, semantic, semanticSurface, text as textColor } from '../theme';
import type { Icon } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface SwipeAction {
  key: string;
  label: string;
  icon: Icon;
  /** Feste Breite — 88 fuer "Umbenennen", 72 fuer "Loeschen" (Blatt `3f`). */
  width: number;
  danger?: boolean;
  onPress: () => void;
}

export interface SwipeRowProps {
  /** Ausweis dieser Zeile; gleich `openKey` heisst offen. */
  id: string;
  openKey: string | null;
  onOpenChange: (key: string | null) => void;
  actions: SwipeAction[];
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SwipeRow({ id, openKey, onOpenChange, actions, children, style }: SwipeRowProps) {
  const total = actions.reduce((sum, action) => sum + action.width, 0);
  const translateX = useSharedValue(0);
  const isOpen = openKey === id;

  useEffect(() => {
    translateX.value = withTiming(isOpen ? -total : 0, {
      duration: duration.standard,
      easing: easing.standard,
    });
  }, [isOpen, total, translateX]);

  const pan = Gesture.Pan()
    // Erst ab 12 dp waagerecht uebernimmt die Geste; darunter gehoert die
    // Bewegung der Liste.
    .activeOffsetX([-12, 12])
    .failOffsetY([-8, 8])
    .onUpdate((event) => {
      const base = isOpen ? -total : 0;
      const next = base + event.translationX;
      translateX.value = Math.min(0, Math.max(-total, next));
    })
    .onEnd(() => {
      const shouldOpen = translateX.value < -total / 2;
      translateX.value = withTiming(shouldOpen ? -total : 0, {
        duration: duration.standard,
        easing: easing.standard,
      });
      runOnJS(onOpenChange)(shouldOpen ? id : null);
    });

  const frontStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  return (
    <View style={[styles.container, style]}>
      <View style={styles.actions} pointerEvents={isOpen ? 'auto' : 'none'}>
        {actions.map((action) => {
          const tint = action.danger ? semantic.danger : textColor.primary;
          const ActionIcon = action.icon;
          return (
            <PressableScale
              key={action.key}
              style={[
                styles.action,
                { width: action.width },
                action.danger ? styles.actionDanger : styles.actionNeutral,
              ]}
              scaleOnPress={false}
              onPress={() => {
                onOpenChange(null);
                action.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <ActionIcon size={20} color={tint} weight="regular" />
              <Text variant="labelSm" style={{ color: tint }}>
                {action.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      <GestureDetector gesture={pan}>
        {/* Die freigelegte Zeile bleibt auf `bg/base` — sonst schimmerte die
            Flaeche der Aktionen darunter durch. */}
        <Animated.View style={[styles.front, frontStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: bg.surface,
  },
  actions: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  actionNeutral: {
    backgroundColor: bg.raised,
  },
  actionDanger: {
    backgroundColor: semanticSurface.danger,
  },
  front: {
    backgroundColor: bg.base,
  },
});
