/**
 * Supabase-Client.
 *
 * Wichtig fuer den Renderpfad: die UI liest niemals direkt hierher, sondern
 * immer aus der lokalen SQLite. Supabase ist ein Hintergrund-Prozess
 * (Pull per updated_at-Wasserzeichen, Push per Outbox).
 *
 * Zugangsdaten kommen aus .env (siehe .env.example). Der Publishable/Anon Key
 * darf in der App liegen, solange RLS aktiv ist — jede Zeile ist auf
 * owner_id = auth.uid() beschraenkt.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Ist die App konfiguriert? Ohne Zugangsdaten laeuft sie rein lokal weiter. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // React Native hat keine URL-Session-Erkennung.
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Anmeldung ohne Login-Screen: beim ersten Start eine anonyme Identitaet
 * anlegen, Session in AsyncStorage. Kein Formular, kein Passwort.
 * Der Upgrade-Pfad (E-Mail verknuepfen) kommt spaeter.
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;

  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return signedIn.user?.id ?? null;
}

export const STORAGE_BUCKET = 'documents';
