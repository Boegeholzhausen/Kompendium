/**
 * Die Voreinstellungen nach oben — der letzte Schritt.
 */
import { readSettings, readSyncState, writeSyncState, SYNCED_SETTING_KEYS } from '../../db/repository';
import { supabase } from '../../supabase';

/**
 * Die Voreinstellungen — der letzte Schritt.
 *
 * Textgroesse, Abdunkeln, Darstellung, Sortierung. Sie haengen am Konto und
 * nicht am Geraet, gehen aber NICHT ueber die Outbox: die kennt nur Dokumente,
 * und eine zweite Buchhaltung fuer fuenf Schluessel waere Aufwand ohne Nutzen.
 *
 * Stattdessen merkt sich der Abgleich, was er zuletzt hochgeschickt hat
 * (`settings_pushed`), und schickt nur, was seither anders ist. Ohne diesen
 * Vergleich schoebe jedes Geraet bei jedem Abgleich seinen alten Stand ueber
 * den neuen des anderen — die Textgroesse spraenge dann zwischen zwei Werten
 * hin und her, je nachdem, wer zuletzt synchronisiert hat.
 *
 * Konflikt: der juengere `updated_at`-Wert gewinnt (der Abruf schreibt in
 * dieser Reihenfolge). Eine Zusammenfuehrung waere fuer eine Voreinstellung
 * Aufwand ohne Nutzen — es gibt nichts zu vereinigen, nur zu waehlen.
 */
export async function pushSettings(userId: string): Promise<string[]> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');

  const current = await readSettings(SYNCED_SETTING_KEYS);
  const last = parseSnapshot(await readSyncState('settings_pushed'));

  const changed = Object.keys(current).filter((key) => current[key] !== last[key]);
  if (changed.length === 0) return [];

  const { error } = await supabase.from('user_settings').upsert(
    changed.map((key) => ({ owner_id: userId, key, value: current[key] })),
    { onConflict: 'owner_id,key' }
  );
  if (error) return [`Einstellungen: ${error.message}`];

  await writeSyncState('settings_pushed', JSON.stringify(current));
  return [];
}

/** Der gemerkte Stand; ein kaputter Text heisst schlicht "noch nichts". */
function parseSnapshot(raw: string | null): Record<string, string> {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}
