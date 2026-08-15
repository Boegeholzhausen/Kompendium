/**
 * Kopfzeile im Auswahlmodus (Blatt `3h`).
 *
 * `bg/surface` mit 1 px `border/subtle` unten, "3 ausgewaehlt" als `title` mit
 * Tabellenziffern, "Abbrechen" als Mint-Textbutton. Sie ersetzt den
 * kollabierenden Kopf der Bibliothek per Crossfade in 220 ms — **ohne**
 * Layoutversatz: die Liste behaelt ihren oberen Innenabstand, nur die Ebene
 * darueber wechselt.
 *
 * Tabellenziffern sind hier keine Kosmetik: die Zahl aendert sich bei jedem
 * Tipp, und ohne sie wackelte das Wort daneben.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { bg, border, duration, easingNative, size, space } from '../../theme';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { TextButton } from '../../ui/Button';
import { Text } from '../../ui/Text';

export interface SelectionHeaderProps {
  visible: boolean;
  count: number;
  top: number;
  onCancel: () => void;
}

export function SelectionHeader({ visible, count, top, onCancel }: SelectionHeaderProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(visible ? 1 : 0);
      return;
    }
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: duration.standard,
      easing: easingNative.standard,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity, reduceMotion]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.layer, { top, opacity }]}>
      <View style={styles.bar}>
        <Text variant="title" numeric style={styles.count}>
          {`${count} ausgewählt`}
        </Text>
        <TextButton label="Abbrechen" onPress={onCancel} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: size.headerCompactHeight,
    paddingLeft: size.screenPadding,
    paddingRight: space['12'],
    backgroundColor: bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  count: {
    flex: 1,
  },
});
