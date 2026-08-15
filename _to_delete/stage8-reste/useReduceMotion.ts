/**
 * "Bewegung reduzieren" folgt der Systemeinstellung (README 16, Abschnitt App).
 * Ist sie aktiv, entfallen Versatz und Schimmer; Zustandswechsel bleiben,
 * nur ohne Uebergang.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => setReduceMotion(enabled)
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
