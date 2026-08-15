/**
 * Dieselbe Auskunft fuer den Web-Export — aus den Ereignissen des Browsers.
 *
 * Warum nicht NetInfo: dessen Web-Fassung horcht, sobald der Browser eine
 * `navigator.connection` anbietet (Chromium tut das), ausschliesslich auf
 * deren `change`-Ereignis. Das kommt beim Abschalten einmal und danach nie
 * wieder — die App bliebe nach dem ersten Offline fuer immer offline. Genau
 * die Zustaende aus Blatt `4c`, die hier geprueft werden sollen, waeren also
 * nicht pruefbar.
 *
 * `online` und `offline` am Fenster sind die Ereignisse, die jeder Browser
 * verlaesslich schickt. Auf dem Geraet bleibt NetInfo zustaendig
 * (`networkSource.ts`) — dieselbe Aufteilung wie bei `DocumentView.web.tsx`
 * und `repository.web.ts`.
 */
export function watchNetwork(onChange: (isOnline: boolean) => void): () => void {
  if (typeof window === 'undefined') {
    onChange(true);
    return () => {};
  }

  const report = () => onChange(window.navigator.onLine);
  report();

  window.addEventListener('online', report);
  window.addEventListener('offline', report);
  return () => {
    window.removeEventListener('online', report);
    window.removeEventListener('offline', report);
  };
}
