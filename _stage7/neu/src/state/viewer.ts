/**
 * Zustand des Viewers, der einen Screen-Besuch ueberdauert.
 *
 * Aus dem Handoff-Dokument: "`scrollPosition` (pro Dokument persistieren und
 * beim Oeffnen wiederherstellen)". Das ist der einzige Viewer-Wert, der nicht
 * in den Screen gehoert — `chromeVisible` und `activeSheet` leben nur, solange
 * gelesen wird, und werden beim naechsten Oeffnen bewusst zurueckgesetzt: wer
 * ein Dokument aufschlaegt, will es sehen, nicht ein offenes Sheet vorfinden.
 */
import { create } from 'zustand';

interface ViewerState {
  /** Leseposition je Dokument, in dp vom Seitenanfang. */
  scrollPositions: Record<string, number>;
  rememberScroll: (documentId: string, offset: number) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  scrollPositions: {},
  rememberScroll: (documentId, offset) =>
    set((state) => ({ scrollPositions: { ...state.scrollPositions, [documentId]: offset } })),
}));
