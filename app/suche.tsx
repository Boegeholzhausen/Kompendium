/**
 * Screens 8 bis 10 — Suche (Blaetter `3c`, `3d`, `3e`).
 *
 * Push-Screen ueber dem Tab-Rahmen und damit **ohne Tab-Bar**: die Tastatur
 * belegt die untere Haelfte, eine Navigationsleiste darunter waere nur
 * verdeckte Flaeche.
 */
import React from 'react';

import { SearchScreen } from '../src/screens/search/SearchScreen';

export default function SearchRoute() {
  return <SearchScreen />;
}
