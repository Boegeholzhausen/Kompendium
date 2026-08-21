/**
 * Supabase-Client.
 *
 * Wichtig fuer den Renderpfad: die UI liest niemals direkt hierher, sondern
 * immer aus der lokalen SQLite. Supabase ist ein Hintergrund-Prozess
 * (Pull per updated_at-Wasserzeichen, Push per Outbox).
 *
 * Zugangsdaten kommen aus .env. Der Publishable/Anon Key darf in der App
 * liegen, solange RLS aktiv ist — jede Zeile ist auf owner_id = auth.uid()
 * beschraenkt.
 *
 * ## Die Identitaet: einmal anmelden, dann nie wieder
 *
 * Diese App hat genau einen Nutzer, und das Konto liegt in Supabase
 * (`auth.users`, Passwort als Hash). Angemeldet wird ueber ein Sheet in den
 * Einstellungen — bewusst NICHT ueber einen Anmeldeschirm vor der App: die
 * lokale Datenbank ist die Wahrheitsquelle, jeder Screen rendert offline
 * vollstaendig, und ein Schirm davor machte die Bibliothek ohne Netz
 * unbenutzbar. Nicht angemeldet heisst hier: alles funktioniert, nur der
 * Abgleich ruht und sagt das.
 *
 * Die Session liegt danach in AsyncStorage und ueberlebt jeden Neustart; das
 * Passwort selbst wird nirgends abgelegt. Im App-Bundle stehen damit nur URL
 * und Anon Key — beide ohne Anmeldung wertlos, weil RLS auf `auth.uid()`
 * filtert.
 *
 * Frueher stand das Konto in der `.env` (`EXPO_PUBLIC_SUPABASE_EMAIL` /
 * `_PASSWORD`). Das war kuerzer, legte das Passwort aber einkompiliert in
 * jedes Bundle — wer eine APK auseinandernahm, kam an die Dokumente.
 *
 * **Kein anonymer Rueckfall mehr.** Er waere hier eine Falle: wer sich
 * abmeldet und die App neu startet, bekaeme still eine zweite Identitaet mit
 * leerer Bibliothek, und der naechste Abgleich schoebe seinen Bestand dorthin.
 * Ohne Anmeldung passiert deshalb schlicht nichts.
 *
 * Das Konto selbst legt `scripts/account.mjs` an (`npm run konto`) — einmalig,
 * ueber den Service-Role-Key, an der VORHANDENEN Kennung. Siehe dort.
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

export const STORAGE_BUCKET = 'documents';

/**
 * Wer gerade angemeldet ist — `null`, wenn niemand.
 *
 * Frueher hiess das `ensureSession` und legte notfalls eine anonyme Identitaet
 * an. Der Name waere jetzt eine Falschaussage: hier entsteht nichts, hier wird
 * nachgesehen. Der Aufruf kostet nach dem ersten Mal nichts — die Session
 * liegt im Arbeitsspeicher des Clients.
 */
export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** Wer die App gerade ist — fuer die Zeile "Konto" in den Einstellungen. */
export interface Identity {
  userId: string;
  email: string | null;
}

export async function currentIdentity(): Promise<Identity | null> {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user === undefined) return null;

  return { userId: user.id, email: user.email ?? null };
}

function client(): SupabaseClient {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');
  return supabase;
}

/**
 * Fehlermeldungen von Supabase sind englisch und technisch. Die drei, die im
 * Alltag wirklich vorkommen, bekommen einen deutschen Satz; alles andere geht
 * unveraendert durch, damit nichts stillschweigend verschwindet.
 */
function readable(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-Mail oder Passwort stimmt nicht.';
  }
  if (lower.includes('email logins are disabled') || lower.includes('disabled')) {
    return 'E-Mail-Anmeldung ist im Supabase-Projekt nicht aktiviert.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Diese Adresse ist noch nicht bestätigt. "npm run konto" erledigt das mit.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Keine Verbindung zum Server.';
  }
  return message;
}

/** Anmelden. Wirft mit einem deutschen Satz, den das Sheet direkt anzeigt. */
export async function logIn(email: string, password: string): Promise<Identity> {
  const { data, error } = await client().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(readable(error.message));

  const user = data.user;
  if (user === null) throw new Error('Die Anmeldung kam ohne Konto zurück.');
  return { userId: user.id, email: user.email ?? null };
}

/**
 * Abmelden — die Session geht, der lokale Bestand bleibt.
 *
 * Die lokale Datenbank ist die Wahrheitsquelle (CLAUDE.md); sie hier zu leeren
 * waere ein Datenverlust fuer einen Vorgang, der nur die Identitaet betrifft.
 * Wer sich wieder anmeldet, findet alles vor.
 */
export async function logOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw new Error(readable(error.message));
}
