/**
 * 03 · Ordner-Kachel.
 *
 * `bg/surface`, `radius md`, Innenabstand 14; `folder`-Icon 24 in `fill` in der
 * Ordnerfarbe, Name `title`, Anzahl `caption`. Die Ordnerfarbe traegt nur das
 * Icon — ein farbiger Kachelhintergrund wuerde mit den Dokumentkacheln
 * konkurrieren.
 *
 * "Ordner anlegen" ist dieselbe Kachel als gestrichelter Umriss ohne Flaeche.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { bg, border, iconSize, radius, size, space, text as textColor } from '../theme';
import { Folder, Plus } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface FolderTileProps {
  name: string;
  /** Anzahl der Dokumente im Ordner. */
  count: number;
  /** Ordnerfarbe aus der Tag-Palette (sechs zur Auswahl). */
  color: string;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function FolderTile({ name, count, color, onPress, onLongPress, style }: FolderTileProps) {
  const label = count === 1 ? '1 Dokument' : `${count} Dokumente`;

  return (
    <PressableScale
      style={[styles.tile, style]}
      pressedStyle={styles.tilePressed}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Ordner ${name}, ${label}`}
    >
      <Folder size={iconSize.lg} color={color} weight="fill" />
      <Text variant="title" numberOfLines={1} style={styles.name}>
        {name}
      </Text>
      <Text variant="caption" tone="secondary" numeric style={styles.count}>
        {label}
      </Text>
    </PressableScale>
  );
}

export interface CreateFolderTileProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function CreateFolderTile({ onPress, style }: CreateFolderTileProps) {
  return (
    <PressableScale
      style={[styles.tile, styles.createTile, style]}
      pressedStyle={styles.createTilePressed}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ordner anlegen"
    >
      <Plus size={iconSize.lg} color={textColor.secondary} weight="regular" />
      <Text variant="label" tone="secondary" style={styles.createLabel}>
        Ordner anlegen
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: border.subtle,
    padding: size.cardPadding,
  },
  tilePressed: {
    backgroundColor: bg.raised,
    borderColor: border.strong,
  },
  name: {
    marginTop: space['8'] + space['2'],
  },
  count: {
    marginTop: space['2'],
  },
  createTile: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['8'],
  },
  createTilePressed: {
    backgroundColor: bg.surface,
  },
  createLabel: {
    textAlign: 'center',
  },
});
