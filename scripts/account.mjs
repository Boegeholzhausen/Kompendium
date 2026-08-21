/**
 * Aus der anonymen Geraete-Identitaet ein richtiges Konto machen.
 *
 *   node scripts/account.mjs meine@adresse.de "mein-passwort"
 *   node scripts/account.mjs meine@adresse.de "mein-passwort" --dry
 *
 * Danach in der App: Einstellungen → Konto → Anmelden, einmal je Geraet. Die
 * Anmeldung bleibt bestehen, und jedes weitere Geraet sieht denselben Bestand.
 *
 * Das Passwort geht von hier direkt zu Supabase und wird dort gehasht abgelegt.
 * Im Projekt bleibt davon nichts zurueck — insbesondere nicht in der `.env`,
 * denn alles mit `EXPO_PUBLIC_` im Namen wird in jedes App-Bundle
 * einkompiliert.
 *
 * ## Warum ein Skript und nicht die App
 *
 * Der springende Punkt ist die **Kennung**: sie muss dieselbe bleiben. Jede
 * Zeile in Supabase gehoert ihr (`owner_id`), RLS laesst nur sie daran, und
 * `scripts/upload.mjs` hat unter genau dieser Kennung hochgeladen. Wuerde man
 * sich stattdessen mit einer neuen Adresse *neu* anmelden, entstuende eine
 * zweite Identitaet — der ganze bisherige Bestand haenge an der ersten und
 * waere nur noch mit dem Service-Role-Key wieder zuzuordnen.
 *
 * `updateUserById` setzt E-Mail und Passwort an der VORHANDENEN Zeile in
 * `auth.users`. Die Kennung bleibt, `is_anonymous` wird `false`, alles andere
 * ruehrt sich nicht. `email_confirm: true` spart dabei die Bestaetigungsmail:
 * der Service-Role-Key ist bereits der Nachweis, dass hier der Besitzer des
 * Projekts sitzt — eine Mail an sich selbst zu schicken und den Link
 * anzuklicken beantwortete keine offene Frage.
 *
 * Ein zweiter Lauf mit demselben Wert ist harmlos; ein zweiter Lauf mit einem
 * neuen Passwort aendert es — das ist zugleich der Weg zurueck, wenn man es
 * vergessen hat. Die Kennung bleibt dabei, es bewegt sich kein Dokument.
 *
 * Zugangsdaten wie bei `upload.mjs`: URL aus `.env`, Service-Role-Key aus
 * `.env.local`. Der Schluessel umgeht RLS und gehoert ausschliesslich auf
 * diesen Rechner.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const ROOT = resolve(import.meta.dirname, '..');

/** `.env`-Dateien lesen, ohne ein Paket dafuer — wie in `upload.mjs`. */
async function readEnv(name) {
  try {
    const text = await readFile(join(ROOT, name), 'utf8');
    const values = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const at = trimmed.indexOf('=');
      if (at === -1) continue;
      values[trimmed.slice(0, at).trim()] = trimmed.slice(at + 1).trim();
    }
    return values;
  } catch {
    return {};
  }
}

function fail(message) {
  console.error(`\nFehler: ${message}\n`);
  process.exit(1);
}

/**
 * Welche Identitaet umgestellt wird.
 *
 * Steht `KOMPENDIUM_OWNER_ID` in `.env.local`, gilt sie — das ist dieselbe
 * Kennung, unter der `upload.mjs` schreibt. Sonst: bei genau einer Identitaet
 * im Projekt ist die Sache klar, bei mehreren fragt das Skript lieber nach,
 * statt die falsche umzustellen.
 */
async function pickUser(admin, configured) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) fail(`Die Identitaeten liessen sich nicht lesen: ${error.message}`);

  const users = data.users ?? [];
  if (users.length === 0) {
    fail(
      'Es gibt noch keine Identitaet in diesem Supabase-Projekt.\n' +
        'Starte die App einmal auf dem Handy — sie meldet sich beim ersten Start\n' +
        'anonym an und legt sie dabei an.'
    );
  }

  if (configured) {
    const found = users.find((user) => user.id === configured);
    if (!found) {
      fail(
        `KOMPENDIUM_OWNER_ID (${configured}) gehoert zu keiner Identitaet in diesem Projekt.\n` +
          'Trage die richtige in .env.local ein oder nimm den Eintrag heraus.'
      );
    }
    return found;
  }

  if (users.length > 1) {
    console.error('\nEs gibt mehrere Identitaeten in diesem Projekt:\n');
    for (const user of users) {
      const mark = user.is_anonymous ? 'anonym' : (user.email ?? 'ohne Adresse');
      console.error(`  ${user.id}   ${mark}`);
    }
    fail('Trage die richtige in .env.local als KOMPENDIUM_OWNER_ID ein.');
  }

  return users[0];
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const [email, password] = args.filter((arg) => !arg.startsWith('--'));

  if (!email || !password) {
    fail(
      'Aufruf:\n' +
        '  npm run konto -- meine@adresse.de "mein-passwort"\n' +
        '  npm run konto -- meine@adresse.de "mein-passwort" --dry'
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Das ist keine Adresse: ${email}`);
  // Supabase verlangt mindestens sechs Zeichen. Zwoelf, weil es das einzige
  // Geheimnis ist, das zwischen einem Fremden und der Bibliothek steht.
  if (password.length < 12) fail('Das Passwort ist zu kurz (mindestens 12 Zeichen).');

  const env = { ...(await readEnv('.env')), ...(await readEnv('.env.local')) };
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) fail('EXPO_PUBLIC_SUPABASE_URL fehlt in .env.');
  if (!serviceKey) {
    fail(
      'SUPABASE_SERVICE_ROLE_KEY fehlt in .env.local.\n' +
        'Supabase-Dashboard → Project Settings → API → service_role.'
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await pickUser(admin, env.KOMPENDIUM_OWNER_ID);
  const before = user.is_anonymous ? 'anonym' : (user.email ?? 'ohne Adresse');

  console.log(`\nKennung   ${user.id}`);
  console.log(`Bisher    ${before}`);
  console.log(`Neu       ${email}`);

  if (dry) {
    console.log('\n[Probelauf — nichts geschrieben]\n');
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email,
    password,
    // Der Service-Role-Key ist bereits der Nachweis, dass hier der Besitzer
    // sitzt. Eine Bestaetigungsmail an sich selbst beantwortete nichts.
    email_confirm: true,
  });
  if (error) fail(`Die Umstellung schlug fehl: ${error.message}`);

  console.log('\nFertig. Die Kennung ist unveraendert — der Bestand bleibt, wo er ist.');
  console.log('\nJetzt in der App: Einstellungen -> Konto -> Anmelden,');
  console.log(`mit ${email} und diesem Passwort. Einmal je Geraet.\n`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
