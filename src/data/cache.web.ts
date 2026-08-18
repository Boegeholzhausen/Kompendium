/**
 * Dateicache fuer den Web-Export — im Arbeitsspeicher.
 *
 * `expo-file-system` hat im Browser kein Dateisystem, auf das sich ein
 * Dokument dauerhaft legen liesse. Der Web-Build ist im Projekt allein die
 * Bildkontrolle gegen den Prototyp (README, Abschnitt "Pruefungen"), deshalb
 * genuegt hier eine Ablage, die den Seitenaufruf ueberdauert und sonst nichts.
 *
 * Der Import laesst sich damit im Browser vollstaendig durchspielen: Datei
 * waehlen, Zwischenablage, URL — nur ueberlebt das Ergebnis kein Neuladen.
 */
const store = new Map<string, string>();

export async function writeDocument(key: string, html: string): Promise<number> {
  store.set(key, html);
  return html.length;
}

export async function readDocument(key: string): Promise<string | null> {
  return store.get(key) ?? null;
}

/**
 * Im Browser gibt es keinen Dateipfad, den ein System-Sheet oeffnen koennte —
 * das Teilen faellt im Web-Bild deshalb auf den Titel zurueck.
 */
export function documentUri(_key: string): string | null {
  return null;
}

export async function deleteDocument(key: string): Promise<void> {
  store.delete(key);
}

export async function cacheSize(): Promise<number> {
  let total = 0;
  for (const html of store.values()) total += html.length;
  return total;
}

export async function clearCache(keep: string[] = []): Promise<string[]> {
  const kept = new Set(keep);
  const dropped: string[] = [];

  for (const key of [...store.keys()]) {
    if (kept.has(key)) continue;
    dropped.push(key);
    store.delete(key);
  }

  return dropped;
}
