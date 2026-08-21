/**
 * 15 · Sync-Indikator — 2 px hohe Leiste direkt unter dem Header.
 *
 *   syncing     Mint-Segment auf 38 % Breite, Deckkraft 0.25 → 1 → 0.25 in 1400 ms
 *   pending     durchgehend `warning`
 *   idle        nur die Spur, praktisch unsichtbar
 *   signed-out  wie `idle`. Nicht angemeldet ist kein Fehler und keine offene
 *               Aenderung: die Bibliothek funktioniert vollstaendig, nur der
 *               Abgleich ruht. Eine gelbe Leiste ueber jedem Screen waere ein
 *               Alarm fuer einen Zustand, den der Nutzer bewusst gewaehlt hat
 *               — gesagt wird es dort, wo man etwas tun kann: in den
 *               Einstellungen unter "Konto".
 *   error       die Leiste entfaellt: der 36-px-Streifen ERSETZT sie, zwei
 *               Leisten uebereinander waeren ein Bruch
 *
 * "Bewegung reduzieren" haelt das Segment bei voller Deckkraft an — der
 * Zustand bleibt erkennbar, nur ohne Puls.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, duration, easingNative, semantic, size } from '../theme';
import { useReduceMotion } from '../theme/useReduceMotion';

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'signed-out' | 'error';

export function SyncIndicator({
  status,
  style,
}: {
  status: SyncStatus;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'syncing' || reduceMotion) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(0.25);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: duration.syncPulse / 2,
          easing: easingNative.standard,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: duration.syncPulse / 2,
          easing: easingNative.standard,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, reduceMotion, pulse]);

  // Im Fehlerfall traegt der Hinweisstreifen die Meldung; hier bleibt nichts.
  if (status === 'error') return null;

  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={
        status === 'syncing'
          ? 'Synchronisierung laeuft'
          : status === 'pending'
            ? 'Aenderungen offen'
            : status === 'signed-out'
              ? 'Nicht angemeldet'
              : 'Synchron'
      }
    >
      {status === 'syncing' ? (
        <Animated.View style={[styles.segment, { opacity: pulse }]} />
      ) : null}
      {status === 'pending' ? <View style={styles.pending} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: size.syncIndicatorHeight,
    backgroundColor: bg.surface,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
    width: '38%',
    backgroundColor: accent.base,
  },
  pending: {
    height: '100%',
    width: '100%',
    backgroundColor: semantic.warning,
  },
});
