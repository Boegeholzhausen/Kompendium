/**
 * Dasselbe Repository fuer den Web-Export — im Arbeitsspeicher statt in SQLite.
 *
 * Warum ueberhaupt eine zweite Fassung: expo-sqlite laeuft im Browser ueber
 * WebAssembly und braucht dafuer die Kopfzeilen `Cross-Origin-Opener-Policy`
 * und `Cross-Origin-Embedder-Policy`. Der statische Build wird im Projekt mit
 * `python3 -m http.server` ausgeliefert (README, Abschnitt "Pruefungen"), und
 * der schickt sie nicht. Da der Web-Build ausdruecklich nur die Bildkontrolle
 * gegen den Prototyp ist — Zielplattform bleibt mobile only — waere die
 * Alternative, die Kontrolle ganz zu verlieren.
 *
 * Folge: im Browser faengt jeder Seitenaufruf mit dem Beispiel-Bestand an.
 * Genau das will die Bildkontrolle auch — ein Screenshot soll nicht davon
 * abhaengen, was beim letzten Lauf angeklickt wurde.
 *
 * Dieselbe Ueberlegung wie bei `screens/viewer/DocumentView.web.tsx`.
 *
 * Zwei Schalter fuer die Bildkontrolle der Zustaende aus Schritt 8, beide nur
 * hier im Web-Stub und nie in der App:
 *
 *   ?bestand=leer    startet ohne Dokumente — Blatt `4a`
 *   ?laden=1200      verzoegert das erste Lesen um 1200 ms — Blatt `4b`
 *
 * Ohne sie waeren genau die zwei Zustaende, die es nur beim allerersten Start
 * oder nur fuer eine halbe Sekunde gibt, die einzigen, die nie jemand
 * nachsieht.
 */
import { seedFolders, seedLibrary } from '../sampleLibrary';
import type { LibraryFolder, StoredDocument } from '../library';
import type { DocumentPatch, Snapshot } from './repository';

export type { DocumentPatch, Snapshot } from './repository';

const documents = new Map<string, StoredDocument>();
const folders: LibraryFolder[] = [];
const settings: Record<string, string> = {};

let seeded = false;

/** Ein Suchparameter der Adresse; ausserhalb des Browsers immer `null`. */
function param(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

function seed(): void {
  if (seeded) return;
  seeded = true;
  if (param('bestand') === 'leer') return;
  for (const document of seedLibrary) documents.set(document.id, { ...document });
  folders.push(...seedFolders.map((folder) => ({ ...folder })));
}

export async function loadSnapshot(): Promise<Snapshot> {
  const delay = Number(param('laden') ?? 0);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  seed();
  return {
    documents: [...documents.values()].map((document) => ({ ...document })),
    folders: folders.map((folder) => ({ ...folder })),
    settings: { ...settings },
  };
}

export async function insertDocument(document: StoredDocument): Promise<void> {
  seed();
  documents.set(document.id, { ...document });
}

export async function updateDocuments(ids: string[], patch: DocumentPatch): Promise<void> {
  for (const id of ids) {
    const current = documents.get(id);
    if (current === undefined) continue;
    documents.set(id, { ...current, ...patch });
  }
}

export async function expiredTrashIds(
  before: number
): Promise<{ id: string; cacheKey: string | null }[]> {
  seed();
  return [...documents.values()]
    .filter((document) => document.trashedAt !== null && document.trashedAt < before)
    .map((document) => ({ id: document.id, cacheKey: document.cacheKey }));
}

export async function deleteDocuments(ids: string[]): Promise<void> {
  for (const id of ids) documents.delete(id);
}

export async function upsertFolder(folder: LibraryFolder): Promise<void> {
  const at = folders.findIndex((entry) => entry.name === folder.name);
  if (at === -1) folders.push({ ...folder });
  else folders[at] = { ...folder };
}

export async function renameFolder(from: string, to: string): Promise<void> {
  const folder = folders.find((entry) => entry.name === from);
  if (folder) folder.name = to;
  for (const [id, document] of documents) {
    if (document.folderName === from) documents.set(id, { ...document, folderName: to });
  }
}

export async function deleteFolder(name: string): Promise<void> {
  const at = folders.findIndex((entry) => entry.name === name);
  if (at !== -1) folders.splice(at, 1);
  for (const [id, document] of documents) {
    if (document.folderName === name) documents.set(id, { ...document, folderName: null });
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  settings[key] = value;
}

/**
 * Im Web-Bild gibt es nichts hochzuschicken: `pull.web.ts` und `push.web.ts`
 * tun beide nichts, und ein Bestand im Arbeitsspeicher ueberlebt den naechsten
 * Seitenaufruf nicht. Die Null haelt den Abgleich damit auf "Synchron" —
 * ehrlicher als "Änderungen offen" fuer einen Weg, den es hier nicht gibt.
 */
export async function countOutbox(): Promise<number> {
  return 0;
}
