/**
 * Kopf der Bibliothek — ausgeklappt (Blatt `1c`) und kollabiert (Blatt `1d`).
 *
 * Aufbau von oben: Kopfzeile mit Titel und zwei Icon-Schaltflaechen,
 * Sync-Leiste, Filterleiste. Beim Scrollen schrumpft die Kopfzeile von 68 auf
 * 56, der Titel wechselt von `display` auf `title`, die Flaeche wird zu
 * `bg/surface`, und die Filterleiste wandert mit dem Inhalt nach oben, bis sie
 * unter der Kopfzeile klebt.
 *
 * Der Kopf schwebt ueber der Liste (`position: absolute`), damit sein
 * Groessenwechsel den Inhalt nicht verschiebt. Das Suchfeld gehoert deshalb
 * NICHT hierher, sondern in die Liste: es soll wegscrollen.
 *
 * Abweichung von Blatt `1d`: dort liegt die 2-px-Sync-Leiste unter der
 * geklebten Filterleiste. Hier liegt sie in beiden Zustaenden direkt unter der
 * Kopfzeile — das Komponenten-Inventar 15 sagt "direkt unter dem Header", und
 * Screen 2 beschreibt die Filterleiste als etwas, das "darunter mitklebt",
 * also nicht als Teil des Headers.
 *
 * Der Zustandswechsel laeuft ueber Reanimated auf dem UI-Faden: er haengt am
 * Scrolloffset, und ein Kopf, der dem Finger einen Bildlauf hinterherhinkt,
 * faellt sofort auf.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { bg, border, size, space } from '../../theme';
import { FilterChip } from '../../ui/FilterChip';
import { ArrowsDownUp, Rows, SquaresFour, Star } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { SyncIndicator, type SyncStatus } from '../../ui/SyncIndicator';
import { Text } from '../../ui/Text';
import type { LibraryFilter, ViewMode } from '../../state/library';
import { topFilterTagIds } from '../../data/sampleLibrary';
import { useDocumentStore } from '../../state/documents';
import {
  CHIPS_OFFSET,
  CHIPS_PAD_BOTTOM_COLLAPSED,
  CHIPS_PAD_BOTTOM_EXPANDED,
  CHIPS_PAD_TOP,
  COLLAPSE_DISTANCE,
  TITLE_BAR_COLLAPSED,
  TITLE_BAR_EXPANDED,
} from './metrics';

export interface LibraryHeaderProps {
  scrollY: SharedValue<number>;
  /** Wechselt bei halbem Weg — die Chips gibt es nur in 40 oder 36. */
  collapsed: boolean;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  onOpenSort: () => void;
  syncStatus: SyncStatus;
  activeFilter: LibraryFilter;
  onSelectFilter: (filter: LibraryFilter) => void;
  top: number;
}

