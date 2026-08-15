/**
 * Tag-Sheet — Schritt 4 des Kernflows (Blatt `4e`).
 *
 * Es legt sich **ueber** das Info-Sheet, ersetzt es nicht: beim Schliessen
 * liegt der Nutzer wieder in den Dokumentdaten, nicht im Viewer.
 *
 * Tippen filtert die Liste, die Fundstelle ist mint hinterlegt. Antippen setzt
 * das Tag sofort — kein Bestaetigungsdialog, weil Zuweisen reversibel ist; die
 * Absicherung traegt der Toast mit "Rueckgaengig".
 *
 * Der letzte Eintrag unter den Treffern ist immer "„…" als neuen Tag anlegen".
 * Hier entstehen neue Tags — und nur deshalb braucht die Tag-Verwaltung (`3f`)
 * keinen FAB.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { LibraryTag } from '../../data/sampleLibrary';
import { accent, border, iconSize, radius, size, space } from '../../theme';
import { HighlightedText } from '../../ui/HighlightedText';
import { BottomSheet, SheetLayer } from '../../ui/BottomSheet';
import { Check, Plus } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { SearchField } from '../../ui/SearchField';
import { TagChip } from '../../ui/TagChip';
import { Text } from '../../ui/Text';

/**
 * Hebt die Fundstelle hervor. Die Regel dazu (Flaeche UND Farbe) steht seit
 * Schritt 6 an einer Stelle: `ui/HighlightedText`, weil die Suche sie ebenso
 * braucht.
 */
function Highlighted({ name, query }: { name: string; query: string }) {
  const at = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  return (
    <HighlightedText
      text={name}
      hit={at === -1 ? null : { start: at, length: query.length }}
      variant="body"
    />
  );
}

interface TagRowProps {
  tag: LibraryTag;
  query: string;
  count: number;
  checked: boolean;
  onPress: () => void;
}

function TagRow({ tag, query, count, checked, onPress }: TagRowProps) {
  return (
    <PressableScale
      style={styles.row}
      scaleOnPress={false}
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={`Tag ${tag.name}, ${count} Dokumente`}
      accessibilityState={{ checked }}
    >
      <View style={[styles.dot, { backgroundColor: tag.color }]} />
      <View style={styles.rowLabel}>
        <Highlighted name={tag.name} query={query} />
      </View>
      <Text variant="caption" tone="secondary" numeric>
        {count}
      </Text>
      <View style={[styles.checkbox, checked ? styles.checkboxOn : styles.checkboxOff]}>
        {checked ? <Check size={16} color={accent.on} weight="bold" /> : null}
      </View>
    </PressableScale>
  );
}

export interface TagSheetProps {
  visible: boolean;
  query: string;
  onChangeQuery: (query: string) => void;
  /** Alle bekannten Tags. */
  tags: LibraryTag[];
  /** Am Dokument gesetzte Ausweise. */
  assigned: string[];
  /** Wie viele Dokumente den Tag tragen — die Zahl rechts in der Zeile. */
  usage: Record<string, number>;
  /** Feste Hoehe der Ebene im Viewer; als Modal waechst das Sheet mit dem Inhalt. */
  height?: number;
  /** Titelzeile — die Mehrfachauswahl nennt dort die Zahl der Dokumente. */
  title?: string;
  /**
   * Im Viewer eine Ebene (`layer`), damit sie sich ueber das Info-Sheet legen
   * kann; in der Bibliothek ein Modal, weil der Scrim dort auch ueber der
   * Auswahl-Aktionsleiste liegen muss.
   */
  as?: 'layer' | 'modal';
  onToggle: (tag: LibraryTag) => void;
  onCreate: (name: string) => void;
  onRemove: (tagId: string) => void;
  onClose: () => void;
}

export function TagSheet({
  visible,
  query,
  onChangeQuery,
  tags,
  assigned,
  usage,
  height,
  title = 'Tag zuweisen',
  as = 'layer',
  onToggle,
  onCreate,
  onRemove,
  onClose,
}: TagSheetProps) {
  const trimmed = query.trim();

  const matches = useMemo(() => {
    if (!trimmed) return tags;
    const needle = trimmed.toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(needle));
  }, [tags, trimmed]);

  /** Ein Name, den es schon gibt, wird nicht noch einmal angeboten. */
  const canCreate =
    trimmed.length > 0 && !tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());

  const assignedTags = assigned
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is LibraryTag => tag !== undefined);

  const Shell = as === 'modal' ? BottomSheet : SheetLayer;

  return (
    <Shell visible={visible} height={height} title={title} onClose={onClose}>
      <SearchField
        value={query}
        onChangeText={onChangeQuery}
        onClear={() => onChangeQuery('')}
        placeholder="Tag suchen oder anlegen"
        autoFocus={visible}
      />

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {matches.map((tag) => (
          <TagRow
            key={tag.id}
            tag={tag}
            query={trimmed}
            count={usage[tag.id] ?? 0}
            checked={assigned.includes(tag.id)}
            onPress={() => onToggle(tag)}
          />
        ))}

        {canCreate ? (
          <PressableScale
            style={styles.row}
            scaleOnPress={false}
            onPress={() => onCreate(trimmed)}
            accessibilityRole="button"
            accessibilityLabel={`${trimmed} als neuen Tag anlegen`}
          >
            <Plus size={iconSize.sm} color={accent.base} weight="regular" />
            <Text variant="label" tone="accent" style={styles.rowLabel}>
              {`„${trimmed}“ als neuen Tag anlegen`}
            </Text>
          </PressableScale>
        ) : null}

        {matches.length === 0 && !canCreate ? (
          <Text variant="bodySm" tone="tertiary" style={styles.empty}>
            Kein Tag mit diesem Namen.
          </Text>
        ) : null}

        {/*
          "Am Dokument" folgt unmittelbar auf die Liste und klebt nicht am
          Fuss: unten steht im Betrieb die Tastatur, und darueber der Toast —
          eine angeheftete Zeile laege genau darunter (Blatt `4e`, Schritt 4).
        */}
        {assignedTags.length > 0 ? (
          <View style={styles.assigned}>
            <Text variant="overline" tone="tertiary">
              Am Dokument
            </Text>
            <View style={styles.chips}>
              {assignedTags.map((tag) => (
                <TagChip
                  key={tag.id}
                  label={tag.name}
                  color={tag.color}
                  large
                  removable
                  onRemove={() => onRemove(tag.id)}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Shell>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    marginTop: space['12'],
    // Ohne feste Hoehe (Modal-Fassung) darf die Liste das Bild nicht fuellen.
    maxHeight: size.touchTarget * 8,
  },
  listContent: {
    // Der Toast steht unten im Bild; die letzte Zeile darf nicht darunter enden.
    paddingBottom: size.toastHeight + space['16'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.touchTarget,
    borderBottomWidth: 1,
    borderBottomColor: border.strong,
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
  },
  dot: {
    width: size.tagDotLarge,
    height: size.tagDotLarge,
    borderRadius: radius.pill,
  },
  checkbox: {
    width: size.checkbox,
    height: size.checkbox,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: accent.base,
  },
  checkboxOff: {
    borderWidth: 2,
    borderColor: border.strong,
  },
  empty: {
    paddingVertical: space['16'],
  },
  assigned: {
    gap: space['8'],
    marginTop: space['16'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['8'],
  },
});
