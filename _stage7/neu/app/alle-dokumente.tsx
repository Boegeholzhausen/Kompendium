/**
 * "Alle Dokumente" aus der Ordner-Uebersicht (Blatt `3a`).
 *
 * Eigene Route statt `/ordner/alle`: es ist kein Ordner, und ein echter Ordner
 * darf ruhig "Alle" heissen duerfen, ohne dass sich die Pfade streiten.
 */
import React from 'react';
import { useRouter } from 'expo-router';

import { FolderDetailScreen } from '../src/screens/folders/FolderDetailScreen';

export default function AllDocumentsRoute() {
  const router = useRouter();
  return <FolderDetailScreen folderName={null} onBack={() => router.back()} />;
}
