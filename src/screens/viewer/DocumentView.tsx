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
 *                   `false` zurueckgeben — aber nur, wenn der Nutzer eben
 *                   getippt hat (siehe `handleRequest`). Das Dokument bleibt
 *                   stehen, wo es steht; die Leseposition geht nicht verloren.
 *   alles andere    blocken (`data:`, `javascript:`, `file:`, Unbekanntes).
 *                   Ein fremdes Schema hat in einem selbstgebauten Dokument
 *                   nichts zu suchen, und ein Fehlgriff waere hier still.
 *
 * Vorher galt `request.url.startsWith('about:')` fuer alles — jeder externe
 * Link war damit stumm wirkungslos.
 *
 * ## Was das Dokument nicht darf
 *
 * Sein JavaScript laeuft (das ist der Sinn: Rechner, Diagramme, Klapplisten),
 * aber es kommt nicht ans Netz und nicht aus der App heraus. Zwei Riegel, die
 * zusammengehoeren: `CONTENT_POLICY` nimmt ihm `fetch`, nachgeladene Skripte
 * und fremde Bilder, und `handleRequest` laesst einen Seitenwechsel nur nach
 * einer Beruehrung durch. Lokale Dateien und die Anmeldung waren nie
 * erreichbar — `allowFileAccess` und die beiden `…FromFileURLs` bleiben auf
 * ihren Standardwerten, und das Sitzungstoken liegt in AsyncStorage, wo keine
 * WebView hinsieht.
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
 * ## Zwei-Finger-Tipp auf die Dokumentflaeche
 *
 * Ein kurzer Tipp mit **zwei** Fingern blendet die Bedienung aus und wieder
 * ein (siehe `ViewerScreen`).
 *
 * Warum zwei Finger und nicht einer: Dokumente in dieser App sind selbst
 * bedienbar — Rechner, Klapplisten, Diagramme. Ein Einzeltipp ist dort nicht
 * von einem Bedientipp zu unterscheiden. Ein Filter auf Bedienelemente
 * (`a`, `button`, `[onclick]` …) hilft nicht: haengt ein Dokument seine Klicks
 * per `addEventListener` an ein gewoehnliches `div`, steht davon nichts im
 * Markup, und jeder Bedientipp schaltete zusaetzlich die Viewer-Bedienung um.
 * Chromium erzeugt bei Mehrfinger-Beruehrungen kein `click`; das Dokument
 * sieht die Geste also gar nicht, und die App kommt ihm nicht in die Quere —
 * unabhaengig davon, wie es gebaut ist.
 *
 * Erkannt wird sie **im Dokument**, ueber Listener im eingespritzten Skript,
 * und nicht in React Native: `onStartShouldSetResponderCapture` gibt hier
 * `false` zurueck, die Ebene wird deshalb nie Responder und sieht kein
 * `touchend` — von aussen sind Tipp und Wisch damit nicht zu trennen. Im
 * Dokument gibt es beides: `touchstart`, `touchmove` und `touchend` in
 * derselben Folge.
 *
 * Die Listener haengen in der **Capture-Phase** am `window`, sonst schnitte
 * ein Dokument mit eigenem `stopPropagation` die Erkennung ab. Was nicht
 * zaehlt: eine Geste mit einem oder mehr als zwei Fingern, mehr als
 * `TAP_SLOP_PX` Weg (ein Wisch, und damit auch jedes Auf- und Zuziehen) und
 * laenger als `TAP_MAX_MS` ab dem ersten Finger.
 *
 * Fuer den Web-Export gibt es `DocumentView.web.tsx`: `react-native-webview`
 * hat auf Web keine Umsetzung und zeichnet dort nur einen Hinweis. Da der
 * Web-Build allein der Bildkontrolle gegen den Prototyp dient, uebernimmt
 * dort ein `iframe` dieselbe Aufgabe. Die Suche im Dokument gibt es dort
 * nicht: ein fremdes `iframe` laesst sich von aussen nicht durchsuchen — und
 * `onTwoFingerTap` bleibt dort aus demselben Grund ungenutzt.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * Das Dokument wollte von sich aus nach draussen — ohne dass jemand getippt
   * hat. Der Viewer sagt es, statt es stumm zu verschlucken: ein Dokument, das
   * das versucht, sollte man kennen.
   */
  onExternalLinkBlocked?: (url: string) => void;
  /** Kurzer Tipp mit zwei Fingern auf das Dokument — schaltet die Bedienung um. */
  onTwoFingerTap?: () => void;
  /** Suchen im Dokument (D2); jede neue `id` fuehrt den Auftrag aus. */
  find?: FindCommand | null;
  onFindResult?: (state: FindState) => void;
}

