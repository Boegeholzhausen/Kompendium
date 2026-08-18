/**
 * Was man mit einem Dokument in einer Liste tun kann — Kontextmenue,
 * Verschieben-Sheet, Tag-Sheet und der Toast mit "Rueckgaengig".
 *
 * Bibliothek (Screen 1) und Ordner-Detail (Screen 4) zeigen dieselbe Liste und
 * brauchen dieselben Griffe. Sie stehen deshalb hier und nicht zweimal in den
 * Screens: ein Modul, das zwei andere brauchen, gehoert in ein drittes. Waeren
 * es zwei Kopien, liefe die eine frueher oder spaeter der anderen hinterher —
 * und ausgerechnet die Reihenfolge im Kontextmenue faellt sofort auf.
 *
 * Der Hook haelt den ganzen fluechtigen Zustand dieser Griffe (welches Menue
 * offen ist, welches Sheet, was zuletzt geschah) und gibt ihn als `overlays`
 * zurueck — ein JSX-Stueck, das der Screen ganz unten einhaengt. Die Auswahl
 * selbst liegt weiterhin im Bibliothek-Zustand, weil sie ueber Screens hinweg
 * gilt.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LibraryTag, StoredDocument } from '../../data/library';
import { useDocumentStore } from '../../state/documents';
import { useLibraryStore } from '../../state/library';
import { size } from '../../theme';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { Check, FolderOpen, Star, Tag as TagIcon, Trash, type Icon } from '../../ui/icons';
import { Toast } from '../../ui/Toast';
import { MoveSheet } from '../folders/MoveSheet';
import { TagSheet } from '../viewer/TagSheet';

/**
 * Was zuletzt geschah — der Toast bietet dafuer 5 Sekunden "Rueckgaengig".
 *
 * Ohne `undo` traegt er nur die Meldung: ein gescheiterter Import (Blatt `3g`)
 * hat nichts, was sich zuruecknehmen liesse, und eine Schaltflaeche ohne
 * Wirkung waere schlimmer als keine.
 */
export interface Undoable {
  message: string;
  icon?: Icon;
  undo?: () => void;
}

export interface DocumentActions {
  /** Langer Druck auf eine Zeile. */
  openMenu: (document: StoredDocument) => void;
  /** Sheets, Menue und Toast — vom Screen ganz unten eingehaengt. */
  overlays: React.ReactNode;
  /** Meldung ohne eigenen Griff, etwa nach einem Import. */
  notify: (undoable: Undoable) => void;
  openMove: () => void;
  openTag: () => void;
  /**
   * Setzen, nicht umschalten: bei gemischter Auswahl waere ein Umschalten
   * nicht vorhersagbar. Sind schon alle Favorit, nimmt der Griff sie weg.
   */
  toggleFavoriteSelection: () => void;
  trashSelection: (ids: string[]) => void;
}

