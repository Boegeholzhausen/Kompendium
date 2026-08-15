/**
 * Regler — aus "Textgroesse im Viewer" (Blatt `6b`).
 *
 * Spur 4 px in `bg/raised`, Fuellung `accent`, Knopf 24 mit 3 px Ring in
 * `bg/surface`. Keine eigene Nummer im Komponenten-Inventar; das Blatt
 * beschreibt ihn aber bis auf den Punkt, und ausser ihm gibt es in der App
 * nichts, was auf einer Skala steht.
 *
 * Gebaut mit `PanResponder` statt einer fremden Bibliothek: der Regler hat
 * genau eine Aufgabe, und ein Paket dafuer waere mehr Abhaengigkeit als Code.
 * Die Geste laeuft im JavaScript-Faden — bei einem Wert, der in Fuenferschritten
 * rastet, faellt das nicht auf.
 *
 * Die Spur ist 4 hoch, das Beruehrungsziel 48: der Griff bekommt die Hoehe
 * ueber den Rahmen, nicht die Spur ueber ihre Dicke.
 *
 * Barrierefreiheit: `accessibilityRole="adjustable"` mit
 * `accessibilityActions` — mit Sprachausgabe laesst sich der Wert schrittweise
 * aendern, ohne die Geste treffen zu muessen.
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { accent, bg, radius, size } from '../theme';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** Was die Sprachausgabe vorliest, etwa "110 %". */
  accessibilityValueText?: string;
  style?: StyleProp<ViewStyle>;
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  accessibilityLabel,
  accessibilityValueText,
  style,
}: SliderProps) {
  const [width, setWidth] = useState(0);

  /**
   * Breite und Rueckruf stehen in Refs: `PanResponder` wird einmal gebaut und
   * haelt die Funktionen fest, die er beim Bauen bekommen hat. Ohne Refs
   * schoebe der Regler nach dem ersten Zeichnen gegen eine Breite von null.
   */
  const widthRef = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const range = max - min;

  const toValue = (x: number): number => {
    const track = Math.max(1, widthRef.current - size.sliderKnob);
    const share = Math.min(1, Math.max(0, (x - size.sliderKnob / 2) / track));
    const raw = min + share * range;
    const stepped = Math.round(raw / step) * step;
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(4));
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Ein Tipp auf die Spur springt an die Stelle: der Weg ueber "erst
        // greifen, dann ziehen" waere bei einem Wert mit 13 Stufen ein Umweg.
        onPanResponderGrant: (event) => changeRef.current(toValue(event.nativeEvent.locationX)),
        onPanResponderMove: (event) => changeRef.current(toValue(event.nativeEvent.locationX)),
      }),
    // Absicht: genau einmal bauen. Alles Veraenderliche kommt aus den Refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const share = range === 0 ? 0 : (value - min) / range;
  const travel = Math.max(0, width - size.sliderKnob);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    widthRef.current = next;
    setWidth(next);
  };

  return (
    <View
      style={[styles.host, style]}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: accessibilityValueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
        onChange(Number(Math.min(max, Math.max(min, value + delta)).toFixed(4)));
      }}
      {...responder.panHandlers}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: size.sliderKnob / 2 + share * travel }]} />
      </View>
      <View style={[styles.knob, { left: share * travel }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    // Das Beruehrungsziel, nicht die Spur.
    height: size.touchTarget,
    justifyContent: 'center',
  },
  track: {
    height: size.sliderTrack,
    borderRadius: radius.pill,
    backgroundColor: bg.raised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: accent.base,
  },
  knob: {
    position: 'absolute',
    width: size.sliderKnob,
    height: size.sliderKnob,
    borderRadius: radius.pill,
    backgroundColor: accent.base,
    // Der Ring in `bg/surface` trennt den Knopf von der Fuellung darunter —
    // sonst verschwimmen beide zu einem Klumpen.
    borderWidth: size.sliderKnobRing,
    borderColor: bg.surface,
  },
});
