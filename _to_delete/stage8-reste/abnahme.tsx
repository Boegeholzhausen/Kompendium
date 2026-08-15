/**
 * Abnahmeblaetter — Tokens (`1a`), Kacheln (`1b`), Komponenten (`2a`).
 *
 * Push-Screen ueber dem Tab-Rahmen: die Blaetter sind Werkzeug, kein Ziel der
 * Navigation, und sollen deshalb keine Tab-Bar tragen.
 */
import React from 'react';

import { DevGallery } from '../src/dev/DevGallery';

export default function AbnahmeRoute() {
  return <DevGallery />;
}
