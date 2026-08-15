/**
 * Screen 15 — Papierkorb (Blatt `6a`).
 *
 * Push-Screen ueber dem Tab-Rahmen: er ist aus den Einstellungen erreichbar,
 * nicht selbst ein Ziel der Tab-Bar.
 */
import React from 'react';
import { useRouter } from 'expo-router';

import { TrashScreen } from '../src/screens/settings/TrashScreen';

export default function TrashRoute() {
  const router = useRouter();
  return <TrashScreen onBack={() => router.back()} />;
}
