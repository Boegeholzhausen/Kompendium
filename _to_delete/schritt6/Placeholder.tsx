/**
 * Platzhalter fuer die Screens, die noch nicht an der Reihe sind.
 *
 * Die Tab-Bar hat vier Ziele; sie in Schritt 4 zu bauen und dabei drei davon
 * ins Leere laufen zu lassen, waere schlechter als eine ehrliche Auskunft. Der
 * Platzhalter haelt sich an dieselben Regeln wie alles andere: Tokens, 48-dp-
 * Ziele, keine Illustration.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bg, size, space } from '../theme';
import { Text } from '../ui/Text';

export interface PlaceholderProps {
  title: string;
  note: string;
  children?: React.ReactNode;
}

export function Placeholder({ title, note, children }: PlaceholderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space['8'] }]}>
      <View style={styles.header}>
        <Text variant="display">{title}</Text>
      </View>
      <View style={styles.body}>
        <Text variant="body" tone="secondary">
          {note}
        </Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  header: {
    paddingHorizontal: size.screenPadding,
    paddingTop: space['8'],
    paddingBottom: space['12'],
  },
  body: {
    flex: 1,
    paddingHorizontal: size.screenPadding,
    paddingTop: space['24'],
    gap: space['24'],
  },
});
