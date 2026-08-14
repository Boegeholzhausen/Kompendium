/**
 * 18 · Skelett-Platzhalter.
 *
 * Grundflaeche `bg/surface`, Radius wie das echte Element; der Schimmer laeuft
 * als Verlauf transparent → `bg/raised` → transparent in 1600 ms linear von
 * links nach rechts.
 *
 * Nur die oberen drei Zeilen schimmern; weiter unten stehen ruhige Platzhalter
 * mit Deckkraft 1 → 0.6 → 0.3, damit die Bewegung nicht den ganzen Screen
 * erfasst. Bei "Bewegung reduzieren" entfaellt der Schimmer ganz.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { bg, duration, easingNative, radius, size, space } from '../theme';
import { useReduceMotion } from '../theme/useReduceMotion';

/** Verlauf des Schimmers — eine Flaechenstufe hoeher als der Grund. */
const SHIMMER_COLORS = ['transparent', bg.raised, 'transparent'] as const;

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  /** Der Schimmer laeuft nur in den oberen Zeilen einer Liste. */
  shimmer?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width,
  height,
  borderRadius = radius.xs,
  shimmer = true,
  style,
}: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const [boxWidth, setBoxWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animated = shimmer && !reduceMotion && boxWidth > 0;

  useEffect(() => {
    if (!animated) return;
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: duration.shimmer,
        easing: easingNative.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animated, progress]);

  return (
    <View
      style={[styles.base, { width, height, borderRadius }, style]}
      onLayout={(event) => setBoxWidth(event.nativeEvent.layout.width)}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {animated ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-boxWidth, boxWidth],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={SHIMMER_COLORS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Platzhalter einer Dokumentzeile: Kachel 44 x 44 + zwei Balken. */
export function SkeletonRow({ shimmer = true, style }: { shimmer?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, style]}>
      <Skeleton
        width={size.tileSmall}
        height={size.tileSmall}
        borderRadius={radius.sm}
        shimmer={shimmer}
      />
      <View style={styles.rowBars}>
        <Skeleton width="70%" height={size.skeletonTitleBar} shimmer={shimmer} />
        <Skeleton width="40%" height={size.skeletonMetaBar} shimmer={shimmer} />
      </View>
    </View>
  );
}

/** Platzhalter einer Dokumentkarte: 16:10-Flaeche + zwei Balken. */
export function SkeletonCard({
  shimmer = true,
  style,
}: {
  shimmer?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      <View style={styles.cardTile}>
        <Skeleton borderRadius={radius.sm} shimmer={shimmer} style={styles.fill} />
      </View>
      <Skeleton width="80%" height={size.skeletonTitleBar} shimmer={false} style={styles.cardBar} />
      <Skeleton width="50%" height={size.skeletonMetaBar} shimmer={false} style={styles.cardBarSmall} />
    </View>
  );
}

/**
 * Ladeliste. Die ersten drei Zeilen schimmern, die letzten drei verlieren
 * Deckkraft (1 → 0.6 → 0.3).
 */
export function SkeletonList({ count = 6, style }: { count?: number; style?: StyleProp<ViewStyle> }) {
  const fade = [1, 0.6, 0.3];

  return (
    <View style={[styles.list, style]}>
      {Array.from({ length: count }, (_, index) => {
        const fromEnd = count - 1 - index;
        const opacity = fromEnd < fade.length ? (fade[fade.length - 1 - fromEnd] ?? 1) : 1;
        return <SkeletonRow key={index} shimmer={index < 3} style={{ opacity }} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: bg.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
  },
  rowBars: {
    flex: 1,
    gap: space['8'],
  },
  cardTile: {
    width: '100%',
    aspectRatio: size.tileAspect,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  cardBar: {
    marginTop: space['8'],
  },
  cardBarSmall: {
    marginTop: space['4'] + space['2'],
  },
  list: {
    gap: space['20'],
  },
});
