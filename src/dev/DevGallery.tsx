/**
 * Vorlaeufige Huelle um die Abnahmeblaetter.
 *
 * Ersetzt in Schritt 4 durch die Tab-Navigation; die Blaetter bleiben danach
 * ueber die Einstellungen erreichbar. Der Umschalter ist Werkzeug, kein
 * Produktions-UI — haelt sich aber an dieselben Regeln (48 dp, Tokens).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accent, bg, border, radius, size, space } from '../theme';
import { Text } from '../ui/Text';
import { ComponentSheet } from './ComponentSheet';
import { TileSheet } from './TileSheet';
import { TokenSheet } from './TokenSheet';

const sheets = [
  { key: 'tokens', label: 'Tokens' },
  { key: 'tiles', label: 'Kacheln' },
  { key: 'components', label: 'Komponenten' },
] as const;

type SheetKey = (typeof sheets)[number]['key'];

const sheetViews: Record<SheetKey, () => React.ReactElement> = {
  tokens: TokenSheet,
  tiles: TileSheet,
  components: ComponentSheet,
};

export function DevGallery() {
  const [active, setActive] = useState<SheetKey>('components');
  const insets = useSafeAreaInsets();
  const ActiveSheet = sheetViews[active];

  return (
    <View style={styles.screen}>
      <View style={styles.sheet}>
        <ActiveSheet />
      </View>

      <View style={[styles.switcher, { paddingBottom: insets.bottom + space['8'] }]}>
        {sheets.map((sheet) => {
          const isActive = sheet.key === active;
          return (
            <Pressable
              key={sheet.key}
              onPress={() => setActive(sheet.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Blatt ${sheet.label}`}
              style={({ pressed }) => [
                styles.segment,
                isActive && styles.segmentActive,
                pressed && styles.segmentPressed,
              ]}
            >
              <Text variant="label" tone={isActive ? 'accent' : 'secondary'}>
                {sheet.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  sheet: {
    flex: 1,
  },
  switcher: {
    flexDirection: 'row',
    gap: space['8'],
    paddingHorizontal: size.screenPadding,
    paddingTop: space['8'],
    backgroundColor: bg.surface,
    borderTopWidth: 1,
    borderTopColor: border.subtle,
  },
  segment: {
    flex: 1,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: border.subtle,
    backgroundColor: bg.raised,
  },
  segmentActive: {
    backgroundColor: accent.surface,
    borderColor: accent.border,
  },
  segmentPressed: {
    backgroundColor: bg.overlay,
    borderColor: border.strong,
  },
});
