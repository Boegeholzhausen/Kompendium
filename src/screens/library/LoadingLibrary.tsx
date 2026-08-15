/**
 * Screen 20 — Ladezustand der Bibliothek (Blatt `4b`).
 *
 * Kopfzeile, Suchfeld und Tab-Bar stehen bereits; nur die Liste laedt. Das
 * Layout darf beim Eintreffen der Daten nicht springen, deshalb hat dieser
 * Screen exakt denselben Aufbau wie die fertige Bibliothek — dasselbe
 * Suchfeld, derselbe obere Innenabstand, dieselbe Stelle fuer den
 * Sektionskopf. Nur die Zeilen sind Platzhalter.
 *
 * Kein Vollbild-Spinner: ein Spinner sagt "warte", ein Skelett sagt "hier
 * kommt eine Liste, und so wird sie aussehen".
 *
 * Die Filterleiste gehoert nicht hierher, sondern in den schwebenden Kopf —
 * dort steht sie im Ladezustand als graue Pille (`chips="skeleton"`).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, size, space } from '../../theme';
import { SearchField } from '../../ui/SearchField';
import { Skeleton, SkeletonList } from '../../ui/Skeleton';
import { CHIPS_SPACER } from './metrics';

/** Der Balken an der Stelle des Sektionskopfs — 12 x 120 aus dem Blatt. */
const SECTION_BAR = { width: 120, height: 12 };

export function LoadingLibrary({ top }: { top: number }) {
  return (
    <View style={[styles.body, { paddingTop: top }]} pointerEvents="none">
      <View style={styles.searchBlock}>
        {/* Nicht bedienbar: es gibt noch nichts zu durchsuchen. */}
        <SearchField interactive={false} />
      </View>

      <View style={styles.chipsSpacer} />

      <Skeleton
        width={SECTION_BAR.width}
        height={SECTION_BAR.height}
        borderRadius={radius.xs}
        shimmer={false}
        style={styles.sectionBar}
      />

      <SkeletonList style={styles.list} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  searchBlock: {
    paddingTop: size.screenPadding,
    paddingHorizontal: size.screenPadding,
  },
  chipsSpacer: {
    height: CHIPS_SPACER,
  },
  sectionBar: {
    marginTop: space['24'],
    marginHorizontal: size.screenPadding,
  },
  list: {
    marginTop: space['16'],
    paddingHorizontal: size.screenPadding,
  },
});
