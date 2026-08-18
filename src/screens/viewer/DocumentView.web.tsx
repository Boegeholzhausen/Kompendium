/**
 * Dokumentflaeche fuer den Web-Export.
 *
 * `react-native-webview` hat keine Web-Umsetzung und zeichnet dort nur den
 * Hinweis "does not support this platform". Der Web-Build ist im Projekt
 * ausdruecklich nur die Bildkontrolle gegen den Prototyp (README, Abschnitt
 * "Pruefungen") — deshalb steht hier ein `iframe` mit `srcDoc`, das dieselbe
 * Seite rendert. Zielplattform bleibt mobile only.
 *
 * Der Scrollversatz laesst sich aus einem fremden `iframe`-Dokument nicht
 * ablesen; das Aus- und Einblenden der Bedienung ist im Web-Bild also nicht zu
 * pruefen. Beide Zustaende sind stattdessen ueber die Abnahmeblaetter
 * erreichbar.
 *
 * "Dokumente abdunkeln" wirkt auch hier — es ist eine eigene Ebene der App.
 * Die Textgroesse dagegen nicht: sie laeuft ueber `textZoom` der nativen
 * WebView, und ein `iframe` hat davon keine Entsprechung. Sichtbar ist sie im
 * Web-Bild in der Papier-Vorschau des Reglers (Blatt `6b`), und genau dafuer
 * ist die Vorschau da.
 *
 * "Im Dokument suchen" (D2) fehlt hier ebenfalls: der Auftrag laeuft ueber
 * `injectJavaScript` der nativen WebView, und in ein fremdes `iframe` laesst
 * sich von aussen nichts einspritzen. Die Angaben `find` und `onFindResult`
 * werden deshalb entgegengenommen und nicht benutzt.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { bg, documentCanvas, overlay } from '../../theme';
import type { DocumentViewProps } from './DocumentView';

export function DocumentView({ html, dim = false, onLoaded }: DocumentViewProps) {
  return (
    <View style={styles.stage}>
      {React.createElement('iframe', {
        srcDoc: html,
        onLoad: onLoaded,
        title: 'Dokument',
        style: {
          border: 'none',
          width: '100%',
          height: '100%',
          display: 'block',
          // Wie in der nativen Fassung: ein Dokument ohne eigenen Hintergrund
          // steht auf Weiss, nicht auf der dunklen Buehne.
          background: documentCanvas,
        },
      })}
      {dim ? <View style={styles.dim} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: bg.base,
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
