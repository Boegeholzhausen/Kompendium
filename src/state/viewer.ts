/**
 * Zustand des Viewers, der einen Screen-Besuch ueberdauert.
 *
 * Aus dem Handoff-Dokument: "`scrollPosition` (pro Dokument persistieren und
 * beim Oeffnen wiederherstellen)". Das ist der einzige Viewer-Wert, der nicht
 * in den Screen gehoert — `chromeVisible` und `activeSheet` leben nur, solange
 * gelesen wird, und werden beim naechsten Oeffnen bewusst zurueckgesetzt: wer
 * ein Dokument aufschlaegt, will es sehen, nicht ein offenes Sheet vorfinden.
 *
 * "Persistieren" heisst hier wirklich ueber den Neustart hinweg: die Positionen
 * liegen als ein JSON-Objekt in der vorhandenen `settings`-Tabelle. Ein eigenes
 * Schema braucht das nicht — es ist ein Wert pro Dokument, und die Bibliothek
 * ist klein genug, dass das Objekt in eine Zeile passt.
 *
 * Geschrieben wird NICHT bei jedem Scrollschritt. `handleScroll` im
 * ViewerScreen feuert ab 8 px Unterschied, also viele Male pro Sekunde;
 * jeder davon eine Datenbankschreibung waere waehrend des Lesens spuerbar.
 * Der Zustand wandert deshalb sofort mit (die Anzeige haengt daran), die
 * Datenbank fruehestens alle zwei Sekunden — und in jedem Fall beim Verlassen
 * des Viewers ueber `flushScroll()`, damit die zuletzt gelesene Stelle nicht
 * an der Drossel haengen bleibt.
 */
import { create } from 'zustand';

import { persist } from '../data/db/persist';
import { setSetting } from '../data/db/repository';

export const SETTING_SCROLL_POSITIONS = 'viewer.scrollPositions';

/** Frueheste Wiederholung einer Schreibung, in Millisekunden. */
const WRITE_INTERVAL = 2000;

interface ViewerState {
  /** Leseposition je Dokument, in dp vom Seitenanfang. */
  scrollPositions: Record<string, number>;
  /**
   * Gespeicherte Positionen uebernehmen. `documentIds` ist der Bestand nach
   * dem Aufraeumen des Papierkorbs — Eintraege zu Dokumenten, die es nicht
   * mehr gibt, fliegen dabei raus, damit das Objekt nicht unbegrenzt waechst.
   */
  hydrate: (settings: Record<string, string>, documentIds: string[]) => void;
  rememberScroll: (documentId: string, offset: number) => void;
  /** Eintraege zu geloeschten Dokumenten vergessen (endgueltiges Loeschen). */
  forgetScroll: (documentIds: string[]) => void;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  scrollPositions: {},

  hydrate: (settings, documentIds) => {
    const raw = settings[SETTING_SCROLL_POSITIONS];
    if (raw === undefined) return;

    const known = new Set(documentIds);
    const scrollPositions: Record<string, number> = {};
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object') {
        for (const [id, offset] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof offset === 'number' && Number.isFinite(offset) && known.has(id)) {
            scrollPositions[id] = offset;
          }
        }
      }
    } catch {
      // Kaputtes JSON ist kein Grund, den Start abzubrechen: dann faengt jedes
      // Dokument eben wieder oben an.
    }
    set({ scrollPositions });
  },

  rememberScroll: (documentId, offset) => {
    set((state) => ({ scrollPositions: { ...state.scrollPositions, [documentId]: offset } }));
    schedule(get);
  },

  forgetScroll: (documentIds) => {
    const gone = new Set(documentIds);
    const before = Object.keys(get().scrollPositions).length;
    const scrollPositions = Object.fromEntries(
      Object.entries(get().scrollPositions).filter(([id]) => !gone.has(id))
    );
    if (Object.keys(scrollPositions).length === before) return;

    set({ scrollPositions });
    // Loeschen ist kein Scrollschritt: es darf nicht bis zu zwei Sekunden in
    // der Drossel haengen, sondern geht sofort in die Datenbank.
    schedule(get);
    flushScroll();
  },
}));

/** Wann zuletzt geschrieben wurde — Grundlage der Drossel. */
let lastWrite = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let read: (() => ViewerState) | null = null;
/** Steht eine Aenderung an, die noch nicht in der Datenbank ist? */
let pending = false;

function write() {
  if (read === null || !pending) return;
  pending = false;
  lastWrite = Date.now();
  const value = JSON.stringify(read().scrollPositions);
  persist(() => setSetting(SETTING_SCROLL_POSITIONS, value));
}

function schedule(get: () => ViewerState) {
  read = get;
  pending = true;
  if (timer !== null) return;

  const wait = Math.max(0, WRITE_INTERVAL - (Date.now() - lastWrite));
  timer = setTimeout(() => {
    timer = null;
    write();
  }, wait);
}

/**
 * Ausstehendes Schreiben sofort erledigen — beim Verlassen des Viewers.
 * Ohne diesen Aufruf ginge die letzte Position verloren, wenn der Nutzer
 * innerhalb der Drosselzeit zurueckgeht.
 */
export function flushScroll(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  write();
}
