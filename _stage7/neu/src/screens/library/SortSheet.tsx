/**
 * Sortierung — Bottom-Sheet hinter der Schaltflaeche `arrows-down-up`.
 *
 * Im Prototyp gibt es kein eigenes Blatt dafuer; das Handoff-Dokument fuehrt
 * `sort: 'recent' | 'title' | 'size'` aber unter "State Management". Das Sheet
 * benutzt deshalb ausschliesslich vorhandene Teile: die Sheet-Huelle
 * (Komponente 8) und Zeilen in der Form des Kontextmenues (Komponente 9), die
 * gewaehlte Zeile mit Haken UND Mint — Farbe traegt nie allein die Bedeutung.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { accent, bg, radius, size, space } from '../../theme';
import { sortLabels, type SortKey } from '../../state/library';
import { BottomSheet } from '../../ui/BottomSheet';
import { Check } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { Text } from '../../ui/Text';

const order: SortKey[] = ['recent', 'title', 'size'];

export interface SortSheetProps {
  visible: boolean;
  value: SortKey;
  onSelect: (key: SortKey) => void;
  onClose: () => void;
}

export function SortSheet({ visible, value, onSelect, onClose }: SortSheetProps) {
  return (
    <BottomSheet visible={visible} title="Sortieren" onClose={onClose}>
      <View style={styles.list}>
        {order.map((key) => {
          const selected = key === value;
          return (
            <PressableScale
              key={key}
              style={styles.entry}
              pressedStyle={styles.entryPressed}
              scaleOnPress={false}
              onPress={() => {
                onSelect(key);
                onClose();
              }}
              accessibilityRole="menuitem"
              accessibilityLabel={sortLabels[key]}
              accessibilityState={{ selected }}
            >
              <Text variant="body" tone={selected ? 'accent' : 'primary'}>
                {sortLabels[key]}
              </Text>
              {selected ? <Check size={20} color={accent.base} weight="bold" /> : null}
            </PressableScale>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: space['8'],
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: size.touchTarget,
    paddingHorizontal: space['12'],
    borderRadius: radius.sm,
  },
  entryPressed: {
    backgroundColor: bg.raised,
  },
});