/**
 * Wie lange ein Fingertipp als Grund fuer einen Seitenwechsel gilt.
 *
 * Siehe `handleRequest`: die Android-Fassung von `react-native-webview` reicht
 * kein `isUserGesture` durch, deshalb dieser Fensterwert.
 */
const USER_GESTURE_MS = 2000;

/** Wieviel der Finger wandern darf, bevor aus dem Tipp ein Wisch wird. */
const TAP_SLOP_PX = 10;

/**
 * Wie lange die Geste dauern darf, bevor sie kein kurzer Tipp mehr ist.
 *
 * Die Uhr laeuft ab dem ERSTEN Finger, und zwei Finger landen selten
 * gleichzeitig — mit 300 ms fiele eine ganz normale Geste durch.
 */
const TAP_MAX_MS = 400;

/**
 * Die Inhaltsrichtlinie, die jedem Dokument vorangestellt wird.
 *
 * Ein Dokument in dieser WebView fuehrt sein eigenes JavaScript aus — das ist
 * Absicht und der Sinn der App (Rechner, Diagramme, Klapplisten). Was es nicht
 * darf, ist das Geraet verlassen: ohne Richtlinie stehen `fetch`,
 * `XMLHttpRequest`, fremde Bilder und nachgeladene Skripte offen, und ein
 * Dokument koennte seinen Inhalt an einen beliebigen Server schicken. Fuer
 * Dokumente vom eigenen PC ist das unwahrscheinlich; "Von URL laden" holt
 * aber fremdes HTML aus dem Netz, und dort ist es genau die Frage.
 *
 * Was erlaubt bleibt, ist alles, was ein selbstgebautes Dokument braucht:
 *
 *   script-src  'unsafe-inline'  eigene Skripte im Dokument — der Rechner
 *   style-src   'unsafe-inline'  eigene Gestaltung im Dokument
 *   img-src     data:            eingebettete Bilder und Diagramme
 *   font-src    data:            eingebettete Schriften
 *   blob: data:                  selbstentpackende Buendel (siehe unten)
 *
 * Manche Dokumente sind selbstentpackend: ein Ladeskript im Kopf erzeugt aus
 * eingebetteten Daten `blob:`-URLs und haengt sie als `<script src="blob:…">`,
 * `<link href="blob:…">` oder `<iframe src="blob:…">` wieder ins Dokument.
 * Ohne `blob:`/`data:` in den betroffenen Direktiven erscheint das Markup, die
 * Laufzeit dahinter nie — Platzhalter bleiben als Text stehen, Bedienelemente
 * reagieren nicht.
 *
 * `blob:` und `data:` sind Adressen auf Daten im Dokument selbst und haben
 * keinen Weg ins Netz. Sie aendern deshalb nichts am Sinn der Richtlinie: was
 * hier laeuft, hat das Dokument selbst mitgebracht.
 *
 * Was faellt, ist weiterhin ausschliesslich der Weg nach draussen —
 * `<script src="https://…">`, fremde Bilder, `fetch` an fremde Server.
 * `default-src 'none'` bleibt als Grundlage stehen; keine Direktive nennt
 * `http:` oder `https:`. Ein Dokument, das seine Bibliothek per
 * `<script src="https://…">` nachlaedt, funktioniert danach nicht mehr — es
 * haette ohne Netz aber ohnehin nie funktioniert, und eine Bibliothek, die
 * offline liegt, ist der Sinn dieser App.
 *
 * Ein `<meta>` dieser Art gilt erst ab der Stelle, an der es steht, und muss
 * deshalb so frueh wie moeglich in den Kopf. VOR den Doctype darf es dabei
 * nicht: der muss als Erstes stehen, sonst schaltet der Browser in den
 * Quirks-Modus und stellt das Dokument anders dar — genau der Eingriff in
 * fremde Gestaltung, den die App sich sonst ueberall verbietet.
 */
