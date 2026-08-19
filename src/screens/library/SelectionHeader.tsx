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
 *
 * **Abweichung von Blatt `3h`:** links neben "Abbrechen" steht ein zweiter
 * Textbutton, "Alle auswaehlen" beziehungsweise "Auswahl aufheben". Ohne
 * Sammelgriff ist Aufraeumen bei ein paar hundert Dokumenten Zeile fuer Zeile
 * Handarbeit. Er wirkt auf die **gerade sichtbare, gefilterte und sortierte
 * Liste**, die der Screen von aussen hereingibt — ein Tipp bei aktivem
 * Favoriten-Filter darf nichts waehlen, was niemand sieht.
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
  /** Ist die sichtbare Liste vollstaendig gewaehlt? (`isAllSelected`) */
  allSelected: boolean;
  onToggleAll: () => void;
  onCancel: () => void;
}

export function SelectionHeader({
  visible,
  count,
  top,
  allSelected,
  onToggleAll,
  onCancel,
}: SelectionHeaderProps) {
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
    <Animated.View style={[styles.layer, { opacity }]}>
      {/*
        Die Statusleisten-Zone gehoert zur Kopfzeile: sie schwebt ueber der
        Liste, und ohne eigene Flaeche scrollte der Inhalt sichtbar durch die
        Safe Area. Dieselbe Farbe wie die Leiste darunter.
      */}
      <View style={[styles.statusPad, { height: top }]} />
      <View style={styles.bar}>
        <Text variant="title" numeric style={styles.count}>
          {`${count} ausgewählt`}
        </Text>
        <View style={styles.buttons}>
          <TextButton
            label={allSelected ? 'Auswahl aufheben' : 'Alle auswählen'}
            onPress={onToggleAll}
          />
          <TextButton label="Abbrechen" onPress={onCancel} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  statusPad: {
    backgroundColor: bg.surface,
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
  buttons: {
    flexDirection: 'row',
    // Mindestabstand zwischen zwei Beruehrungsflaechen (harte Regel).
    gap: size.touchGap,
  },
});
