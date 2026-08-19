/**
 * Der Weg nach oben im Web-Bild: keiner.
 *
 * Dieselbe Ueberlegung wie bei `pull.web.ts` — der Web-Build dient allein der
 * Bildkontrolle gegen den Prototyp. Ein echter Push haette dort nichts
 * hochzuschicken (die Web-Fassung des Repositories fuehrt keine Outbox) und
 * legte fuer jeden Screenshot-Lauf eine anonyme Identitaet an.
 */
import type { PushResult } from './push';

export async function pushChanges(): Promise<PushResult> {
  return { pushed: 0 };
}