const CONTENT_POLICY =
  `<meta http-equiv="Content-Security-Policy" content="` +
  `default-src 'none'; ` +
  `script-src 'unsafe-inline' 'unsafe-eval' blob: data:; ` +
  `style-src 'unsafe-inline' blob: data:; ` +
  `img-src data: blob:; ` +
  `font-src data: blob:; ` +
  `media-src data: blob:; ` +
  `connect-src blob: data:; ` +
  `worker-src blob:; ` +
  `frame-src blob: data:; ` +
  `child-src blob: data:` +
  `">`;

/**
 * Die Richtlinie an die frueheste richtige Stelle im Dokument setzen.
 *
 * Drei Faelle, in dieser Reihenfolge — der erste, der zutrifft, gewinnt:
 *
 *   <head …>   direkt dahinter. Der Normalfall, und die frueheste Stelle im
 *              Kopf, an der ein `<meta>` stehen darf.
 *   <html …>   direkt dahinter, wenn der Kopf fehlt. Der Browser eroeffnet
 *              dort selbst einen, und das `<meta>` landet darin.
 *   sonst      voranstellen. Ein Bruchstueck ohne `<html>` hat keinen Doctype,
 *              den man verschieben koennte — hier ist nichts zu verlieren.
 */
function withContentPolicy(source: string): string {
  const head = /<head\b[^>]*>/i.exec(source);
  if (head !== null) {
    const at = head.index + head[0].length;
    return source.slice(0, at) + CONTENT_POLICY + source.slice(at);
  }

  const html = /<html\b[^>]*>/i.exec(source);
  if (html !== null) {
    const at = html.index + html[0].length;
    return source.slice(0, at) + CONTENT_POLICY + source.slice(at);
  }

  return CONTENT_POLICY + source;
}