export function LibraryHeader({
  scrollY,
  collapsed,
  viewMode,
  onToggleViewMode,
  onOpenSort,
  syncStatus,
  activeFilter,
  onSelectFilter,
  top,
}: LibraryHeaderProps) {
  /**
   * "Die meistgenutzten Tags" (Blatt `1c`). Solange es keine Nutzungszahlen
   * gibt, sind es die beiden aus dem Blatt — aber aus dem Zustand geholt, denn
   * die Tag-Verwaltung kann sie umbenennen oder loeschen.
   */
  const tags = useDocumentStore((state) => state.tags);
  const filterTags = tags.filter((tag) => topFilterTagIds.includes(tag.id));

  const progress = (value: number) => {
    'worklet';
    return interpolate(value, [0, COLLAPSE_DISTANCE], [0, 1], Extrapolation.CLAMP);
  };

  const barStyle = useAnimatedStyle(() => {
    const t = progress(scrollY.value);
    return {
      height: interpolate(t, [0, 1], [TITLE_BAR_EXPANDED, TITLE_BAR_COLLAPSED]),
      // Die Flaeche ist immer deckend: das Suchfeld scrollt darunter hindurch
      // und darf nicht durchschimmern.
      backgroundColor: interpolateColor(t, [0, 1], [bg.base, bg.surface]),
    };
  });

  /**
   * Der Titel wechselt die Groesse, nicht die Deckkraft — dazwischen gibt es
   * keine Stufe. Beide Fassungen blenden deshalb im selben schmalen Fenster
   * gegeneinander, sodass ihre Deckkraft zusammen immer 1 ergibt: eine kurze
   * Ueberblendung statt einer Lucke, in der gar nichts steht.
   */
  const displayTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress(scrollY.value), [0.45, 0.55], [1, 0], Extrapolation.CLAMP),
  }));

  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress(scrollY.value), [0.45, 0.55], [0, 1], Extrapolation.CLAMP),
  }));

  const actionsStyle = useAnimatedStyle(() => {
    const t = progress(scrollY.value);
    return {
      transform: [
        {
          translateY: interpolate(
            t,
            [0, 1],
            [
              (TITLE_BAR_EXPANDED - size.touchTarget) / 2,
              (TITLE_BAR_COLLAPSED - size.touchTarget) / 2,
            ]
          ),
        },
      ],
    };
  });

  const chipsStyle = useAnimatedStyle(() => {
    const t = progress(scrollY.value);
    return {
      transform: [{ translateY: interpolate(t, [0, 1], [CHIPS_OFFSET, 0]) }],
      backgroundColor: interpolateColor(t, [0, 1], [bg.base, bg.surface]),
      borderBottomColor: interpolateColor(t, [0, 1], [bg.base, border.subtle]),
    };
  });

  const ViewIcon = viewMode === 'list' ? Rows : SquaresFour;

  return (
    <View style={[styles.overlay, { top }]} pointerEvents="box-none">
      <Animated.View style={[styles.bar, barStyle]}>
        <Animated.View style={[styles.titleLayer, styles.titleDisplay, displayTitleStyle]}>
          <Text variant="display">Bibliothek</Text>
        </Animated.View>
        <Animated.View style={[styles.titleLayer, styles.titleCompact, compactTitleStyle]}>
          <Text variant="title">Bibliothek</Text>
        </Animated.View>

        <Animated.View style={[styles.actions, actionsStyle]}>
          <IconButton
            icon={ViewIcon}
            active
            onPress={onToggleViewMode}
            accessibilityLabel={
              viewMode === 'list' ? 'Listenansicht, zu Kacheln wechseln' : 'Kachelansicht, zu Liste wechseln'
            }
          />
          <IconButton icon={ArrowsDownUp} onPress={onOpenSort} accessibilityLabel="Sortieren" />
        </Animated.View>
      </Animated.View>

      <SyncIndicator status={syncStatus} />

      <Animated.View
        style={[
          styles.chips,
          {
            paddingBottom: collapsed ? CHIPS_PAD_BOTTOM_COLLAPSED : CHIPS_PAD_BOTTOM_EXPANDED,
          },
          chipsStyle,
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          keyboardShouldPersistTaps="handled"
        >
          <FilterChip
            label="Alle"
            compact={collapsed}
            active={activeFilter === 'all'}
            onPress={() => onSelectFilter('all')}
          />
          <FilterChip
            label="Favoriten"
            icon={Star}
            compact={collapsed}
            active={activeFilter === 'favorites'}
            onPress={() => onSelectFilter('favorites')}
          />
          {filterTags.map((tag) => (
            <FilterChip
              key={tag.id}
              label={tag.name}
              dotColor={tag.color}
              compact={collapsed}
              active={activeFilter === tag.id}
              onPress={() => onSelectFilter(tag.id)}
            />
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bar: {
    // Titel und Schaltflaechen liegen absolut in der Zeile: so bleiben sie an
    // ihrem Platz, waehrend die Zeile selbst schrumpft.
    justifyContent: 'flex-start',
  },
  titleLayer: {
    position: 'absolute',
    left: size.screenPadding,
  },
  titleDisplay: {
    // 8 Innenabstand oben plus 6, damit die Versalhoehe auf der Schaltflaeche steht.
    top: space['8'] + space['4'] + space['2'],
  },
  titleCompact: {
    top: (TITLE_BAR_COLLAPSED - space['24']) / 2,
  },
  actions: {
    position: 'absolute',
    right: size.screenPadding,
    top: 0,
    flexDirection: 'row',
    // Mindestabstand zwischen zwei Beruehrungsflaechen (harte Regel).
    // Blatt 1c zeichnet 4 — die Regel wiegt schwerer, der Unterschied ist
    // durch die zentrierten Icons nicht zu sehen.
    gap: size.touchGap,
  },
  chips: {
    borderBottomWidth: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: space['8'],
    paddingHorizontal: size.screenPadding,
    paddingTop: CHIPS_PAD_TOP,
  },
});
