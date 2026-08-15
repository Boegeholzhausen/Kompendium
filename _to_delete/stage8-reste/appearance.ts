/**
 * Zustand "Darstellung" (Blatt `6b`).
 *
 * Handoff-Dokument, State Management: "`viewerTextScale: 0.9–1.5`,
 * `dimDocuments: boolean`, `keepScreenOn: boolean`, `reduceMotion` (System)".
 *
 * `reduceMotion` steht bewusst nicht hier: es folgt der Systemeinstellung und
 * wird ueber `theme/useReduceMotion` gelesen. Eine eigene Kopie waere eine
 * zweite Wahrheit, die nach dem naechsten Systemwechsel falsch ist — genau
 * deshalb zeigt der Screen die Zeile auch nur an, ohne Schalter.
 *
 * Die beiden Werte "Standardansicht" und "Sortierung" aus derselben Gruppe
 * liegen im Bibliothek-Zustand: es sind dieselben Werte, die die Bibliothek
 * gerade benutzt (siehe `state/library.ts`).
 *
 * Alle drei Werte ueberdauern den Neustart — sie liegen in `settings`.
 */
import { create } from 'zustand';

import { persist } from '../data/db/persist';
import { setSetting } from '../data/db/repository';

/** Grenzen des Reglers aus Blatt `6b`: Skalenenden 90 % und 150 %. */
export const TEXT_SCALE_MIN = 0.9;
export const TEXT_SCALE_MAX = 1.5;
/** Der Regler rastet in Fuenferschritten — 113 % waere eine Genauigkeit ohne Nutzen. */
export const TEXT_SCALE_STEP = 0.05;

export const SETTING_TEXT_SCALE = 'appearance.viewerTextScale';
export const SETTING_DIM = 'appearance.dimDocuments';
export const SETTING_KEEP_AWAKE = 'appearance.keepScreenOn';

interface AppearanceState {
  /** Textgroesse im Viewer, 0.9 bis 1.5. */
  viewerTextScale: number;
  /** "Dokumente abdunkeln — Helle Seiten leicht dämpfen". */
  dimDocuments: boolean;
  /** "Bildschirm anlassen — Beim Lesen nicht sperren". */
  keepScreenOn: boolean;

  hydrate: (settings: Record<string, string>) => void;
  setTextScale: (value: number) => void;
  setDimDocuments: (value: boolean) => void;
  setKeepScreenOn: (value: boolean) => void;
}

function clamp(value: number): number {
  const stepped = Math.round(value / TEXT_SCALE_STEP) * TEXT_SCALE_STEP;
  return Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, Number(stepped.toFixed(2))));
}

export const useAppearanceStore = create<AppearanceState>((set) => ({
  // 110 % ist der Wert, den Blatt `6b` zeigt: die Vorgabe der App ist etwas
  // groesser als das, was ein Dokument von sich aus mitbringt — gelesen wird
  // abends und unterwegs.
  viewerTextScale: 1.1,
  dimDocuments: false,
  keepScreenOn: false,

  hydrate: (settings) =>
    set({
      viewerTextScale:
        settings[SETTING_TEXT_SCALE] === undefined
          ? 1.1
          : clamp(Number(settings[SETTING_TEXT_SCALE])),
      dimDocuments: settings[SETTING_DIM] === 'true',
      keepScreenOn: settings[SETTING_KEEP_AWAKE] === 'true',
    }),

  setTextScale: (value) => {
    const viewerTextScale = clamp(value);
    persist(() => setSetting(SETTING_TEXT_SCALE, String(viewerTextScale)));
    set({ viewerTextScale });
  },

  setDimDocuments: (dimDocuments) => {
    persist(() => setSetting(SETTING_DIM, String(dimDocuments)));
    set({ dimDocuments });
  },

  setKeepScreenOn: (keepScreenOn) => {
    persist(() => setSetting(SETTING_KEEP_AWAKE, String(keepScreenOn)));
    set({ keepScreenOn });
  },
}));
