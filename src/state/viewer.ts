/**
 * Zustand des Viewers, der einen Screen-Besuch ueberdauert.
 *
 * Aus dem Handoff-Dokument: "`scrollPosition` (pro Dokument persistieren und
 * beim Oeffnen wiederherstellen)". Das ist der einzige Viewer-Wert, der nicht
 * in den Screen gehoert — `chromeVisible` und `activeSheet` leben nur, solange
 * gelesen wird, und werden beim naechsten Oeffnen bewusst zurueckgesetzt: wer
 * ein Dokument aufschlaegt, will es sehen, nicht ein offenes Sheet vorfinden.
 *
 * ## Wo die Position liegt
 *
 * Seit Schema 7 in der Dokumentzeile (`documents.scroll_offset`), nicht mehr
 * als JSON-Objekt in der `settings`-Tabelle. Der Grund ist der Abgleich: die
 * Leseposition gehoert zum Dokument, und als Spalte geht sie ueber die
 * vorhandene Outbox mit — auf dem zweiten Geraet steht der Text dann dort, wo
 * man aufgehoert hat. Als Voreinstellung haette sie nie einen Weg nach oben
 * gefunden, weil sie kein Wert ueber den Nutzer ist, sondern ueber einen Text.
 *
 * Der Zustand haelt trotzdem eine eigene Abbildung im Arbeitsspeicher: die
 * Anzeige haengt daran, und sie muss jedem Scrollschritt sofort folgen.
 *
 * ## Wann geschrieben wird
 *
 * `handleScroll` im ViewerScreen feuert ab 8 px Unterschied, also viele Male
 * pro Sekunde. Geschrieben wird deshalb an genau zwei Stellen:
 *
 *   beim Verlassen des Viewers      `flushScroll()` im ViewerScreen
 *   beim Wechsel in den Hintergrund `AppState`-Abo weiter unten
 *
 * Frueher lief hier zusaetzlich eine Zwei-Sekunden-Drossel. Sie ist entfallen,
 * seit die Position ueber die Outbox nach oben geht: jede Schreibung reiht das
 * Dokument dort ein, und beim Lesen eines langen Textes spraenge der
 * Sync-Status sonst dauernd zwischen "Synchron" und "Änderungen offen". Beide
 * verbliebenen Momente sind solche, in denen ohnehin nicht gelesen wird.
 */
import { AppState } from 'react-native';
import { create } from 'zustand';

import { persist } from '../data/db/persist';
import { updateDocuments } from '../data/db/repository';

interface ViewerState {
  /** Leseposition je Dokument, in dp vom Seitenanfang. */
  scrollPositions: Record<string, number>;
  /**
   * Gespeicherte Positionen uebernehmen. `documentIds` ist der Bestand nach
   * dem Aufraeumen des Papierkorbs — Eintraege zu Dokumenten, die es nicht
   * mehr gibt, fliegen dabei raus.
   */
  hydrate: (scrollPositions: Record<string, number>, documentIds: string[]) => void;
  rememberScroll: (documentId: string, offset: number) => void;
  /** Eintraege zu geloeschten Dokumenten vergessen (endgueltiges Loeschen). */
  forgetScroll: (documentIds: string[]) => void;
}

/**
 * Welche Positionen sich seit der letzten Schreibung geaendert haben.
 *
 * Nur diese gehen in die Datenbank: ein `UPDATE` ueber den ganzen Bestand
 * reihte jedes Dokument in die Outbox ein, auch die, die niemand angefasst hat.
 */
const dirty = new Set<string>();

export const useViewerStore = create<ViewerState>((set, get) => ({
  scrollPositions: {},

  hydrate: (scrollPositions, documentIds) => {
    const known = new Set(documentIds);
    const kept: Record<string, number> = {};
    for (const [id, offset] of Object.entries(scrollPositions)) {
      if (Number.isFinite(offset) && known.has(id)) kept[id] = offset;
    }
    // Was hier hydriert wird, steht bereits in der Datenbank — es waere ein
    // Fehler, es als Aenderung zu melden.
    dirty.clear();
    set({ scrollPositions: kept });
  },

  rememberScroll: (documentId, offset) => {
    if (get().scrollPositions[documentId] === offset) return;
    dirty.add(documentId);
    set((state) => ({ scrollPositions: { ...state.scrollPositions, [documentId]: offset } }));
  },

  forgetScroll: (documentIds) => {
    const gone = new Set(documentIds);
    const before = Object.keys(get().scrollPositions).length;
    const scrollPositions = Object.fromEntries(
      Object.entries(get().scrollPositions).filter(([id]) => !gone.has(id))
    );
    for (const id of documentIds) dirty.delete(id);
    if (Object.keys(scrollPositions).length === before) return;

    // Nichts zu schreiben: die Zeilen sind endgueltig geloescht, und mit ihnen
    // ihre Spalte.
    set({ scrollPositions });
  },
}));

/**
 * Ausstehendes Schreiben sofort erledigen.
 *
 * Zwei Aufrufer: der ViewerScreen beim Verlassen und das `AppState`-Abo
 * darunter. Ohne den ersten ginge die zuletzt gelesene Stelle verloren, ohne
 * den zweiten alles, was seit dem Aufschlagen gelesen wurde, wenn die App aus
 * dem Hintergrund heraus beendet wird.
 */
export function flushScroll(): void {
  if (dirty.size === 0) return;

  const positions = useViewerStore.getState().scrollPositions;
  const pending = [...dirty];
  dirty.clear();

  for (const id of pending) {
    const offset = positions[id];
    if (offset === undefined) continue;
    // Je Dokument ein Aufruf: `updateDocuments` schreibt einen Wert auf viele
    // Zeilen, und hier hat jede Zeile ihren eigenen.
    persist(() => updateDocuments([id], { scrollOffset: Math.max(0, Math.round(offset)) }));
  }
}

// Das Abo laeuft ueber die Lebensdauer der App und wird nie geloest: es gibt
// genau einen Zustand dieser Art, und ein Abmelden gaebe es nur beim Beenden —
// also genau dann, wenn es zu spaet waere.
AppState.addEventListener('change', (next) => {
  if (next === 'background' || next === 'inactive') flushScroll();
});
