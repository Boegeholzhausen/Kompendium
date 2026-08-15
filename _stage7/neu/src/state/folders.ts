/**
 * Zustand der Ordner.
 *
 * Das Handoff-Dokument fuehrt am Dokument ein `folderId`. Gezeigt wird in allen
 * Blaettern (`3a`, `3b`, `2d`) aber der Name, und eine Ausweisspalte haette in
 * dieser App keinen zweiten Leser — deshalb ist der Name zugleich der Ausweis,
 * auch in der Datenbank (`documents.folder_name`, siehe `data/db/schema.ts`).
 *
 * Folge davon: Umbenennen wirkt an zwei Stellen. In der Datenbank erledigt das
 * `repository.renameFolder` in einer Transaktion; im Zustand rufen die Screens
 * `renameFolder` hier UND `renameFolderEverywhere` im Dokument-Zustand.
 *
 * Die Ordnerfarbe traegt laut Handoff-Dokument nur das Icon, nie eine Flaeche.
 * Sechs Farben stehen zur Wahl (Screen 17), nicht acht.
 */
import { create } from 'zustand';

import { persist } from '../data/db/persist';
import * as repository from '../data/db/repository';
import type { LibraryFolder } from '../data/library';
import { folderColorNames, tagPalette, type FolderColorName } from '../theme/colors';

export type { LibraryFolder } from '../data/library';

/** Die sechs waehlbaren Ordnerfarben als Wertepaare fuer die Farbkacheln. */
export const folderColorChoices: { key: FolderColorName; value: string }[] = folderColorNames.map(
  (key) => ({ key, value: tagPalette[key] })
);

interface FolderState {
  folders: LibraryFolder[];
  hydrate: (folders: LibraryFolder[]) => void;
  /** Legt an; ein vorhandener Name gewinnt, damit nichts doppelt entsteht. */
  createFolder: (name: string, color: string, keepOffline: boolean) => LibraryFolder;
  renameFolder: (from: string, to: string) => void;
  setKeepOffline: (name: string, keep: boolean) => void;
}

export const useFolderStore = create<FolderState>((set, get) => ({
  folders: [],

  hydrate: (folders) => set({ folders }),

  createFolder: (name, color, keepOffline) => {
    const trimmed = name.trim();
    const existing = get().folders.find(
      (folder) => folder.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) return existing;

    const folder: LibraryFolder = { name: trimmed, color, keepOffline };
    persist(() => repository.upsertFolder(folder));
    set((state) => ({ folders: [...state.folders, folder] }));
    return folder;
  },

  renameFolder: (from, to) => {
    persist(() => repository.renameFolder(from, to.trim()));
    set((state) => ({
      folders: state.folders.map((folder) =>
        folder.name === from ? { ...folder, name: to.trim() } : folder
      ),
    }));
  },

  setKeepOffline: (name, keep) =>
    set((state) => {
      const folder = state.folders.find((entry) => entry.name === name);
      if (folder === undefined) return state;

      const updated = { ...folder, keepOffline: keep };
      persist(() => repository.upsertFolder(updated));
      return {
        folders: state.folders.map((entry) => (entry.name === name ? updated : entry)),
      };
    }),
}));

/** Farbe eines Ordners aus dem Zustand; unbekannte Namen bleiben neutral. */
export function colorOf(folders: LibraryFolder[], name: string | null): string {
  if (name === null) return tagPalette.slate;
  return folders.find((folder) => folder.name === name)?.color ?? tagPalette.slate;
}