export function useDocumentActions(): DocumentActions {
  const insets = useSafeAreaInsets();

  const allDocuments = useDocumentStore((state) => state.documents);
  const tags = useDocumentStore((state) => state.tags);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const setFavorite = useDocumentStore((state) => state.setFavorite);
  const assignTag = useDocumentStore((state) => state.assignTag);
  const removeTag = useDocumentStore((state) => state.removeTag);
  const createTag = useDocumentStore((state) => state.createTag);
  const trash = useDocumentStore((state) => state.trash);
  const restoreFromTrash = useDocumentStore((state) => state.restoreFromTrash);
  const setFolder = useDocumentStore((state) => state.setFolder);

  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const startSelection = useLibraryStore((state) => state.startSelection);
  const endSelection = useLibraryStore((state) => state.endSelection);

  const [sheet, setSheet] = useState<null | 'move' | 'tag'>(null);
  const [menuFor, setMenuFor] = useState<StoredDocument | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [undoable, setUndoable] = useState<Undoable | null>(null);

  /** Tags, die ALLE gewaehlten Dokumente tragen — nur die zeigt das Sheet gesetzt. */
  const commonTagIds = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const selected = allDocuments.filter((document) => selectedIds.includes(document.id));
    if (selected.length === 0) return [];
    return selected[0].tagIds.filter((id) =>
      selected.every((document) => document.tagIds.includes(id))
    );
  }, [allDocuments, selectedIds]);

  /** Anzahl der Dokumente je Tag — die Zahl rechts in der Tag-Zeile. */
  const tagUsage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of allDocuments) {
      for (const id of entry.tagIds) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [allDocuments]);

  const trashSelection = useCallback(
    (ids: string[]) => {
      trash(ids);
      endSelection();
      setUndoable({
        message: ids.length === 1 ? 'In den Papierkorb' : `${ids.length} in den Papierkorb`,
        icon: Trash,
        undo: () => restoreFromTrash(ids),
      });
    },
    [endSelection, restoreFromTrash, trash]
  );

  const toggleFavoriteSelection = useCallback(() => {
    const allFavorite = selectedIds.every(
      (id) => allDocuments.find((document) => document.id === id)?.favorite === true
    );
    setFavorite(selectedIds, !allFavorite);
    setUndoable({
      message: allFavorite ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt',
      icon: Star,
      undo: () => setFavorite(selectedIds, allFavorite),
    });
  }, [allDocuments, selectedIds, setFavorite]);

  const toggleBulkTag = useCallback(
    (tag: LibraryTag) => {
      const all = selectedIds.every((id) =>
        allDocuments.find((document) => document.id === id)?.tagIds.includes(tag.id)
      );
      for (const id of selectedIds) {
        if (all) removeTag(id, tag.id);
        else assignTag(id, tag.id);
      }
      setUndoable({
        message: all ? `Tag „${tag.name}“ entfernt` : `Tag „${tag.name}“ gesetzt`,
        undo: () => {
          for (const id of selectedIds) {
            if (all) assignTag(id, tag.id);
            else removeTag(id, tag.id);
          }
        },
      });
    },
    [allDocuments, assignTag, removeTag, selectedIds]
  );

  const menuItems: ContextMenuItem[] =
    menuFor === null
      ? []
      : [
          {
            key: 'select',
            label: 'Auswählen',
            icon: Check,
            onPress: () => {
              startSelection(menuFor.id);
              setMenuFor(null);
            },
          },
          {
            key: 'move',
            label: 'Verschieben',
            icon: FolderOpen,
            onPress: () => {
              startSelection(menuFor.id);
              setMenuFor(null);
              setSheet('move');
            },
          },
          {
            key: 'tag',
            label: 'Taggen',
            icon: TagIcon,
            onPress: () => {
              startSelection(menuFor.id);
              setMenuFor(null);
              setSheet('tag');
            },
          },
          {
            key: 'favorite',
            label: menuFor.favorite ? 'Favorit entfernen' : 'Zu Favoriten',
            icon: Star,
            onPress: () => {
              toggleFavorite(menuFor.id);
              setMenuFor(null);
            },
          },
          {
            key: 'trash',
            label: 'In den Papierkorb',
            icon: Trash,
            destructive: true,
            onPress: () => {
              const id = menuFor.id;
              setMenuFor(null);
              trashSelection([id]);
            },
          },
        ];

  const overlays = (
    <>
      <MoveSheet
        visible={sheet === 'move'}
        documentIds={selectedIds}
        onClose={() => setSheet(null)}
        onMoved={(folderName) => {
          const ids = [...selectedIds];
          const before = ids.map(
            (id) => allDocuments.find((document) => document.id === id)?.folderName ?? null
          );
          endSelection();
          setUndoable({
            message:
              folderName === null ? 'Aus dem Ordner genommen' : `Nach „${folderName}“ verschoben`,
            icon: FolderOpen,
            undo: () => ids.forEach((id, index) => setFolder([id], before[index])),
          });
        }}
      />

      <TagSheet
        visible={sheet === 'tag'}
        as="modal"
        title={
          selectedIds.length === 1 ? 'Tag zuweisen' : `Tags für ${selectedIds.length} Dokumente`
        }
        query={tagQuery}
        onChangeQuery={setTagQuery}
        tags={tags}
        assigned={commonTagIds}
        usage={tagUsage}
        onToggle={toggleBulkTag}
        onCreate={(name) => {
          const tag = createTag(name);
          for (const id of selectedIds) assignTag(id, tag.id);
          setTagQuery('');
          setUndoable({
            message: `Tag „${tag.name}“ gesetzt`,
            undo: () => {
              for (const id of selectedIds) removeTag(id, tag.id);
            },
          });
        }}
        onRemove={(tagId) => {
          for (const id of selectedIds) removeTag(id, tagId);
        }}
        onClose={() => setSheet(null)}
      />

      <ContextMenu visible={menuFor !== null} items={menuItems} onClose={() => setMenuFor(null)} />

      <Toast
        visible={undoable !== null}
        message={undoable?.message ?? ''}
        icon={undoable?.icon ?? TagIcon}
        actionLabel={undoable?.undo ? 'Rückgängig' : undefined}
        onAction={() => {
          undoable?.undo?.();
          setUndoable(null);
        }}
        onHide={() => setUndoable(null)}
        style={{ bottom: insets.bottom + size.screenPadding }}
      />
    </>
  );

  return {
    openMenu: setMenuFor,
    overlays,
    notify: setUndoable,
    openMove: () => setSheet('move'),
    openTag: () => setSheet('tag'),
    toggleFavoriteSelection,
    trashSelection,
  };
}
