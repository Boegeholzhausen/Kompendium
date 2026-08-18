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
 * Links im Dokument (`onShouldStartLoadWithRequest`): die WebView zeigt genau
 * ein Dokument und navigiert nie weiter. Drei Faelle:
 *
 *   about:          durchlassen — das ist die Seite selbst. Auch ein Anker
 *                   (`about:blank#kapitel-3`) laeuft hier durch, sonst waere
 *                   das Inhaltsverzeichnis eines eigenen Dokuments tot.
 *   http(s):        nach draussen an den Systembrowser (`expo-linking`) und
 *                   `false` zurueckgeben. Das Dokument bleibt stehen, wo es
 *                   steht; die Leseposition geht nicht verloren.
 *   alles andere    blocken (`data:`, `javascript:`, `file:`, Unbekanntes).
 *                   Ein fremdes Schema hat in einem selbstgebauten Dokument
 *                   nichts zu suchen, und ein Fehlgriff waere hier still.
 *
 * Vorher galt `request.url.startsWith('about:')` fuer alles — jeder externe
 * Link war damit stumm wirkungslos.
 *
 * ## Suchen im geoeffneten Dokument (D2)
 *
 * `react-native-webview` in der hier gepinnten Fassung **13.16.1** hat keine
 * Suchschnittstelle: weder `findInPage` noch das alte `findAll`/`clearMatches`
 * der RN-Kern-WebView kommen im Paket vor (nachgesehen in `node_modules`, in
 * Quelle, Typen und der Android-Umsetzung — kein Treffer). Uebrig bleibt der
 * Weg ueber `injectJavaScript` und `window.find(...)`, das die Android-WebView
 * als Chromium-Baustein mitbringt.
 *
 * Das passt hier sogar besser als eine eigene Umsetzung: `window.find` setzt
 * die **Auswahl** des Dokuments, und die zeichnet die WebView selbst. Es wird
 * also kein Stylesheet eingespritzt, das die Gestaltung des fremden Dokuments
 * anfasst — dieselbe Regel wie bei der Textgroesse.
 *
 * Die Zahl der Fundstellen ("3 / 17") kennt `window.find` nicht; sie wird im
 * Dokument einmal ueber `innerText` gezaehlt. Bei Fundstellen, die ueber eine
 * Element-Grenze laufen, koennen sich Zaehlung und Auswahl um einen Treffer
 * unterscheiden — dafuer kostet die Zaehlung keinen zweiten Durchlauf durch
 * das DOM.
 *
 * Fuer den Web-Export gibt es `DocumentView.web.tsx`: `react-native-webview`
 * hat auf Web keine Umsetzung und zeichnet dort nur einen Hinweis. Da der
 * Web-Build allein der Bildkontrolle gegen den Prototyp dient, uebernimmt
 * dort ein `iframe` dieselbe Aufgabe. Die Suche im Dokument gibt es dort
 * nicht: ein fremdes `iframe` laesst sich von aussen nicht durchsuchen.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { openURL } from 'expo-linking';
import { WebView, type WebViewProps } from 'react-native-webview';

import { bg, documentCanvas, duration, easingNative, overlay } from '../../theme';

/**
 * Ein Auftrag an die Suche in der WebView. Die `id` zaehlt hoch und ist der
 * Ausloeser — sonst liesse sich "weiter" nicht zweimal hintereinander mit
 * denselben Angaben schicken.
 */
export interface FindCommand {
  id: number;
  kind: 'search' | 'next' | 'previous' | 'clear';
  term: string;
}

/** Was die WebView zurueckmeldet: Zahl der Fundstellen und die aktuelle. */
export interface FindState {
  total: number;
  /** 1-basiert; 0 heisst "keine Fundstelle". */
  index: number;
}

/**
 * Der Auftrag als eingespritztes Skript. Steht als Zeichenkette hier und nicht
 * in einer eigenen Datei, weil er nur zusammen mit dieser WebView Sinn ergibt.
 */
