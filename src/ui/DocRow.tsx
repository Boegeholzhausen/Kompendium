/**
 * 01 · Dokumentzeile — die Grundform der Bibliothek.
 *
 * Hoehe 64 (Innenabstand 10 vertikal ergibt sich aus 64 minus Kachel 44),
 * Kachel 44 x 44, `gap 12`. Der Favoriten-Stern ist ein eigenes 48 x 48-Ziel;
 * er liegt neben dem Zeilenziel, nicht darin.
 *
 * Zustaende:
 *   gedrueckt      bg/surface, Radius 10, Flaeche 8 ueber den Seitenrand gezogen
 *   ausgewaehlt    accent/surface + accent/border, Mint-Kaestchen links
 *   deaktiviert    offline nicht geladen: Kachel entsaettigt, Text tertiaer,
 *                  Metazeile mit `cloud-slash` + "nicht geladen"
 *
 * Deaktiviert ist ein Farbwechsel, nie Deckkraft — 40 % Deckkraft druecken den
 * Kontrast unter 4.5:1.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, border, iconSize, radius, size, space, text as textColor } from '../theme';
import type { DocType } from '../theme/tile';
import { DocTile } from './DocTile';
import { Check, CheckCircle, Circle, CloudSlash, Star, type Icon } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface DocRowProps {
  id: string;
  title: string;
  type: DocType;
  /** Metazeile, Format "vor 3 Tagen · 240 KB". Immer mit Tabellenziffern. */
  meta: string;
  /** Ersetzt das Standard-Icon der Metazeile (Papierkorb: Restfrist mit `warning`). */
  metaIcon?: Icon;
  /**
   * Workflow-Status. Das Icon steht rechts vor dem Stern und ist **kein**
   * eigenes Beruehrungsziel — es zeigt nur an; gesetzt wird der Status ueber
   * die Wischgeste, das Kontextmenue oder die Auswahlleiste.
   */
  unread?: boolean;
  favorite?: boolean;
  /**
   * Der Stern ist ein eigenes 48-x-48-Ziel und kostet die Zeile entsprechend
   * Breite. Im Papierkorb (Blatt `6a`) steht dort "Wiederherstellen", und
   * Favorisieren waere an einem geloeschten Dokument ohnehin sinnlos — dann
   * gehoert der Platz der Metazeile.
   */
  showFavorite?: boolean;
  /** Offline nicht geladen: die Zeile bleibt sichtbar, ist aber nicht zu oeffnen. */
  unavailable?: boolean;
  /** Papierkorb: Kachel gedaempft, Titel in text/secondary. */
  muted?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  /** Letzte Zeile einer Liste traegt keine Trennlinie. */
  last?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onToggleFavorite?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * 64 Zeilenhoehe abzueglich der 44er Kachel ergibt 10 oben und unten. Der
 * immer vorhandene (im Ruhezustand durchsichtige) 1-px-Rahmen zaehlt mit,
 * damit die Zeile beim Auswaehlen nicht um 2 waechst.
 */
const VERTICAL_PADDING = (size.rowHeight - size.tileSmall) / 2 - 1;

export function DocRow({
  id,
  title,
  type,
  meta,
  metaIcon,
  unread,
  favorite = false,
  showFavorite = true,
  unavailable = false,
  muted = false,
  selectionMode = false,
  selected = false,
  last = false,
  onPress,
  onLongPress,
  onToggleFavorite,
  style,
}: DocRowProps) {
  const MetaIcon = metaIcon ?? (unavailable ? CloudSlash : undefined);
  const metaText = unavailable && !metaIcon ? 'nicht geladen' : meta;
  const tileState = unavailable ? 'unavailable' : muted ? 'trashed' : 'default';
  const titleTone = unavailable ? 'tertiary' : muted ? 'secondary' : 'primary';
  const metaTone = unavailable ? 'tertiary' : 'secondary';

  return (
    <View style={[styles.container, style]}>
      <PressableScale
        style={[styles.row, selected && styles.rowSelected]}
        pressedStyle={styles.rowPressed}
        // Die Zeile selbst skaliert nicht: sie liegt in einer Liste, und der
        // Sprung waere neben den Nachbarzeilen unruhig. Der Flaechenwechsel
        // zeigt den Druck.
        scaleOnPress={false}
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={unavailable && !selectionMode}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${unavailable ? 'Nicht geladen' : metaText}.${
          unread === undefined ? '' : unread ? ' Ungelesen.' : ' Gelesen.'
        }`}
        accessibilityState={{ selected, disabled: unavailable }}
      >
        {selectionMode ? (
          <View style={[styles.checkbox, selected ? styles.checkboxOn : styles.checkboxOff]}>
            {selected ? <Check size={16} color={accent.on} weight="bold" /> : null}
          </View>
        ) : null}

        <DocTile id={id} type={type} variant="row" state={tileState} />

        <View style={styles.body}>
          <Text variant="body" tone={titleTone} numberOfLines={2} style={styles.title}>
            {title}
          </Text>
          <View style={styles.metaRow}>
            {MetaIcon ? <MetaIcon size={14} color={textColor[metaTone]} weight="regular" /> : null}
            <Text variant="caption" tone={metaTone} numeric numberOfLines={1}>
              {metaText}
            </Text>
          </View>
        </View>

        {unread !== undefined && !selectionMode ? (
          unread ? (
            <Circle size={iconSize.sm} color={accent.base} weight="fill" />
          ) : (
            <CheckCircle size={iconSize.sm} color={textColor.tertiary} weight="regular" />
          )
        ) : null}

        {!selectionMode && showFavorite ? (
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
              color={favorite ? accent.base : unavailable ? border.strong : textColor.tertiary}
            />
          </PressableScale>
        ) : null}
      </PressableScale>

      {last || selected ? null : <View style={styles.divider} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    // Die gedrueckte Flaeche zieht 8 ueber den Seitenrand hinaus; der Inhalt
    // steht durch denselben Innenabstand wieder auf dem Seitenrand.
    marginHorizontal: -size.rowOverhang,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    minHeight: size.rowHeight,
    paddingVertical: VERTICAL_PADDING,
    paddingHorizontal: size.rowOverhang,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowPressed: {
    backgroundColor: bg.surface,
  },
  rowSelected: {
    backgroundColor: accent.surface,
    borderColor: accent.border,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    // Zwei Zeilen `body` (16/24); danach schneidet numberOfLines ab.
    maxHeight: space['48'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'] + space['2'],
    marginTop: space['2'],
  },
  starTarget: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
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
    // Auch nicht gewaehlte Zeilen zeigen ein Kaestchen, damit erkennbar
    // bleibt, dass sie auswaehlbar sind.
    borderWidth: 2,
    borderColor: border.strong,
  },
  divider: {
    height: 1,
    backgroundColor: border.subtle,
    marginHorizontal: size.rowOverhang,
  },
});
