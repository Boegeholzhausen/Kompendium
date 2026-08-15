/**
 * Was der Hinweisstreifen unter der Kopfzeile gerade sagt (Blatt `4c`).
 *
 * Der Streifen erscheint in mehreren Screens, und er muss ueberall dasselbe
 * sagen: Offline geht vor Sync-Fehler — ohne Netz ist "Wiederholen" nur eine
 * Schaltflaeche, die wieder fehlschlaegt.
 *
 * Der Satz nennt eine Zahl ("Offline — 12 Dokumente verfügbar"), und die wird
 * hier gerechnet statt aus dem Blatt uebernommen: verfuegbar ist, was im Cache
 * liegt und nicht im Papierkorb steht.
 */
import { useMemo } from 'react';

import { useDocumentStore } from './documents';
import { useNetworkStore } from './network';
import { useSyncStore } from './sync';
import type { NoticeKind } from '../ui/NoticeStrip';

export interface Notice {
  kind: NoticeKind;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function useNotice(): Notice | null {
  const isOnline = useNetworkStore((state) => state.isOnline);
  const status = useSyncStore((state) => state.status);
  const sync = useSyncStore((state) => state.sync);
  const documents = useDocumentStore((state) => state.documents);

  const availableCount = useMemo(
    () => documents.filter((document) => document.trashedAt === null && document.cached).length,
    [documents]
  );

  return useMemo(() => {
    if (!isOnline) {
      return {
        kind: 'offline',
        message:
          availableCount === 1
            ? 'Offline — 1 Dokument verfügbar'
            : `Offline — ${availableCount} Dokumente verfügbar`,
      };
    }
    if (status === 'error') {
      return {
        kind: 'error',
        message: 'Sync fehlgeschlagen',
        actionLabel: 'Wiederholen',
        onAction: sync,
      };
    }
    return null;
  }, [availableCount, isOnline, status, sync]);
}
