/**
 * 02 · Dokumentkarte — zweispaltiges Raster, `gap 16 / 12`.
 *
 * Kachel 16:10, Titel `label` darunter mit fester Hoehe 36 (zwei Zeilen),
 * darunter der Ordner-Chip. Nicht einsortierte Dokumente zeigen `tray` +
 * "Nicht einsortiert" statt eines Ordnernamens.
 *
 * Der Favoriten-Stern liegt oben rechts AUF der Kachel: unter dem Titel bleibt
 * kein 48-dp-Ziel frei, ohne die Karte in die Hoehe zu ziehen.
 *
 * Das Status-Icon steht rechts in der untersten Zeile, neben Ordner-Chip oder
 * Metazeile — dieselbe Anzeige wie in der Dokumentzeile, damit beide Ansichten
 * denselben Zustand zeigen. In der Kachel gibt es keine Wischgeste; gesetzt
 * wird der Status hier ueber Kontextmenue und Auswahlmodus.
 *
 * Ergaenzt in Schritt 4 fuer die Sektion "Neu" (Blatt 1c): dort tragen die
 * Karten statt des Ordner-Chips die Metazeile — jede dieser Karten ist per
 * Definition nicht einsortiert, ein dreimal wiederholtes "Nicht einsortiert"
 * waere nur Rauschen. Und sie tragen keinen Stern: ein Dokument, das noch
 * eingeraeumt werden will, wird nicht zuerst zum Favoriten gemacht.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, border, iconSize, radius, size, space, text as textColor } from '../theme';
import type { DocType, TileState } from '../theme/tile';
import { DocTile } from './DocTile';
import { CheckCircle, Circle, CloudSlash, Folder, Star, Tray } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface DocCardProps {
  id: string;
  title: string;
  type: DocType;
  /** Name des Ordners; fehlt er, gilt das Dokument als nicht einsortiert. */
  folderName?: string | null;
  /** Ersetzt den Ordner-Chip durch die Metazeile — Sektion "Neu". */
  meta?: string;
  favorite?: boolean;
  /** Sektion "Neu": ohne Stern. */
  showFavorite?: boolean;
  /** Workflow-Status; nur Anzeige, kein Beruehrungsziel (wie in `DocRow`). */
  unread?: boolean;
  /**
   * Offline nicht geladen. Die entsaettigte Kachel allein reicht nicht —
   * Farbe traegt nie allein die Bedeutung, also sagt es der Chip zusaetzlich.
   */
  unavailable?: boolean;
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
  meta,
  favorite = false,
  showFavorite = true,
  unread,
  unavailable = false,
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
        accessibilityLabel={`${title}. ${meta ?? folderName ?? 'Nicht einsortiert'}.${
          unread === undefined ? '' : unread ? ' Ungelesen.' : ' Gelesen.'
        }`}
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
            <Text
              variant="label"
              tone={unavailable ? 'tertiary' : 'primary'}
              numberOfLines={2}
              style={styles.title}
            >
              {title}
            </Text>
            <View style={styles.bottomRow}>
              <View style={styles.bottomMain}>
                {unavailable ? (
                  <View style={styles.chipRow}>
                    <View style={styles.chip}>
                      <CloudSlash size={14} color={textColor.tertiary} weight="regular" />
                      <Text variant="caption" tone="tertiary" numberOfLines={1}>
                        nicht geladen
                      </Text>
                    </View>
                  </View>
                ) : meta !== undefined ? (
                  <Text
                    variant="caption"
                    tone="secondary"
                    numeric
                    numberOfLines={1}
                    style={styles.meta}
                  >
                    {meta}
                  </Text>
                ) : (
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
                )}
              </View>

              {unread !== undefined ? (
                unread ? (
                  <Circle size={iconSize.sm} color={accent.base} weight="fill" />
                ) : (
                  <CheckCircle size={iconSize.sm} color={textColor.tertiary} weight="regular" />
                )
              ) : null}
            </View>
          </>
        )}
      </PressableScale>

      {showFavorite ? (
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
      ) : null}
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
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
  /** Nimmt den Platz, den das Status-Icon uebrig laesst — der Chip kuerzt dann. */
  bottomMain: {
    flex: 1,
    minWidth: 0,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: space['2'],
  },
  meta: {
    marginTop: space['4'],
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
