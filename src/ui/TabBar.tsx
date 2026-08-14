/**
 * 14 · Tab-Bar · 17 · Auswahl-Aktionsleiste.
 *
 * Beide sitzen an derselben Stelle und tragen dieselbe Form: vier gleiche
 * Spalten, Icon 24 + `caption`, `gap 4`. Die Auswahlleiste liegt eine
 * Flaechenstufe hoeher (`bg/raised` + `border/strong`), damit der Moduswechsel
 * auch unten sichtbar ist, behaelt aber Icon UND Beschriftung — sonst wirkte
 * er wie ein anderes Bedienmodell.
 *
 * Vier Ziele: Bibliothek, Ordner, Tags, Einstellungen. Suchscreen und Viewer
 * zeigen keine Tab-Bar.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accent, bg, border, iconSize, semantic, space, text as textColor } from '../theme';
import type { Icon } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface TabItem {
  key: string;
  label: string;
  icon: Icon;
  /** Ohne Dokumente fuehren Ordner und Tags nur in weitere leere Screens. */
  disabled?: boolean;
}

export interface TabBarProps {
  items: TabItem[];
  value: string;
  onChange?: (key: string) => void;
  /** Safe Area nicht selbst addieren — fuer das Komponenten-Blatt. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function TabBar({ items, value, onChange, inline = false, style }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        styles.tabBar,
        { paddingBottom: space['8'] + (inline ? 0 : insets.bottom) },
        style,
      ]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const isActive = item.key === value;
        const tint = item.disabled
          ? textColor.tertiary
          : isActive
            ? accent.base
            : textColor.secondary;
        const ItemIcon = item.icon;
        return (
          <PressableScale
            key={item.key}
            style={styles.column}
            scaleOnPress={false}
            disabled={item.disabled}
            onPress={() => onChange?.(item.key)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: isActive, disabled: !!item.disabled }}
          >
            <ItemIcon size={iconSize.lg} color={tint} weight={isActive ? 'fill' : 'regular'} />
            <Text variant="caption" numberOfLines={1} style={{ color: tint }}>
              {item.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

export interface SelectionAction {
  key: string;
  label: string;
  icon: Icon;
  destructive?: boolean;
  onPress?: () => void;
}

/** 17 · Ersetzt die Tab-Bar, solange etwas ausgewaehlt ist. */
export function SelectionBar({
  actions,
  inline = false,
  style,
}: {
  actions: SelectionAction[];
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        styles.selectionBar,
        { paddingBottom: space['8'] + (inline ? 0 : insets.bottom) },
        style,
      ]}
    >
      {actions.map((action) => {
        const tint = action.destructive ? semantic.danger : textColor.primary;
        const ActionIcon = action.icon;
        return (
          <PressableScale
            key={action.key}
            style={styles.column}
            scaleOnPress={false}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <ActionIcon size={iconSize.lg} color={tint} weight="regular" />
            <Text variant="caption" numberOfLines={1} style={{ color: tint }}>
              {action.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: space['8'],
    borderTopWidth: 1,
  },
  tabBar: {
    backgroundColor: bg.surface,
    borderTopColor: border.subtle,
  },
  selectionBar: {
    backgroundColor: bg.raised,
    borderTopColor: border.strong,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: space['4'],
    // Haelt die laengste Beschriftung ("Einstellungen") von der Nachbarspalte weg.
    paddingHorizontal: space['2'],
  },
});
