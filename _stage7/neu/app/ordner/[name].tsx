/**
 * Screen 4 — Ordner-Detail (Blatt `3b`) als Push-Screen ueber dem Tab-Rahmen.
 *
 * Er liegt ausserhalb von `(tabs)`: das Handoff-Dokument zaehlt Ordner-Detail
 * zu den Screens, die ueber der Tab-Bar liegen. Der Ordnername steht im Pfad,
 * weil er zugleich der Ausweis ist (siehe `state/folders.ts`).
 */
import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FolderDetailScreen } from '../../src/screens/folders/FolderDetailScreen';

export default function FolderRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();

  return (
    <FolderDetailScreen
      folderName={decodeURIComponent(name ?? '')}
      onBack={() => router.back()}
    />
  );
}
