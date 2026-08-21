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
 * Laeuft gerade ein Anmeldevorgang?
 *
 * Ohne diesen Schalter legte `ensureSession` auf dem Zweitgeraet zuerst eine
 * anonyme Identitaet an — und der erste Abruf liefe unter ihr leer, weil RLS
 * auf `owner_id = auth.uid()` filtert. Der Nutzer saehe eine leere Bibliothek
 * und wuesste nicht, warum.
 */
let signingIn = false;

/**
 * Anmeldung ohne Login-Screen: beim ersten Start eine anonyme Identitaet
 * anlegen, Session in AsyncStorage. Kein Formular, kein Passwort.
 *
 * Der Weg zur E-Mail steht darunter — er ERSETZT diese Identitaet nie, er
 * benennt sie. Siehe `linkEmail`.
 */
export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id) return data.session.user.id;

  // Waehrend einer E-Mail-Anmeldung entsteht hier nichts: die Identitaet, auf
  // die der Nutzer gerade wartet, kommt aus `confirmSignIn`.
  if (signingIn) return null;

  const { data: signedIn, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return signedIn.user?.id ?? null;
}

export const STORAGE_BUCKET = 'documents';

// ── Identitaet: E-Mail statt anonym ─────────────────────────────────────────

/**
 * Wer die App gerade ist.
 *
 * `anonymous` unterscheidet die beiden Zustaende, die die Einstellungen zeigen:
 * eine Geraetesitzung ohne Namen — oder ein Konto, an dem eine E-Mail haengt
 * und mit dem sich ein zweites Geraet anmelden kann.
 */
export interface Identity {
  userId: string;
  email: string | null;
  anonymous: boolean;
}

export async function currentIdentity(): Promise<Identity | null> {
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  if (user === undefined) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    // Supabase fuehrt das Merkmal an der Identitaet selbst. Es an einer
    // vorhandenen E-Mail festzumachen waere eine Vermutung: zwischen
    // `linkEmail` und `confirmEmail` steht dort schon eine Adresse, die noch
    // niemand bestaetigt hat.
    anonymous: user.is_anonymous === true,
  };
}

/**
 * Warum ein sechsstelliger Code und kein Magic Link.
 *
 * Ein Link muesste ueber einen Deep-Link zurueck in die App fuehren, und das
 * bedient Expo Go nicht verlaesslich — die App laeuft dort unter dem Schema von
 * Expo Go und nicht unter einem eigenen. Der Code steht in derselben Mail und
 * funktioniert ueberall: abtippen, fertig. Keine neuen nativen Module
 * (CLAUDE.md), kein Dev Build.
 */
const OTP_HINT = 'Der Code steht in der Mail, die gerade angekommen ist.';

/**
 * Fehlermeldungen von Supabase sind englisch und technisch. Die drei, die im
 * Alltag wirklich vorkommen, bekommen einen deutschen Satz; alles andere geht
 * unveraendert durch, damit nichts stillschweigend verschwindet.
 */
function readable(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('expired') || lower.includes('invalid')) {
    return 'Der Code stimmt nicht oder ist abgelaufen.';
  }
  if (lower.includes('already been registered') || lower.includes('already registered')) {
    return 'Diese Adresse wird schon von einem anderen Konto benutzt.';
  }
  if (lower.includes('disabled')) {
    return 'E-Mail-Anmeldung ist im Supabase-Projekt nicht aktiviert.';
  }
  return message;
}

function client(): SupabaseClient {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');
  return supabase;
}

function identityOf(user: { id: string; email?: string; is_anonymous?: boolean }): Identity {
  return { userId: user.id, email: user.email ?? null, anonymous: user.is_anonymous === true };
}

/**
 * Erstgeraet: die E-Mail an die VORHANDENE Identitaet haengen.
 *
 * `updateUser` und nicht `signInWithOtp`: die anonyme Kennung muss erhalten
 * bleiben. Wuerde sie ersetzt, waeren alle vorhandenen Zeilen oben verwaist —
 * `owner_id` zeigte auf eine Identitaet, an die niemand mehr herankommt, und
 * nur der Service-Role-Key koennte sie noch zuordnen.
 *
 * Supabase schickt daraufhin eine Bestaetigungsmail mit Code; eingeloest wird
 * er mit `confirmEmail`.
 */
export async function linkEmail(email: string): Promise<string> {
  const { error } = await client().auth.updateUser({ email: email.trim() });
  if (error) throw new Error(readable(error.message));
  return OTP_HINT;
}

/** Erstgeraet, zweiter Schritt: den Code aus der Bestaetigungsmail einloesen. */
export async function confirmEmail(email: string, token: string): Promise<Identity> {
  const { data, error } = await client().auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    // `email_change`, nicht `email`: bestaetigt wird eine Adresse an einer
    // bestehenden Identitaet, keine Neuanmeldung.
    type: 'email_change',
  });
  if (error) throw new Error(readable(error.message));

  const user = data.user;
  if (user === null) throw new Error('Die Bestätigung kam ohne Konto zurück.');
  return identityOf(user);
}

/**
 * Zweitgeraet, erster Schritt: Code an die verknuepfte Adresse schicken.
 *
 * Ab hier legt `ensureSession` keine anonyme Identitaet mehr an (siehe
 * `signingIn`) — sonst liefe der erste Abruf unter einer fremden Kennung leer.
 */
export async function signInWithEmail(email: string): Promise<string> {
  signingIn = true;
  const { error } = await client().auth.signInWithOtp({ email: email.trim() });
  if (error) {
    signingIn = false;
    throw new Error(readable(error.message));
  }
  return OTP_HINT;
}

/** Zweitgeraet, zweiter Schritt: der Code aus der Mail. */
export async function confirmSignIn(email: string, token: string): Promise<Identity> {
  try {
    const { data, error } = await client().auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    });
    if (error) throw new Error(readable(error.message));

    const user = data.user;
    if (user === null) throw new Error('Die Anmeldung kam ohne Konto zurück.');
    return identityOf(user);
  } finally {
    signingIn = false;
  }
}

/** Einen abgebrochenen Anmeldevorgang wieder freigeben. */
export function cancelSignIn(): void {
  signingIn = false;
}

/**
 * Abmelden — die Session geht, der lokale Bestand bleibt.
 *
 * Die lokale Datenbank ist die Wahrheitsquelle (CLAUDE.md); sie beim Abmelden
 * zu leeren waere ein Datenverlust fuer einen Vorgang, der nur die Identitaet
 * betrifft. Wer sich danach mit derselben Adresse wieder anmeldet, findet
 * alles vor.
 */
export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw new Error(readable(error.message));
}
