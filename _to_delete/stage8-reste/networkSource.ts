/**
 * Woher der Netzzustand auf dem Geraet kommt: NetInfo.
 *
 * Gewertet wird allein `isConnected` — die Auskunft des Systems ueber die
 * Verbindung. `isInternetReachable` waere die genauere Frage, kostet aber
 * einen eigenen Testabruf gegen eine fremde Adresse, und der kann aus seinen
 * eigenen Gruenden scheitern: dann stuende "Offline" ueber einer Bibliothek,
 * die vollstaendig lokal liegt und einwandfrei funktioniert.
 *
 * Der Fall "verbunden, aber nichts zu erreichen" geht damit nicht verloren:
 * er zeigt sich, sobald der echte Abgleich scheitert — das ist der
 * `error`-Streifen aus demselben Blatt, und der beruht dann auf einem
 * wirklich versuchten Abruf statt auf einem stellvertretenden.
 */
import NetInfo from '@react-native-community/netinfo';

export function watchNetwork(onChange: (isOnline: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => onChange(state.isConnected === true));
}
