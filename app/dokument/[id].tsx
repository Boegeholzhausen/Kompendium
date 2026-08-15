/**
 * Viewer als Push-Screen ueber dem Tab-Rahmen.
 *
 * Er liegt ausserhalb von `(tabs)`, weil er laut Handoff-Dokument **keine**
 * Tab-Bar zeigt: beim Lesen soll die App verschwinden. Der Uebergang von
 * rechts kommt aus dem Stack in `app/_layout.tsx` (`standard`, 220 ms).
 */
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ViewerScreen } from '../../src/screens/viewer/ViewerScreen';

export default function DocumentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return <ViewerScreen documentId={id} onBack={() => router.back()} />;
}
