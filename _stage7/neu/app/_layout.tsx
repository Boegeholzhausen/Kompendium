/**
 * Wurzel der App.
 *
 * Zwei Dinge muessen stehen, bevor der erste Screen erscheint: die Schrift und
 * die lokale Datenbank. Die Buehne bleibt so lange auf `bg/base` — kein
 * Aufblitzen, kein Vollbild-Spinner. Der Ladezustand der Liste (Blatt `4b`)
 * ist etwas anderes und kommt in Schritt 8; hier geht es um die Sekunde vor
 * dem ersten Bild.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { hydrateStores } from '../src/state/hydrate';
import { bg } from '../src/theme/colors';
import { useAppFonts } from '../src/theme/fonts';

export default function RootLayout() {
  const fontsReady = useAppFonts();
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    let alive = true;
    hydrateStores().then(() => {
      if (alive) setDataReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!fontsReady || !dataReady) {
    return <View style={{ flex: 1, backgroundColor: bg.base }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: bg.base }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: bg.base },
            animation: 'slide_from_right',
          }}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
