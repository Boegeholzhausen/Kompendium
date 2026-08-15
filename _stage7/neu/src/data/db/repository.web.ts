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
 */
import { libraryTags, seedFolders, seedLibrary } from '../sampleLibrary';
import type { LibraryFolder, LibraryTag, StoredDocument } from '../library';
import type { DocumentPatch, Snapshot } from './repository';

export type { DocumentPatch, Snapshot } from './repository';

const documents = new Map<string, StoredDocument>();
const folders: LibraryFolder[] = [];
const tags: LibraryTag[] = [];
const settings: Record<string, string> = {};

let seeded = false;

function seed(): void {
  if (seeded) return;
  seeded = true;
  for (const document of seedLibrary) documents.set(document.id, { ...document });
  folders.push(...seedFolders.map((folder) => ({ ...folder })));
  tags.push(...libraryTags.map((tag) => ({ ...tag })));
}

export async function loadSnapshot(): Promise<Snapshot> {
  seed();
  return {
    documents: [...documents.values()].map((document) => ({ ...document })),
    folders: folders.map((folder) => ({ ...folder })),
    tags: tags.map((tag) => ({ ...tag })),
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

export async function setDocumentTags(documentId: string, tagIds: string[]): Promise<void> {
  const current = documents.get(documentId);
  if (current === undefined) return;
  documents.set(documentId, { ...current, tagIds: [...tagIds] });
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

export async function upsertTag(tag: LibraryTag): Promise<void> {
  const at = tags.findIndex((entry) => entry.id === tag.id);
  if (at === -1) tags.push({ ...tag });
  else tags[at] = { ...tag };
}

export async function deleteTag(tagId: string): Promise<void> {
  const at = tags.findIndex((entry) => entry.id === tagId);
  if (at !== -1) tags.splice(at, 1);
  for (const [id, document] of documents) {
    if (document.tagIds.includes(tagId)) {
      documents.set(id, { ...document, tagIds: document.tagIds.filter((entry) => entry !== tagId) });
    }
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  settings[key] = value;
}
