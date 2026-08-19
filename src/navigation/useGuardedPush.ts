/**
 * Ein Tipp, ein Screen.
 *
 * Der Viewer braucht einen Moment, bis er steht (Datei lesen, WebView
 * aufbauen). In dieser Zeit tippt man leicht ein zweites und drittes Mal auf
 * dieselbe Zeile — jeder Tipp war bisher ein eigenes `router.push`, und der
 * Stack oeffnete das Dokument entsprechend oft uebereinander. Zurueck fuehrte
 * dann durch alle Kopien.
 *
 * Deshalb sperrt dieser Hook nach dem ersten `push` alle weiteren, bis der
 * ausloesende Screen den Fokus wieder hat — also bis man tatsaechlich
 * zurueckgekehrt ist. Ging gar nichts auf (Route fehlt, Navigation verworfen),
 * loest das Sicherheitsnetz nach `UNLOCK_FALLBACK_MS` wieder — aber nur, wenn
 * der Screen den Fokus nie verloren hat, sonst wuerde die Sperre mitten im
 * Uebergang aufgehen.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';

type Push = ReturnType<typeof useRouter>['push'];
type Href = Parameters<Push>[0];

/** Reicht fuer den Stack-Uebergang (220 ms) mit reichlich Luft. */
const UNLOCK_FALLBACK_MS = 1000;

export function useGuardedPush(): (href: Href) => void {
  const router = useRouter();
  const navigation = useNavigation();
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Zurueck auf diesem Screen heisst: der naechste Tipp darf wieder oeffnen.
  useFocusEffect(
    useCallback(() => {
      locked.current = false;
      clearTimer();
    }, [clearTimer])
  );

  useEffect(() => clearTimer, [clearTimer]);

  return useCallback(
    (href: Href) => {
      if (locked.current) return;
      locked.current = true;
      router.push(href);

      clearTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        if (navigation.isFocused()) locked.current = false;
      }, UNLOCK_FALLBACK_MS);
    },
    [clearTimer, navigation, router]
  );
}
