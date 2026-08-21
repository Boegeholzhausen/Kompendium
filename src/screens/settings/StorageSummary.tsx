/**
 * Der Speicherbalken aus Blatt `3i`.
 *
 * 8 px hoch, `radius pill`, Spur `bg/raised`, zwei Segmente:
 *
 *   offline   `accent`        — ausdruecklich behalten, bleibt beim Leeren
 *   cache     `border/strong` — nur zufaellig noch da, verschwindet
 *
 * Ohne diese Trennung wirkt "Cache leeren" wie Datenverlust. Genau deshalb
 * steht unter dem Balken eine Legende mit Punkt UND Wort — Farbe traegt nie
 * allein die Bedeutung.
 *
 * Ein Segment ueber null wird mindestens 2 dp breit gezeichnet: bei einem
 * Kontingent von 3 GB ist ein Anteil von einem Promille sonst unsichtbar, und
 * "0 belegt" waere die falsche Auskunft. Die Zahl daneben bleibt exakt.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { formatBytes } from '../../data/format';
import type { StorageUsage } from '../../data/storage';
import { accent, bg, border, radius, size, space } from '../../theme';
import { Text } from '../../ui/Text';

/** Damit ein vorhandenes Segment sichtbar bleibt — siehe Kopfkommentar. */
const MIN_SEGMENT = 2;

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

export function StorageBar({ usage }: { usage: StorageUsage }) {
  const [width, setWidth] = React.useState(0);

  const segment = (share: number) => {
    if (share <= 0) return 0;
    return Math.max(MIN_SEGMENT, Math.round(share * width));
  };

  return (
    <View style={styles.host}>
      <Text variant="body" numeric>
        {`${formatBytes(usage.usedBytes)} belegt`}
        <Text variant="body" tone="secondary" numeric>
          {` / von ${formatBytes(usage.quotaBytes)}`}
        </Text>
      </Text>

      <View
        style={styles.track}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="progressbar"
        accessibilityLabel={`${formatBytes(usage.usedBytes)} von ${formatBytes(
          usage.quotaBytes
        )} belegt`}
      >
        <View style={[styles.offline, { width: segment(usage.offlineShare) }]} />
        <View style={[styles.cache, { width: segment(usage.cacheShare) }]} />
      </View>

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
  track: {
    flexDirection: 'row',
    height: size.storageBarHeight,
    borderRadius: radius.pill,
    backgroundColor: bg.raised,
    overflow: 'hidden',
  },
  offline: {
    height: '100%',
    backgroundColor: accent.base,
  },
  cache: {
    height: '100%',
    backgroundColor: border.strong,
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
