import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { bg } from '../src/theme/colors';
import { useAppFonts } from '../src/theme/fonts';

export default function RootLayout() {
  const fontsReady = useAppFonts();

  // Buehne bleibt auf bg/base, bis die Schrift steht — kein Aufblitzen,
  // kein Vollbild-Spinner.
  if (!fontsReady) {
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
