/**
 * Hinweisstreifen unter der Kopfzeile — Blatt `4c`, Screen 21.
 *
 * 36 hoch, Linien oben und unten. Er **ersetzt** den 2-px-Sync-Indikator
 * (Komponente 15), statt sich darunter zu stapeln: "zwei Leisten uebereinander
 * waeren ein Bruch". Genau deshalb liegt er auch nicht in einem eigenen
 * Screen-Bereich, sondern an derselben Stelle im Kopf — der Aufrufer zeigt
 * entweder das eine oder das andere.
 *
 *   offline   `bg/raised`, `wifi-slash` + "Offline — 12 Dokumente verfügbar"
 *             in `text/secondary`. Neutral, weil Offline kein Fehler ist.
 *   error     `semanticSurface/warning`, `warning` in `fill` + Text in
 *             `warning`, rechts "Wiederholen" als Mint-Textbutton.
 *
 * Farbe traegt nie allein die Bedeutung: beide Zustaende haben ihr eigenes
 * Icon UND ihren eigenen Satz.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { bg, border, iconSize, semantic, semanticSurface, size, space, text as textColor } from '../theme';
import { TextButton } from './Button';
import { Warning, WifiSlash } from './icons';
import { Text } from './Text';

export type NoticeKind = 'offline' | 'error';

export interface NoticeStripProps {
  kind: NoticeKind;
  message: string;
  /** Nur beim Sync-Fehler: "Wiederholen". Offline gibt es nichts zu wiederholen. */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function NoticeStrip({ kind, message, actionLabel, onAction, style }: NoticeStripProps) {
  const isError = kind === 'error';
  const Icon = isError ? Warning : WifiSlash;
  const tint = isError ? semantic.warning : textColor.secondary;

  return (
    <View
      style={[
        styles.strip,
        isError ? styles.error : styles.offline,
        // Die Schaltflaeche bringt ihren eigenen Innenabstand mit; ohne sie
        // steht der Text auf dem Seitenrand.
        actionLabel === undefined ? styles.padded : styles.paddedWithAction,
        style,
      ]}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      {/*
        Die Fehlerflaeche ist 14 % `warning` und damit durchsichtig. Der
        Streifen schwebt aber ueber der Liste — ohne deckende Unterlage
        scrollen die Zeilen sichtbar durch ihn hindurch. `bg/surface` ist
        dieselbe Unterlage, die auch die Spur des Sync-Indikators traegt, den
        er ersetzt.
      */}
      {isError ? <View style={styles.errorTint} /> : null}

      <Icon size={iconSize.sm} color={tint} weight={isError ? 'fill' : 'regular'} />
      <Text variant="label" numeric numberOfLines={1} style={[styles.message, { color: tint }]}>
        {message}
      </Text>
      {actionLabel !== undefined ? (
        // Kompakt: die 36 des Streifens tragen keine 48-dp-Schaltflaeche, das
        // Ziel entsteht ueber hitSlop (dieselbe Loesung wie bei den Chips).
        <TextButton compact label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: size.noticeStripHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: border.subtle,
    borderBottomColor: border.subtle,
  },
  offline: {
    backgroundColor: bg.raised,
  },
  error: {
    backgroundColor: bg.surface,
  },
  errorTint: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: semanticSurface.warning,
  },
  padded: {
    paddingHorizontal: size.screenPadding,
  },
  paddedWithAction: {
    paddingLeft: size.screenPadding,
    paddingRight: space['8'],
  },
  message: {
    flex: 1,
    // Ohne das draengt der Text die Schaltflaeche aus dem Bild (Web-Export).
    minWidth: 0,
  },
  action: {
    paddingHorizontal: space['12'],
  },
});
