/**
 * Auswahl-Sheet — eine Liste, aus der genau eine oder mehrere Zeilen gelten.
 *
 * Im Prototyp gibt es dafuer kein eigenes Blatt; gebraucht wird die Form an
 * vier Stellen: Sortierung der Bibliothek, Sortierung der Ordner, Tag-Filter
 * und Zeitraum-Filter der Suche (Blatt `3d` zeigt beide als Dropdown-Chips mit
 * `caret-down`, also als etwas, das eine Liste aufklappt).
 *
 * Gebaut ist sie deshalb ausschliesslich aus vorhandenen Teilen: die
 * Sheet-Huelle (Komponente 8) und Zeilen in der Form des Kontextmenues
 * (Komponente 9). Die gewaehlte Zeile traegt Haken UND Mint — Farbe traegt nie
 * allein die Bedeutung.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { accent, bg, radius, size, space } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Check } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface ChoiceOption {
  key: string;
  label: string;
  /** Farbpunkt links, etwa die Tag-Farbe im Tag-Filter. */
  dotColor?: string;
  /** Zahl rechts vor dem Haken, etwa die Anzahl der Dokumente. */
  count?: number;
}

export interface ChoiceSheetProps {
  visible: boolean;
  title: string;
  options: ChoiceOption[];
  /** Ein Schluessel bei einfacher Auswahl, eine Liste bei mehrfacher. */
  value: string | string[];
  /** Mehrfachauswahl bleibt offen; einfache Auswahl schliesst das Sheet. */
  multiple?: boolean;
  onSelect: (key: string) => void;
  onClose: () => void;
}

export function ChoiceSheet({
  visible,
  title,
  options,
  value,
  multiple = false,
  onSelect,
  onClose,
}: ChoiceSheetProps) {
  const selected = (key: string) => (Array.isArray(value) ? value.includes(key) : value === key);

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => {
          const isSelected = selected(option.key);
          return (
            <PressableScale
              key={option.key}
              style={styles.entry}
              pressedStyle={styles.entryPressed}
              scaleOnPress={false}
              onPress={() => {
                onSelect(option.key);
                if (!multiple) onClose();
              }}
              accessibilityRole={multiple ? 'checkbox' : 'menuitem'}
              accessibilityLabel={option.label}
              accessibilityState={multiple ? { checked: isSelected } : { selected: isSelected }}
            >
              {option.dotColor ? (
                <View style={[styles.dot, { backgroundColor: option.dotColor }]} />
              ) : null}
              <Text variant="body" tone={isSelected ? 'accent' : 'primary'} style={styles.label}>
                {option.label}
              </Text>
              {option.count !== undefined ? (
                <Text variant="caption" tone="secondary" numeric>
                  {option.count}
                </Text>
              ) : null}
              {isSelected ? <Check size={20} color={accent.base} weight="bold" /> : null}
            </PressableScale>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    // Waechst mit dem Inhalt, deckelt aber bei etwa acht Zeilen — laenger
    // duerfte das Sheet den Screen nicht fuellen, ohne ein eigener zu sein.
    maxHeight: size.touchTarget * 8,
  },
  listContent: {
    paddingBottom: space['8'],
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.touchTarget,
    paddingHorizontal: space['12'],
    borderRadius: radius.sm,
  },
  entryPressed: {
    backgroundColor: bg.raised,
  },
  label: {
    flex: 1,
  },
  dot: {
    width: size.tagDotLarge,
    height: size.tagDotLarge,
    borderRadius: radius.pill,
  },
});
