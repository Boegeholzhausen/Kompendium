/**
 * Viewer als Push-Screen ueber dem Tab-Rahmen.
 *
 * Er liegt ausserhalb von `(tabs)`, weil er laut Handoff-Dokument **keine**
 * Tab-Bar zeigt: beim Lesen soll die App verschwinden. Der Uebergang von
 * rechts kommt aus dem Stack in `app/_layout.tsx` (`standard`, 220 ms).
 *
 * `?suche=` traegt den Begriff aus der Trefferliste herein (D3): der Viewer
 * sucht ihn nach dem Laden noch einmal im Dokument und springt zur ersten
 * Fundstelle.
 */
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ViewerScreen } from '../../src/screens/viewer/ViewerScreen';

export default function DocumentRoute() {
  const { id, suche } = useLocalSearchParams<{ id: string; suche?: string }>();
  const router = useRouter();

  return <ViewerScreen documentId={id} searchTerm={suche} onBack={() => router.back()} />;
}
