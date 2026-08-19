/**
 * Was man mit einem Dokument in einer Liste tun kann — Kontextmenue,
 * Verschieben-Sheet und der Toast mit "Rueckgaengig".
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
import React, { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isArchived, isUnread, type StoredDocument } from '../../data/library';
import { useDocumentStore } from '../../state/documents';
import { useLibraryStore } from '../../state/library';
import { size } from '../../theme';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { Archive, Check, CheckCircle, FolderOpen, Star, Trash, type Icon } from '../../ui/icons';
import { Toast } from '../../ui/Toast';
import { MoveSheet } from '../folders/MoveSheet';

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
  /**
   * Setzen, nicht umschalten: bei gemischter Auswahl waere ein Umschalten
   * nicht vorhersagbar. Sind schon alle Favorit, nimmt der Griff sie weg.
   */
  toggleFavoriteSelection: () => void;
  /** Dieselbe Regel fuer den Workflow-Status: sind alle gelesen, werden sie ungelesen. */
  readSelection: () => void;
  archiveSelection: () => void;
  trashSelection: (ids: string[]) => void;
}

export function useDocumentActions(): DocumentActions {
  const insets = useSafeAreaInsets();

  const allDocuments = useDocumentStore((state) => state.documents);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const setFavorite = useDocumentStore((state) => state.setFavorite);
  const setRead = useDocumentStore((state) => state.setRead);
  const setArchived = useDocumentStore((state) => state.setArchived);
  const toggleRead = useDocumentStore((state) => state.toggleRead);
  const toggleArchived = useDocumentStore((state) => state.toggleArchived);
  const trash = useDocumentStore((state) => state.trash);
  const restoreFromTrash = useDocumentStore((state) => state.restoreFromTrash);
  const setFolder = useDocumentStore((state) => state.setFolder);

  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const startSelection = useLibraryStore((state) => state.startSelection);
  const endSelection = useLibraryStore((state) => state.endSelection);

  const [sheet, setSheet] = useState<null | 'move'>(null);
  const [menuFor, setMenuFor] = useState<StoredDocument | null>(null);
  const [undoable, setUndoable] = useState<Undoable | null>(null);

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

  const readSelection = useCallback(() => {
    const ids = [...selectedIds];
    const allRead = ids.every(
      (id) => allDocuments.find((document) => document.id === id)?.readAt !== null
    );
    setRead(ids, !allRead);
    endSelection();
    setUndoable({
      message: allRead ? 'Als ungelesen markiert' : 'Als gelesen markiert',
      icon: CheckCircle,
      undo: () => setRead(ids, allRead),
    });
  }, [allDocuments, endSelection, selectedIds, setRead]);

  const archiveSelection = useCallback(() => {
    const ids = [...selectedIds];
    const allArchived = ids.every(
      (id) => allDocuments.find((document) => document.id === id)?.archivedAt !== null
    );
    setArchived(ids, !allArchived);
    endSelection();
    setUndoable({
      message: allArchived ? 'Aus dem Archiv geholt' : 'Archiviert',
      icon: Archive,
      undo: () => setArchived(ids, allArchived),
    });
  }, [allDocuments, endSelection, selectedIds, setArchived]);

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
            key: 'read',
            label: isUnread(menuFor) ? 'Als gelesen markieren' : 'Als ungelesen markieren',
            icon: CheckCircle,
            onPress: () => {
              const { id } = menuFor;
              const wasUnread = isUnread(menuFor);
              toggleRead(id);
              setMenuFor(null);
              setUndoable({
                message: wasUnread ? 'Als gelesen markiert' : 'Als ungelesen markiert',
                icon: CheckCircle,
                undo: () => setRead([id], !wasUnread),
              });
            },
          },
          {
            key: 'archive',
            label: isArchived(menuFor) ? 'Aus dem Archiv holen' : 'Archivieren',
            icon: Archive,
            onPress: () => {
              const { id } = menuFor;
              const wasArchived = isArchived(menuFor);
              toggleArchived(id);
              setMenuFor(null);
              setUndoable({
                message: wasArchived ? 'Aus dem Archiv geholt' : 'Archiviert',
                icon: Archive,
                undo: () => setArchived([id], wasArchived),
              });
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

      <ContextMenu visible={menuFor !== null} items={menuItems} onClose={() => setMenuFor(null)} />

      <Toast
        visible={undoable !== null}
        message={undoable?.message ?? ''}
        icon={undoable?.icon ?? Check}
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
    toggleFavoriteSelection,
    readSelection,
    archiveSelection,
    trashSelection,
  };
}
