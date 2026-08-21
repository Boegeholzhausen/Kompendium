/**
 * Suchen im geoeffneten Dokument (D2/D3) — der Zustand dazu.
 *
 * Der Auftrag geht als `FindCommand` an die WebView, das Ergebnis kommt als
 * Zaehlung zurueck; warum der Weg ueber `injectJavaScript` und `window.find`
 * laeuft, steht im Kopf von `DocumentView`.
 *
 * Herausgeloest aus `ViewerScreen`: fuenf zusammengehoerige Werte, zwei Refs
 * und vier Rueckrufe, die sonst zwischen Laden, Menue und Sheets verstreut
 * lagen.
 *
 * Das Oeffnen und Schliessen des Sheets bleibt beim Screen — er kennt die
 * Reihenfolge seiner Ebenen (Info → Suchen → Toast) und ist der einzige, der
 * entscheiden darf, welche gerade obenauf liegt.
 */
import { useCallback, useRef, useState } from 'react';

import type { FindCommand, FindState } from './DocumentView';

export interface FindInDocument {
  /** Was im Feld des Sheets steht. */
  term: string;
  setTerm: (term: string) => void;
  /** Der letzte Auftrag an die WebView; `null`, solange keiner lief. */
  command: FindCommand | null;
  /** Antwort der WebView: wie viele Fundstellen, und die wievielte gilt. */
  result: FindState;
  setResult: (state: FindState) => void;
  /** Eingeklappt aus einem Suchtreffer heraus (Blatt-freie Ergaenzung, D3). */
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  /** Einen Auftrag schicken. Jeder Ruf zaehlt die `id` hoch. */
  send: (kind: FindCommand['kind'], term: string) => void;
  /**
   * Nach `onLoadEnd`: kam der Viewer aus einem Suchtreffer, wird der Begriff
   * genau einmal gesucht. Gibt zurueck, ob gesprungen wurde — der Screen
   * klappt daraufhin sein Sheet auf.
   */
  jumpAfterLoad: () => boolean;
  /** Schliessen hebt die Hervorhebung im Dokument wieder auf. */
  clear: () => void;
}

export function useFindInDocument(jumpTerm: string): FindInDocument {
  const [term, setTerm] = useState('');
  const [command, setCommand] = useState<FindCommand | null>(null);
  const [result, setResult] = useState<FindState>({ total: 0, index: 0 });
  const [collapsed, setCollapsed] = useState(false);

  /**
   * Der Auftragszaehler steht in einem Ref: zweimal "weiter" mit demselben
   * Begriff waeren sonst derselbe Auftrag, und die WebView bekaeme den zweiten
   * Tipp nicht zu sehen.
   */
  const nextId = useRef(0);

  const send = useCallback((kind: FindCommand['kind'], value: string) => {
    nextId.current += 1;
    setCommand({ id: nextId.current, kind, term: value });
    if (kind === 'clear') setResult({ total: 0, index: 0 });
  }, []);

  /**
   * Der Sprung aus einem Suchtreffer laeuft genau einmal, nach `onLoadEnd`:
   * vorher gibt es im Dokument nichts zu finden.
   */
  const jumped = useRef(false);
  const jumpAfterLoad = useCallback(() => {
    if (jumped.current || jumpTerm === '') return false;
    jumped.current = true;
    setTerm(jumpTerm);
    setCollapsed(true);
    send('search', jumpTerm);
    return true;
  }, [jumpTerm, send]);

  const clear = useCallback(() => {
    send('clear', '');
  }, [send]);

  return {
    term,
    setTerm,
    command,
    result,
    setResult,
    collapsed,
    setCollapsed,
    send,
    jumpAfterLoad,
    clear,
  };
}
