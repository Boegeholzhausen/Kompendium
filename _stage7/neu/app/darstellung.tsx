/**
 * Screen 16 — Darstellung (Blatt `6b`).
 */
import React from 'react';
import { useRouter } from 'expo-router';

import { AppearanceScreen } from '../src/screens/settings/AppearanceScreen';

export default function AppearanceRoute() {
  const router = useRouter();
  return <AppearanceScreen onBack={() => router.back()} />;
}
