/**
 * Die Zahlen der Gruppe "Speicher" (Blatt `3i`).
 *
 * Oben der belegte Platz, darunter seine Aufteilung:
 *
 *   offline   `accent`        — ausdruecklich behalten, bleibt beim Leeren
 *   cache     `border/strong` — nur zufaellig noch da, verschwindet
 *
 * Die beiden Werte stehen getrennt, weil "Cache leeren" sonst wie
 * Datenverlust wirkt: wer nicht weiss, dass die offline behaltenen Dokumente
 * davon unberuehrt bleiben, tippt es nicht an. Jede Zeile traegt Punkt UND
 * Wort — Farbe traegt nie allein die Bedeutung.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { formatBytes } from '../../data/format';
import type { StorageUsage } from '../../data/storage';
import { accent, border, radius, size, space } from '../../theme';
import { Text } from '../../ui/Text';

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="caption" tone="secondary" numeric>
        {label}
      </Text>
    </View>
  );
}

export function StorageSummary({ usage }: { usage: StorageUsage }) {
  return (
    <View style={styles.host}>
      <Text variant="body" numeric>
        {`${formatBytes(usage.usedBytes)} belegt`}
      </Text>

      <View style={styles.legend}>
        <Legend color={accent.base} label={`Offline behalten · ${formatBytes(usage.offlineBytes)}`} />
        <Legend color={border.strong} label={`Cache · ${formatBytes(usage.cacheBytes)}`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    gap: space['8'] + space['2'],
  },
  legend: {
    gap: space['4'],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  legendDot: {
    width: size.legendDot,
    height: size.legendDot,
    borderRadius: radius.pill,
  },
});
