/**
 * Bewegung. Kein Effekt darf das Layout verschieben.
 * "Bewegung reduzieren" (Systemeinstellung) schaltet Versatz und Schimmer ab;
 * Zustandswechsel bleiben, nur ohne Uebergang — siehe useReduceMotion().
 */
import { Easing as NativeEasing } from 'react-native';
import { Easing } from 'react-native-reanimated';

export const duration = {
  micro: 140,
  standard: 220,
  exit: 160,
  /** Druckfeedback */
  press: 100,
  /** Schimmer des Skelett-Platzhalters */
  shimmer: 1600,
  /** Puls des Sync-Indikators */
  syncPulse: 1400,
} as const;

export const easing = {
  micro: Easing.out(Easing.ease),
  standard: Easing.bezier(0.2, 0, 0, 1),
  exit: Easing.in(Easing.ease),
  linear: Easing.linear,
} as const;

/**
 * Dieselben Kurven fuer die eingebaute Animated-API von React Native.
 * Die Basiskomponenten animieren ueber Animated (Druckfeedback, Schimmer,
 * Sheet-Auftritt); Reanimated bleibt den Gesten- und Scroll-Effekten der
 * spaeteren Screens vorbehalten.
 */
export const easingNative = {
  micro: NativeEasing.out(NativeEasing.ease),
  standard: NativeEasing.bezier(0.2, 0, 0, 1),
  exit: NativeEasing.in(NativeEasing.ease),
  linear: NativeEasing.linear,
} as const;

/** Bottom-Sheets federn auf. */
export const springSheet = {
  damping: 22,
  stiffness: 260,
} as const;

/** Druckfeedback: Skalierung auf 0.97 in 100 ms. */
export const pressScale = 0.97;

/** Listen-Eintritt: 35 ms Versatz pro Element, maximal acht Elemente. */
export const stagger = {
  step: 35,
  maxItems: 8,
} as const;

/** Scroll-Schwelle, ab der die Viewer-Bedienung aus- bzw. einblendet. */
export const scrollThreshold = 8;

export const timingStandard = { duration: duration.standard, easing: easing.standard } as const;
export const timingMicro = { duration: duration.micro, easing: easing.micro } as const;
export const timingExit = { duration: duration.exit, easing: easing.exit } as const;
