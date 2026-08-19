/**
 * Der Abruf im Web-Bild: keiner.
 *
 * Der Web-Build dient allein der Bildkontrolle gegen den Prototyp — dieselbe
 * Ueberlegung wie bei `repository.web.ts` und `DocumentView.web.tsx`. Ein
 * echter Abruf haette dort zwei Wirkungen, die beide unerwuenscht sind: er
 * schriebe in eine Datenbank, die es im Browser nur im Arbeitsspeicher gibt,
 * und er legte fuer jeden Screenshot-Lauf eine neue anonyme Identitaet an.
 *
 * Der Zustand bleibt damit `idle` statt `error`: es ist nichts fehlgeschlagen,
 * es war nur nichts abzugleichen.
 */
import type { PullResult } from './pull';

export async function pullChanges(): Promise<PullResult> {
  return { changed: 0, at: null };
}
