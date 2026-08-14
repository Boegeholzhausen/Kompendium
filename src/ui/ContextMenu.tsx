/**
 * 09 · Kontextmenue — langer Druck auf eine Zeile.
 *
 * `bg/overlay`, `radius md`, 1 px `border/strong`, Innenabstand 6; Eintraege
 * Hoehe 48 mit Icon 20 + `body`, gedrueckt `bg/raised` + `radius sm`.
 *
 * Der destruktive Eintrag steht in `danger` (Icon UND Text — Farbe traegt nie
 * allein die Bedeutung), immer unten und durch eine 1-px-Linie abgesetzt.
 * Er wird beim Auffalten des Menues nie unter dem Daumen liegen.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  bg,
  border,
  floatingShadow,
  iconSize,
  overlay,
  radius,
  semantic,
  size,
  space,
  text as textColor,
} from '../theme';
import type { Icon } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface ContextMenuItem {
  key: string;
  label: string;
  icon: Icon;
  /** Wird ans Ende sortiert und in `danger` gezeichnet. */
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export interface ContextMenuProps {
  items: ContextMenuItem[];
  style?: StyleProp<ViewStyle>;
}

/** Die reine Flaeche — fuer Blatt 2a und fuer Screens, die selbst positionieren. */
export function ContextMenuSurface({ items, style }: ContextMenuProps) {
  const regular = items.filter((item) => !item.destructive);
  const destructive = items.filter((item) => item.destructive);

  return (
    <View style={[styles.menu, style]} accessibilityRole="menu">
      {regular.map((item) => (
        <MenuEntry key={item.key} item={item} />
      ))}
      {destructive.length > 0 ? <View style={styles.divider} /> : null}
      {destructive.map((item) => (
        <MenuEntry key={item.key} item={item} />
      ))}
    </View>
  );
}

function MenuEntry({ item }: { item: ContextMenuItem }) {
  const tint = item.disabled
    ? textColor.tertiary
    : item.destructive
      ? semantic.danger
      : textColor.primary;
  const iconTint = item.disabled
    ? textColor.tertiary
    : item.destructive
      ? semantic.danger
      : textColor.secondary;
  const ItemIcon = item.icon;

  return (
    <PressableScale
      style={styles.entry}
      pressedStyle={styles.entryPressed}
      scaleOnPress={false}
      disabled={item.disabled}
      onPress={item.onPress}
      accessibilityRole="menuitem"
      accessibilityLabel={item.label}
      accessibilityState={{ disabled: !!item.disabled }}
    >
      <ItemIcon size={iconSize.md} color={iconTint} weight="regular" />
      <Text variant="body" style={{ color: tint }}>
        {item.label}
      </Text>
    </PressableScale>
  );
}

export interface ContextMenuOverlayProps extends ContextMenuProps {
  visible: boolean;
  onClose?: () => void;
}

/** Menue ueber einem Scrim; das Antippen daneben schliesst es. */
export function ContextMenu({ visible, onClose, items, style }: ContextMenuOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.overlay}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Menue schliessen"
      >
        <ContextMenuSurface items={items} style={style} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    backgroundColor: bg.overlay,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: border.strong,
    padding: size.menuPadding,
    ...floatingShadow,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.menuItemHeight,
    paddingHorizontal: space['8'] + space['2'],
    borderRadius: radius.sm,
  },
  entryPressed: {
    backgroundColor: bg.raised,
  },
  divider: {
    height: 1,
    backgroundColor: border.strong,
    marginVertical: size.menuPadding,
    marginHorizontal: space['8'] + space['2'],
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: size.screenPadding,
    backgroundColor: overlay.scrim,
  },
});