function findScript(command: FindCommand): string {
  return `(function () {
  var report = function (total, index) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ kind: 'find', total: total, index: index })
      );
    }
  };
  var selection = window.getSelection ? window.getSelection() : null;
  var kind = ${JSON.stringify(command.kind)};
  var term = ${JSON.stringify(command.term)};
  var state = window.__kompendiumFind || { term: '', total: 0, index: 0 };

  if (kind === 'clear' || !term) {
    if (selection) selection.removeAllRanges();
    window.__kompendiumFind = { term: '', total: 0, index: 0 };
    report(0, 0);
    return;
  }

  if (kind === 'search' || state.term !== term) {
    var body = document.body;
    var haystack = (body ? (body.innerText || body.textContent || '') : '').toLowerCase();
    var needle = term.toLowerCase();
    var total = 0;
    var at = haystack.indexOf(needle);
    while (at !== -1) {
      total += 1;
      at = haystack.indexOf(needle, at + needle.length);
    }
    if (selection) selection.removeAllRanges();
    state = { term: term, total: total, index: 0 };
    window.__kompendiumFind = state;
    if (total > 0 && window.find && window.find(term, false, false, true, false, false, false)) {
      state.index = 1;
    }
    report(state.total, state.index);
    return;
  }

  if (state.total === 0) {
    report(0, 0);
    return;
  }
  var backwards = kind === 'previous';
  if (window.find) window.find(term, false, backwards, true, false, false, false);
  state.index = backwards
    ? ((state.index - 2 + state.total) % state.total) + 1
    : (state.index % state.total) + 1;
  window.__kompendiumFind = state;
  report(state.total, state.index);
})(); true;`;
}

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
  /** Ein externer Link, den das System nicht oeffnen konnte. */
  onExternalLinkFailed?: (url: string) => void;
  /** Suchen im Dokument (D2); jede neue `id` fuehrt den Auftrag aus. */
  find?: FindCommand | null;
  onFindResult?: (state: FindState) => void;
}

export function DocumentView({
  html,
  initialOffset = 0,
  textScale = 1,
  dim = false,
  onScroll,
  onLoaded,
  onExternalLinkFailed,
  find = null,
  onFindResult,
}: DocumentViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const webRef = useRef<WebView>(null);

  /**
   * Der Auftrag geht erst nach `onLoadEnd` hinaus — vorher gibt es im
   * Dokument nichts zu finden, und ein Skript im leeren Baum meldete null
   * Fundstellen zurueck.
   */
  useEffect(() => {
    if (find === null || !ready) return;
    webRef.current?.injectJavaScript(findScript(find));
  }, [find, ready]);

  /**
   * Die WebView meldet ihr Scroll-Ereignis in der Form, die der native
   * Baustein liefert; nach aussen geht nur der Versatz.
   */
  const handleWebViewScroll: WebViewProps['onScroll'] = (event) => {
    onScroll?.(event.nativeEvent.contentOffset.y);
  };

  /** Siehe Kopfkommentar: durchlassen, nach draussen geben oder blocken. */
  const handleRequest: WebViewProps['onShouldStartLoadWithRequest'] = (request) => {
    const url = request.url;
    if (url.startsWith('about:')) return true;
    if (url.startsWith('http:') || url.startsWith('https:')) {
      openURL(url).catch(() => onExternalLinkFailed?.(url));
    }
    return false;
  };

  /** Einzige Nachricht aus dem Dokument: das Ergebnis der Suche. */
  const handleMessage: WebViewProps['onMessage'] = (event) => {
    try {
      const payload: unknown = JSON.parse(event.nativeEvent.data);
      if (
        payload !== null &&
        typeof payload === 'object' &&
        (payload as { kind?: unknown }).kind === 'find'
      ) {
        const { total, index } = payload as { total: unknown; index: unknown };
        if (typeof total === 'number' && typeof index === 'number') {
          onFindResult?.({ total, index });
        }
      }
    } catch {
      // Ein eigenes Dokument darf `postMessage` fuer sich selbst benutzen.
      // Was die App nicht versteht, geht sie nichts an.
    }
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
          ref={webRef}
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
          onShouldStartLoadWithRequest={handleRequest}
          onLoadEnd={reveal}
          onMessage={handleMessage}
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
