/**
 * Wer die App ist — das Konto bei Supabase.
 *
 * Diese eine Kennung ist der Schluessel zu allem, was oben liegt: jede Zeile
 * gehoert ihr (`owner_id`), und RLS laesst nur sie daran. Deshalb steht sie
 * hier im Zustand und nicht nur in der Bibliothek von Supabase — der Abgleich
 * braucht sie, und der Weg vom PC (`scripts/upload.mjs`) laedt unter genau
 * dieser Kennung hoch. Wer sie nachsehen will, findet sie in den
 * Einstellungen.
 *
 * Angemeldet wird ueber ein Sheet in den Einstellungen, nicht ueber einen
 * Anmeldeschirm vor der App: die lokale Datenbank ist die Wahrheitsquelle, und
 * jeder Screen rendert offline vollstaendig (Begruendung ausfuehrlich in
 * `data/supabase.ts`). Nicht angemeldet ist deshalb ein normaler Zustand und
 * kein Fehler — die Bibliothek funktioniert, nur der Abgleich ruht.
 *
 * Die Session ueberlebt den Neustart (AsyncStorage). `restore()` beim Start
 * sieht nur nach, ob noch eine da ist; angelegt wird hier nie etwas von
 * selbst.
 */
import { create } from 'zustand';

import { currentIdentity, isSupabaseConfigured, logIn, logOut, type Identity } from '../data/supabase';

export type SessionStatus =
  /** Noch nicht nachgesehen. */
  | 'idle'
  /** Meldet gerade an. */
  | 'signing-in'
  /** Angemeldet, `userId` steht. */
  | 'ready'
  /** Keine Zugangsdaten in `.env` — die App laeuft rein lokal. */
  | 'unconfigured'
  /** Konfiguriert, aber niemand angemeldet. Kein Fehler. */
  | 'signed-out';

interface SessionState {
  status: SessionStatus;
  userId: string | null;
  identity: Identity | null;
  /** Beim Start nachsehen, ob noch eine Session da ist. Legt nie eine an. */
  restore: () => Promise<void>;
  /** Anmelden. Wirft mit einem deutschen Satz — das Sheet zeigt ihn an. */
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'idle',
  userId: null,
  identity: null,

  restore: async () => {
    if (!isSupabaseConfigured) {
      set({ status: 'unconfigured' });
      return;
    }
    try {
      const identity = await currentIdentity();
      set({
        status: identity === null ? 'signed-out' : 'ready',
        userId: identity?.userId ?? null,
        identity,
      });
    } catch (error: unknown) {
      // Ein Aussetzer beim Nachsehen ist kein Abgemeldetsein: die Session kann
      // durchaus da sein. `signed-out` waere hier eine Behauptung — der naechste
      // Abgleich fragt ohnehin selbst nach.
      console.warn('[kompendium] Session liess sich nicht lesen:', error);
      set({ status: 'signed-out', userId: null, identity: null });
    }
  },

  logIn: async (email, password) => {
    if (get().status === 'signing-in') return;
    set({ status: 'signing-in' });
    try {
      const identity = await logIn(email, password);
      set({ status: 'ready', userId: identity.userId, identity });
    } catch (error: unknown) {
      set({ status: 'signed-out', userId: null, identity: null });
      throw error;
    }
  },

  logOut: async () => {
    await logOut();
    set({ status: 'signed-out', userId: null, identity: null });
  },
}));