export function DocumentView({
  html,
  initialOffset = 0,
  textScale = 1,
  dim = false,
  onScroll,
  onLoaded,
  onExternalLinkFailed,
  onExternalLinkBlocked,
  onTwoFingerTap,
  find = null,
  onFindResult,
}: DocumentViewProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);
  const webRef = useRef<WebView>(null);

  /**
   * Wann zuletzt jemand die Dokumentflaeche beruehrt hat.
   *
   * In einem Ref und nicht im Zustand: jede Beruehrung zeichnete sonst den
   * Viewer neu, waehrend gelesen wird — dieselbe Ueberlegung wie beim
   * Scrollversatz im `ViewerScreen`.
   */
  const lastTouch = useRef(0);

  // Gemerkt, weil das Dokument mehrere hundert Kilobyte gross sein kann und
  // jeder Renderdurchlauf sonst eine neue Zeichenkette dieser Groesse baute —
  // und die WebView sie als neue Quelle ansaehe und das Dokument neu laedt.
  const guardedHtml = useMemo(() => (html === '' ? '' : withContentPolicy(html)), [html]);

  /**
   * Was beim Laden im Dokument laeuft: die Leseposition wiederherstellen und
   * danach auf Fingertipps horchen.
   *
   * Gemerkt ueber `useMemo`, damit die WebView nicht bei jedem Renderdurchlauf
   * eine neue Quelle fuer `injectedJavaScript` sieht.
   */
  const startupScript = useMemo(
    () => `window.scrollTo(0, ${Math.round(initialOffset)});
(function () {
  var startX = 0;
  var startY = 0;
  var startedAt = 0;
  var moved = true;
  var maxTouches = 0;
  var options = { capture: true, passive: true };

  window.addEventListener('touchstart', function (e) {
    if (!e.touches) return;
    maxTouches = Math.max(maxTouches, e.touches.length);
    // Anker und Uhr setzt nur der ERSTE Finger. Der zweite darf sie nicht
    // zuruecksetzen, sonst waere eine beliebig langsam aufgelegte Hand noch
    // ein "kurzer" Tipp.
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startedAt = Date.now();
    moved = false;
  }, options);

  window.addEventListener('touchmove', function (e) {
    if (moved || !e.touches || e.touches.length === 0) return;
    var dx = Math.abs(e.touches[0].clientX - startX);
    var dy = Math.abs(e.touches[0].clientY - startY);
    // Damit faellt das Auf- und Zuziehen von selbst heraus: eine Zoom-Geste
    // bewegt die Finger.
    if (dx > ${TAP_SLOP_PX} || dy > ${TAP_SLOP_PX}) moved = true;
  }, options);

  window.addEventListener('touchend', function (e) {
    // Erst wenn ALLE Finger weg sind — sonst zaehlte das Abheben des ersten
    // Fingers schon als Ende der Geste.
    if (e.touches && e.touches.length > 0) return;
    var ok = !moved && maxTouches === 2 && Date.now() - startedAt <= ${TAP_MAX_MS};
    maxTouches = 0;
    moved = true;
    if (!ok) return;
    // Hier steht mit Absicht KEINE Pruefung auf Bedienelemente (closest) und
    // keine auf eine bestehende Textauswahl. Beides war noetig, solange die
    // Geste ein Einzeltipp war und mit dem Dokument konkurrierte. Mit zwei
    // Fingern ist es umgekehrt falsch: das Dokument sieht die Geste gar nicht,
    // und ein Zwei-Finger-Tipp, der zufaellig auf einem Link beginnt, soll
    // genauso wirken wie einer daneben.
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'twoFingerTap' }));
    }
  }, options);
})();
true;`,
    [initialOffset]
  );

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

  /**
   * Siehe Kopfkommentar: durchlassen, nach draussen geben oder blocken.
   *
   * Nach draussen geht nur, was der Nutzer angetippt hat. Die Rueckfrage
   * unterscheidet das nicht von selbst — ein `location.href = '…'` im Skript
   * des Dokuments kommt hier genauso an wie ein Fingertipp, und die App oeffnete
   * daraufhin ungefragt den Systembrowser, mit einer Adresse, die den
   * Dokumentinhalt als Parameter tragen kann. Ein Dokument darf nicht von sich
   * aus die App verlassen.
   *
   * Als Nutzergeste zaehlt eine Beruehrung in den zwei Sekunden davor. Genauer
   * geht es hier nicht: die Android-Fassung von `react-native-webview` reicht
   * kein `isUserGesture` durch. Zwei Sekunden sind lang genug fuer den Weg vom
   * Antippen bis zur Rueckfrage und zu kurz, als dass ein Skript sich daran
   * anhaengen koennte, ohne dass der Nutzer gerade selbst getippt hat.
   */
  const handleRequest: WebViewProps['onShouldStartLoadWithRequest'] = (request) => {
    const url = request.url;
    if (url.startsWith('about:')) return true;
    if (url.startsWith('http:') || url.startsWith('https:')) {
      if (Date.now() - lastTouch.current <= USER_GESTURE_MS) {
        openURL(url).catch(() => onExternalLinkFailed?.(url));
      } else {
        onExternalLinkBlocked?.(url);
      }
    }
    return false;
  };

  /**
   * Zwei Nachrichten aus dem Dokument: das Ergebnis der Suche und der
   * Zwei-Finger-Tipp auf die Dokumentflaeche.
   */
  const handleMessage: WebViewProps['onMessage'] = (event) => {
    try {
      const payload: unknown = JSON.parse(event.nativeEvent.data);
      if (payload === null || typeof payload !== 'object') return;
      const kind = (payload as { kind?: unknown }).kind;
      if (kind === 'twoFingerTap') {
        onTwoFingerTap?.();
        return;
      }
      if (kind === 'find') {
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
      {/*
        `onStartShouldSetResponderCapture` merkt sich die Beruehrung und gibt
        `false` zurueck: die Ebene wird damit NICHT zum Responder, und Tippen,
        Scrollen und Auswaehlen im Dokument laufen unveraendert weiter. Es ist
        ein Mithoeren, kein Abfangen.
      */}
      <Animated.View
        style={[styles.fill, { opacity }]}
        onStartShouldSetResponderCapture={() => {
          lastTouch.current = Date.now();
          return false;
        }}
      >
        <WebView
          ref={webRef}
          source={{ html: guardedHtml }}
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
          // Leseposition wiederherstellen, bevor das Bild sichtbar wird, und
          // danach die Tipp-Erkennung aufsetzen.
          injectedJavaScript={startupScript}
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
