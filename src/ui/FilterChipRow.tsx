/**
 * Die Filterleiste der Bibliothek — vier feste Chips, an einer Stelle.
 *
 * Alle · Ungelesen · Favoriten · Archiv. Sie steht wort- und icongleich in der
 * Bibliothek (Blatt `1c`) und im Ordner-Detail (Blatt `3b`); zweimal
 * ausgeschrieben liefe die eine Fassung frueher oder spaeter der anderen
 * hinterher — und ausgerechnet an einer Leiste, deren Sinn es ist, ueberall
 * gleich auszusehen.
 *
 * Die Chips haengen bewusst NICHT am Bestand (README, "Abweichungen"): ein
 * Chip, der verschwindet, weil gerade kein Dokument dazu passt, waere ein
 * Filter, den man nicht wieder findet.
 *
 * `compact` gibt es nur in der Bibliothek — dort kollabiert der Kopf beim
 * Scrollen. Im Ordner-Detail sind die Chips immer 40 hoch.
 */
import React from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import type { LibraryFilter } from '../state/library';
import { space } from '../theme';
import { FilterChip } from './FilterChip';
import { Archive, Circle, Star, type Icon } from './icons';

/**
 * Die vier Werte in ihrer festen Reihenfolge, mit Beschriftung und Symbol.
 *
 * "Alle" traegt keins: es ist kein Zustand, den ein Symbol beschreiben
 * koennte, sondern die Abwesenheit einer Einschraenkung.
 */
const FILTERS: { key: LibraryFilter; label: string; icon?: Icon }[] = [
  { key: 'all', label: 'Alle' },
  { key: 'unread', label: 'Ungelesen', icon: Circle },
  { key: 'favorites', label: 'Favoriten', icon: Star },
  { key: 'archive', label: 'Archiv', icon: Archive },
];

export interface FilterChipRowProps {
  active: LibraryFilter;
  onSelect: (filter: LibraryFilter) => void;
  /** Schmale Form fuer den eingeklappten Kopf der Bibliothek. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Innenabstand der Leiste. Er bleibt beim Aufrufer, weil er zum Kopf gehoert
   * und nicht zu den Chips: die Bibliothek setzt oben noch einen Wert, das
   * Ordner-Detail nicht.
   */
  contentStyle?: StyleProp<ViewStyle>;
}

export function FilterChipRow({
  active,
  onSelect,
  compact = false,
  style,
  contentStyle,
}: FilterChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={style}
      contentContainerStyle={[styles.row, contentStyle]}
    >
      {FILTERS.map((filter) => (
        <FilterChip
          key={filter.key}
          label={filter.label}
          icon={filter.icon}
          compact={compact}
          active={active === filter.key}
          onPress={() => onSelect(filter.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space['8'],
  },
});
