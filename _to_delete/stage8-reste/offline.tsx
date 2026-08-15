/**
 * "Offline behaltene Dokumente" aus der Gruppe "Speicher" (Blatt `3i`).
 */
import React from 'react';
import { useRouter } from 'expo-router';

import { OfflineScreen } from '../src/screens/settings/OfflineScreen';

export default function OfflineRoute() {
  const router = useRouter();
  return <OfflineScreen onBack={() => router.back()} />;
}
