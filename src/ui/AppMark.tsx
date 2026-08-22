/**
 * Die App-Marke im Kopf — das Symbol links neben dem Titel.
 *
 * Quelle ist `assets/adaptive-icon.png`, der Vordergrund des adaptiven
 * Android-Icons. Der traegt sein Motiv nur im inneren 66-%-Kreis, weil Android
 * die Ebene je nach Geraeteform beschneidet. Wuerde man das Bild schlicht auf
 * `appMark` (40 dp) legen, saesse das Motiv verloren in der Mitte. Deshalb
 * wird es mit `appMarkImage` (61 dp, also 40 / 0,66) gerendert und im 40er
 * Feld beschnitten — sichtbar ist dann genau der Kreis, den auch der Launcher
 * zeigt.
 *
 * Die Marke ist kein Druckziel: sie zeigt nur, wo man ist. Ein Ziel unter
 * 48 dp verstiesse gegen die Beruehrungsregel, und 48 wuerde jede Kopfzeile
 * hoeher machen. Fuer die Sprachausgabe ist sie deshalb unsichtbar — der Titel
 * daneben sagt bereits, welcher Screen offen ist.
 */
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { size } from '../theme';

export function AppMark() {
  return (
    <View
      style={styles.field}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Image
        source={require('../../assets/adaptive-icon.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: size.appMark,
    height: size.appMark,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: size.appMarkImage,
    height: size.appMarkImage,
  },
});
