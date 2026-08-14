/**
 * 02 · Dokumentkarte — zweispaltiges Raster, `gap 16 / 12`.
 *
 * Kachel 16:10, Titel `label` darunter mit fester Hoehe 36 (zwei Zeilen),
 * darunter der Ordner-Chip. Nicht einsortierte Dokumente zeigen `tray` +
 * "Nicht einsortiert" statt eines Ordnernamens.
 *
 * Der Favoriten-Stern liegt oben rechts AUF der Kachel: unter dem Titel bleibt
 * kein 48-dp-Ziel frei, ohne die Karte in die Hoehe zu ziehen.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, border, radius, size, space, text as textColor } from '../theme';
import type { DocType, TileState } from '../theme/tile';
import { DocTile } from './DocTile';
import { Folder, Star, Tray } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface DocCardProps {
  id: string;
  title: string;
  type: DocType;
  /** Name des Ordners; fehlt er, gilt das Dokument als nicht einsortiert. */
  folderName?: string | null;
  favorite?: boolean;
  state?: TileState;
  onPress?: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function DocCard({
  id,
  title,
  type,
  folderName,
  favorite = false,
  state = 'default',
  onPress,
  onLongPress,
  onToggleFavorite,
  style,
}: DocCardProps) {
  return (
    <View style={style}>
      <PressableScale
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${folderName ?? 'Nicht einsortiert'}`}
      >
        {({ pressed }) => (
          <>
            <View>
              <DocTile
                id={id}
                type={type}
                variant="card"
                state={state}
                iconSize={14}
                style={pressed ? styles.tilePressed : undefined}
              />
            </View>
            <Text variant="label" numberOfLines={2} style={styles.title}>
              {title}
            </Text>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                {folderName ? (
                  <Folder size={14} color={textColor.secondary} weight="regular" />
                ) : (
                  <Tray size={14} color={textColor.secondary} weight="regular" />
                )}
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {folderName ?? 'Nicht einsortiert'}
                </Text>
              </View>
            </View>
          </>
        )}
      </PressableScale>

      <PressableScale
        style={styles.starTarget}
        onPress={onToggleFavorite}
        accessibilityRole="button"
        accessibilityLabel={favorite ? 'Favorit entfernen' : 'Zu Favoriten'}
        accessibilityState={{ selected: favorite }}
      >
        <Star
          size={20}
          weight={favorite ? 'fill' : 'regular'}
          color={favorite ? accent.base : textColor.secondary}
        />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  tilePressed: {
    // Eine Flaechenstufe hoeher zeigt sich auf der Kachel als hellerer Rand;
    // der Verlauf selbst bleibt, damit das Dokument wiedererkennbar ist.
    borderColor: border.strong,
  },
  title: {
    marginTop: space['8'],
    height: size.cardTitleHeight,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: space['2'],
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'] + space['2'],
    height: size.folderChipHeight,
    paddingHorizontal: space['8'],
    borderRadius: radius.xs,
    backgroundColor: bg.raised,
    maxWidth: '100%',
  },
  starTarget: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: space['8'],
    paddingRight: space['8'],
  },
});
