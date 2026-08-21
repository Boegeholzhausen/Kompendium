/**
 * Kopfzeilen der Screens, die keinen kollabierenden Kopf haben.
 *
 * Zwei Formen kommen in den Blaettern vor:
 *
 *   `TitleHeader`    Titel als `display`, rechts eine Schaltflaeche oder eine
 *                    sekundaere Pille. Innenabstand 8 / 16 / 12 wie in `3a`
 *                    (Ordner).
 *   `CompactHeader`  56 hoch, Zurueck-Pfeil links, optional Titel als `title`,
 *                    rechts eine Schaltflaeche. So in `3b` (Ordner-Detail, ohne
 *                    Titel) und `6a` (Papierkorb, mit Titel).
 *
 * Beide sitzen unter der Safe Area; die berechnet der Screen, nicht die
 * Kopfzeile — nur er weiss, ob darunter noch ein Streifen folgt.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { bg, border, size, space } from '../theme';
import { ArrowLeft } from './icons';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface TitleHeaderProps {
  title: string;
  /** Schaltflaeche oder Pille am rechten Rand. */
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function TitleHeader({ title, right, style }: TitleHeaderProps) {
  return (
    <View style={[styles.titleHeader, style]}>
      <Text variant="display" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {right}
    </View>
  );
}

export interface CompactHeaderProps {
  /** Ohne Titel bleibt die Zeile leer — so in Blatt `3b`. */
  title?: string;
  onBack: () => void;
  backLabel?: string;
  right?: React.ReactNode;
  /** Eigene Flaeche mit Trennlinie, etwa im Auswahlmodus (Blatt `3h`). */
  raised?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CompactHeader({
  title,
  onBack,
  backLabel = 'Zurück',
  right,
  raised = false,
  style,
}: CompactHeaderProps) {
  return (
    <View style={[styles.compactHeader, raised && styles.compactRaised, style]}>
      <IconButton icon={ArrowLeft} onPress={onBack} accessibilityLabel={backLabel} />
      {title ? (
        <Text variant="title" numberOfLines={1} style={styles.compactTitle}>
          {title}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  titleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space['12'],
    paddingLeft: size.screenPadding,
    paddingRight: size.screenPadding,
    paddingTop: space['8'],
    paddingBottom: space['12'],
    // Ohne `right` gaebe nur der Titel die Zeilenhoehe vor (36 statt 48) — der
    // Kopf waere kuerzer und der Titel saesse hoeher als in `3a` (Ordner), wo
    // die Schaltflaeche die Zeile auf 48 zieht. `minHeight` zaehlt beim
    // Border-Box hier inklusive Innenabstand, deshalb die volle Summe wie in
    // `TITLE_BAR_EXPANDED` (Bibliothek) — sonst reicht sie schon durch den
    // Text allein (8 + 36 + 12 = 56) und greift nicht.
    minHeight: space['8'] + size.touchTarget + space['12'],
  },
  title: {
    flex: 1,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    height: size.headerCompactHeight,
    // Die 48er Ziele sitzen 4 vom Rand, ihr Icon steht damit auf dem
    // Seitenrand 16 — genau wie in den Blaettern gezeichnet.
    paddingHorizontal: space['4'],
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  compactRaised: {
    backgroundColor: bg.surface,
    borderBottomColor: border.subtle,
  },
  compactTitle: {
    flex: 1,
    paddingHorizontal: space['4'],
  },
  spacer: {
    flex: 1,
  },
});
