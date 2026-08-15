/**
 * Die Dokumentflaeche des Viewers — eine WebView mit lokalem HTML.
 *
 * Sie meldet zwei Dinge nach oben: den Scrollversatz (daraus entsteht das
 * Aus- und Einblenden der Bedienung) und den Ladeabschluss. Die Buehne bleibt
 * bis dahin auf `bg/base`, damit kein weisses Bild aufblitzt — deshalb liegt
 * die WebView selbst zunaechst durchsichtig darueber.
 *
 * Zwei Einstellungen aus "Darstellung" (Blatt `6b`) wirken hier:
 *
 *   textScale   ueber `textZoom` der WebView — die **Textzoom-Funktion des
 *               Systems**, nicht ein Stylesheet der App. Das ist der
 *               entscheidende Unterschied: "echte Nutzerdokumente bringen ihre
 *               eigene Gestaltung mit; die App gestaltet dort nichts". Ein
 *               eingespritztes `font-size` waere genau das verbotene fremde
 *               Stylesheet.
 *   dim         ein Overlay in `overlay.dimDocument` (rgba(0,0,0,0.18)), keine
 *               Farbinvertierung — invertierte Diagramme werden unlesbar. So
 *               steht es als Umsetzungsvorschlag im Handoff-Dokument.
 *
 * `textZoom` gibt es nur unter Android. Das Projekt ist Android-first; unter
 * iOS braeuchte es dafuer eingespritztes `-webkit-text-size-adjust`, was der
 * naechste Schritt in Richtung fremdes Stylesheet waere und deshalb eine eigene
 * Entscheidung verlangt.
 *
 * Fuer den Web-Export gibt es `DocumentView.web.tsx`: `react-native-webview`
 * hat auf Web keine Umsetzung und zeichnet dort nur einen Hinweis. Da der
 * Web-Build allein der Bildkontrolle gegen den Prototyp dient, uebernimmt
 * dort ein `iframe` dieselbe Aufgabe.
 */
import React, { useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { WebView, type WebViewProps } from 'react-native-webview';

import { bg, documentCanvas, duration, easingNative, overlay } from '../../theme';

export interface DocumentViewProps {
  /** Vollstaendige HTML-Seite. */
  html: string;
  /** Leseposition beim Oeffnen, in dp. */
  initialOffset?: number;
  /** Textgroesse aus "Darstellung", 0.9 bis 1.5. */
  textScale?: number;
  /** "Dokumente abdunkeln" aus "Darstellung". */
  dim?: boolean;
  onScroll?: (offset: number) => void;
  onLoaded?: () => void;
}

export function DocumentView({
  html,
  initialOffset = 0,
  textScale = 1,
  dim = false,
  onScroll,
  onLoaded,
}: DocumentViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  /**
   * Die WebView meldet ihr Scroll-Ereignis in der Form, die der native
   * Baustein liefert; nach aussen geht nur der Versatz.
   */
  const handleWebViewScroll: WebViewProps['onScroll'] = (event) => {
    onScroll?.(event.nativeEvent.contentOffset.y);
  };

  const reveal = () => {
    if (ready) return;
    setReady(true);
    onLoaded?.();
    Animated.timing(opacity, {
      toValue: 1,
      duration: duration.micro,
      easing: easingNative.micro,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.fill, { opacity }]}>
        <WebView
          source={{ html }}
          style={styles.web}
          // Die weisse Flaeche blitzt beim Laden nicht auf, weil die ganze
          // Ebene erst nach `onLoadEnd` eingeblendet wird — bis dahin steht
          // die Buehne in `bg/base` (Screen 5).
          containerStyle={styles.canvas}
          originWhitelist={['*']}
          // Eigene Dokumente, kein fremder Code: Skripte laufen, Navigation
          // nach aussen bleibt aus.
          javaScriptEnabled
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => request.url.startsWith('about:')}
          onLoadEnd={reveal}
          onScroll={handleWebViewScroll}
          // Leseposition wiederherstellen, bevor das Bild sichtbar wird.
          injectedJavaScript={`window.scrollTo(0, ${Math.round(initialOffset)}); true;`}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          allowsBackForwardNavigationGestures={false}
          // Android: der Textzoom des Systems, in Prozent.
          textZoom={Math.round(textScale * 100)}
        />
      </Animated.View>

      {/*
        Ueber dem Dokument, aber ohne es zu greifen: gescrollt und getippt wird
        weiter in der Seite darunter.
      */}
      {dim ? <View style={styles.dim} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: bg.base,
  },
  fill: {
    flex: 1,
  },
  web: {
    flex: 1,
    backgroundColor: documentCanvas,
  },
  canvas: {
    backgroundColor: documentCanvas,
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: overlay.dimDocument,
  },
});
