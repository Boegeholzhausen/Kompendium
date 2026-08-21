/**
 * Wer die App ist — die anonyme Identitaet bei Supabase.
 *
 * Ohne Login-Screen: beim ersten Start legt `ensureSession` eine anonyme
 * Identitaet an, die Session liegt danach in AsyncStorage und ueberlebt jeden
 * Neustart. Diese eine Kennung ist der Schluessel zu allem, was oben liegt —
 * jede Zeile in Supabase gehoert ihr (`owner_id`), und RLS laesst nur sie
 * daran.
 *
 * Deshalb steht sie hier im Zustand und nicht nur in der Bibliothek von
 * Supabase: der Abgleich braucht sie, und der Weg vom PC in die Bibliothek
 * braucht sie auch — das Skript `scripts/upload.mjs` laedt unter genau dieser
 * Kennung hoch. Wer sie nachsehen will, findet sie in den Einstellungen.
 *
 * Faellt die Anmeldung aus, laeuft die App weiter: die lokale Datenbank ist
 * die Wahrheitsquelle, Supabase ist der Abgleich. `status` sagt, woran es
 * liegt, statt es zu verschweigen.
 *
 * Seit Paket C ist die anonyme Identitaet nur noch der Anfang: sie laesst sich
 * mit einer E-Mail verknuepfen, und erst dann kann ein zweites Geraet
 * denselben Bestand sehen. `identity` haelt fest, in welchem der beiden
 * Zustaende die App gerade ist — die Einstellungen zeigen genau das.
 */
import { create } from 'zustand';

import {
  currentIdentity,
  ensureSession,
  isSupabaseConfigured,
  type Identity,
} from '../data/supabase';

export type SessionStatus =
  /** Noch nicht versucht. */
  | 'idle'
  /** Meldet gerade an. */
  | 'signing-in'
  /** Angemeldet, `userId` steht. */
  | 'ready'
  /** Keine Zugangsdaten in `.env` — die App laeuft rein lokal. */
  | 'unconfigured'
  /** Zugangsdaten da, Anmeldung gescheitert (Netz, oder Anonymous aus). */
  | 'failed';

interface SessionState {
  status: SessionStatus;
  userId: string | null;
  /** Anonym oder verknuepft — `null`, solange niemand angemeldet ist. */
  identity: Identity | null;
  signIn: () => Promise<void>;
  /**
   * Die Identitaet neu nachsehen — nach Verknuepfen, Anmelden und Abmelden.
   * Ohne diesen Aufruf zeigten die Einstellungen weiter den Stand von vorhin.
   */
  refresh: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  userId: null,
  identity: null,

  refresh: async () => {
    if (!isSupabaseConfigured) return;
    try {
      const identity = await currentIdentity();
      set({
        identity,
        userId: identity?.userId ?? null,
        status: identity === null ? 'idle' : 'ready',
      });
    } catch (error: unknown) {
      console.warn('[kompendium] Identitaet liess sich nicht lesen:', error);
    }
  },

  signIn: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'unconfigured' });
      return;
    }
    // Zwei Screens gleichzeitig anzumelden legt zwei Identitaeten an — die
    // zweite haette dann eine leere Bibliothek. Ein Lauf genuegt.
    if (get().status === 'signing-in' || get().status === 'ready') return;

    set({ status: 'signing-in' });
    try {
      const userId = await ensureSession();
      if (userId === null) {
        set({ status: 'failed', userId: null, identity: null });
        return;
      }
      set({ status: 'ready', userId, identity: await currentIdentity() });
    } catch (error: unknown) {
      console.warn('[kompendium] Anmeldung bei Supabase fehlgeschlagen:', error);
      set({ status: 'failed', userId: null, identity: null });
    }
  },
}));
