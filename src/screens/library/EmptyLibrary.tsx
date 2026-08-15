/**
 * Screen 19 — leere Bibliothek beim Erststart (Blatt `4a`).
 *
 * Die Zeichnung ist ein leeres Regal aus denselben Flaechen und Linien wie die
 * App selbst: Bodenplatte in `bg/raised`, vier "Baende" in `bg/surface`, alle
 * mit 1 px `border/subtle`, einer um 6 Grad gekippt. Keine Illustration mit
 * eigener Bildsprache — die App hat keine, und ein leerer Screen ist der
 * schlechteste Ort, eine einzufuehren.
 *
 * Darunter drei Zeilen und genau eine Aktion. Der FAB entfaellt (der Aufrufer
 * blendet ihn aus): er traegt dieselbe Aktion, und zwei Wege zum selben Ziel
 * waeren auf einem sonst leeren Bild besonders auffaellig.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { bg, border, emptyShelf, space } from '../../theme';
import { PrimaryButton } from '../../ui/Button';
import { Text } from '../../ui/Text';

export function EmptyLibrary({ onImport }: { onImport: () => void }) {
  return (
    <View style={styles.screen}>
      <Shelf />

      <Text variant="titleLg" style={styles.centered}>
        Noch keine Dokumente
      </Text>
      <Text variant="body" tone="secondary" style={styles.centered}>
        HTML-Dateien vom Gerät, aus der Zwischenablage oder von einer Adresse landen hier und
        bleiben offline lesbar.
      </Text>

      <PrimaryButton label="Erstes Dokument importieren" onPress={onImport} style={styles.action} />
    </View>
  );
}

/** Nur Dekoration — fuer die Vorlesefunktion gibt es hier nichts zu sagen. */
function Shelf() {
  return (
    <View style={styles.shelf} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.plate} />
      {emptyShelf.volumes.map((volume) => (
        <View
          key={volume.left}
          style={[
            styles.volume,
            {
              left: volume.left,
              height: volume.height,
              // Der gekippte Band traegt die staerkere Linie (Blatt `4a`):
              // schraeg gegen den Nachbarn braucht die Kante etwas mehr Halt.
              borderColor: 'tilt' in volume ? border.strong : border.subtle,
              // Gekippt wird um die Unterkante, nicht um die Mitte: ein Band
              // steht auf dem Brett, es schwebt nicht darueber. React Native
              // kennt keinen transform-origin — die beiden Verschiebungen
              // holen ihn nach.
              transform:
                'tilt' in volume
                  ? [
                      { translateY: volume.height / 2 },
                      { rotate: volume.tilt },
                      { translateY: -volume.height / 2 },
                    ]
                  : undefined,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['32'],
    gap: space['20'],
  },
  centered: {
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
  },
  shelf: {
    width: emptyShelf.width,
    height: emptyShelf.height,
  },
  plate: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: emptyShelf.width,
    height: emptyShelf.plateHeight,
    borderRadius: emptyShelf.radius,
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  volume: {
    position: 'absolute',
    bottom: emptyShelf.plateHeight,
    width: emptyShelf.volumeWidth,
    borderRadius: emptyShelf.radius,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.subtle,
  },
});
