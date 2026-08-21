/**
 * Wurzel der App.
 *
 * Gewartet wird nur auf die Schrift: ohne sie ist jeder Text ein anderer, und
 * das Layout ruckt beim Nachladen. Auf die Datenbank wartet der Screen
 * dagegen NICHT mehr (Schritt 8) — er zeigt seinen Ladezustand (Blatt `4b`)
 * und tauscht die Skelett-Zeilen gegen die echten, sobald sie da sind. Ein
 * schwarzes Bild waere die schlechtere Antwort auf dieselbe halbe Sekunde,
 * und ein Vollbild-Spinner ist im Handoff-Dokument ausdruecklich
 * ausgeschlossen.
 *
 * Hier haengt auch das Netz-Abonnement (NetInfo): es gilt fuer die ganze App,
 * nicht fuer einen Screen, und muss laufen, bevor der erste Streifen ueber
 * "offline" entscheidet.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { hydrateStores } from '../src/state/hydrate';
import { subscribeNetwork } from '../src/state/network';
import { useSessionStore } from '../src/state/session';
import { useSyncStore } from '../src/state/sync';
import { bg } from '../src/theme/colors';
import { useAppFonts } from '../src/theme/fonts';

export default function RootLayout() {
  const fontsReady = useAppFonts();

  useEffect(() => subscribeNetwork(), []);

  // Lesen, Session nachsehen, abgleichen — alles nebenher, aber in dieser
  // Reihenfolge. Kein Screen wartet darauf, weil kein Screen es braucht: die
  // Bibliothek rendert aus der lokalen Datenbank und tauscht die Zeilen aus,
  // wenn neue da sind (`hydrated` in `state/documents`).
  //
  // Das Hydrieren muss trotzdem VOR dem Abgleich fertig sein, und zwar wegen
  // dessen, was es zuerst tut: die beiden einmaligen Datenwanderungen
  // (`runDataMigrations`). Die erste schreibt Dokumentkennungen um — liefe
  // gleichzeitig ein Push, laese er die Outbox zu Zeilen, die es einen
  // Augenblick spaeter unter anderer Kennung gibt. Und am Ende eines Abgleichs
  // mit Ergebnis liest `reloadStores()` ohnehin neu; ein danach fertig
  // werdendes Hydrieren schriebe seinen aelteren Stand darueber.
  //
  // `restore` legt nie eine Identitaet an. Ist keine Session da, bleibt es
  // dabei, bis sich der Nutzer in den Einstellungen anmeldet — und `sync`
  // meldet das als "Nicht angemeldet" und nicht als Fehler.
  useEffect(() => {
    void (async () => {
      await hydrateStores();
      await useSessionStore.getState().restore();
      await useSyncStore.getState().sync();
    })();
  }, []);

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
