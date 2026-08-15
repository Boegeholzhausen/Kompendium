/**
 * Screen 1, 2 und 13 — Bibliothek in Listen- und Kachelansicht (Blaetter `1c`,
 * `1d`) samt Mehrfachauswahl (`3h`).
 *
 * Startbildschirm der App. Wiederfinden ist die haeufigste Aufgabe, deshalb
 * steht ueber der Liste das Suchfeld, darunter die Filterleiste, und erst
 * darunter beginnt der Bestand.
 *
 * Aufbau:
 *   schwebender Kopf   Kopfzeile + Sync-Leiste + Filterleiste (LibraryHeader)
 *                      bzw. im Auswahlmodus die Auswahl-Kopfzeile
 *   Liste              Suchfeld, Platzhalter fuer die Filterleiste, Sektion
 *                      "Neu", Sektionskopf, Dokumentzeilen bzw. Kacheln
 *   FAB                Importieren — entfaellt im Auswahlmodus
 *
 * Warum der Kopf schwebt und nicht in der Liste steht: er schrumpft beim
 * Scrollen von 68 auf 56. Stuende er im Inhalt, wuerde jeder Schrumpfschritt
 * die Liste unter dem Finger verschieben. Als schwebende Ebene aendert er nur
 * sich selbst; der Inhalt haelt seinen Innenabstand oben (`CONTENT_TOP`) und
 * scrollt darunter durch. Genau deshalb wechselt auch die Auswahl-Kopfzeile
 * ohne Layoutversatz: sie ist dieselbe Ebene, nur mit anderem Inhalt.
 *
 * Der Bestand kommt seit Schritt 7 aus der lokalen Datenbank (`state/documents`
 * ueber `data/db/repository`); `sampleLibrary` ist nur noch deren
 * Erstbefuellung. Die Liste rendert virtualisiert — sie muss auch mit ein paar
 * hundert Dokumenten ruhig bleiben.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatDocumentMeta } from '../../data/format';
import type { LibraryTag, StoredDocument } from '../../data/library';
import { documentTags, useDocumentStore } from '../../state/documents';
import { useLibraryStore } from '../../state/library';
import { useSyncStore } from '../../state/sync';
import { bg, size, space } from '../../theme';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { DocCard } from '../../ui/DocCard';
import { DocRow } from '../../ui/DocRow';
import { Fab } from '../../ui/Fab';
import {
  Check,
  FileHtml,
  FolderOpen,
  Star,
  Tag as TagIcon,
  Trash,
  WarningCircle,
  type Icon,
} from '../../ui/icons';
import { SearchField } from '../../ui/SearchField';
import { SectionHeader } from '../../ui/SectionHeader';
import { Toast } from '../../ui/Toast';
import { MoveSheet } from '../folders/MoveSheet';
import { TagSheet } from '../viewer/TagSheet';
import { ImportSheet } from './ImportSheet';
import { LibraryHeader } from './LibraryHeader';
import { CHIPS_SPACER, COLLAPSE_DISTANCE, CONTENT_TOP } from './metrics';
import { NewSection } from './NewSection';
import { SelectionHeader } from './SelectionHeader';
import { SortSheet } from './SortSheet';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Was zuletzt geschah — der Toast bietet dafuer 5 Sekunden "Rueckgaengig".
 *
 * Ohne `undo` traegt er nur die Meldung: ein gescheiterter Import (Blatt `3g`)
 * hat nichts, was sich zuruecknehmen liesse, und eine Schaltflaeche ohne
 * Wirkung waere schlimmer als keine.
 */
interface Undoable {
  message: string;
  icon?: Icon;
  undo?: () => void;
}

type OpenSheet = null | 'sort' | 'import' | 'move' | 'tag';

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const viewMode = useLibraryStore((state) => state.viewMode);
  const sort = useLibraryStore((state) => state.sort);
  const activeFilter = useLibraryStore((state) => state.activeFilter);
  const selectionMode = useLibraryStore((state) => state.selectionMode);
  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const request = useLibraryStore((state) => state.request);
  const toggleViewMode = useLibraryStore((state) => state.toggleViewMode);
  const setSort = useLibraryStore((state) => state.setSort);
  const setFilter = useLibraryStore((state) => state.setFilter);
  const startSelection = useLibraryStore((state) => state.startSelection);
  const startSelectionWith = useLibraryStore((state) => state.startSelectionWith);
  const toggleSelected = useLibraryStore((state) => state.toggleSelected);
  const endSelection = useLibraryStore((state) => state.endSelection);
  const setRequest = useLibraryStore((state) => state.setRequest);

  /**
   * Der ganze Bestand aus der Datenbank. Titel, Tags, Ordner und Favorit sind
   * Spalten dieser Zeilen — was im Info-Sheet, im Tag-Sheet oder beim
   * Verschieben geaendert wird, steht damit sofort auch hier.
   */
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

  const syncStatus = useSyncStore((state) => state.status);

  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [menuFor, setMenuFor] = useState<StoredDocument | null>(null);
  const [tagQuery, setTagQuery] = useState('');
  const [undoable, setUndoable] = useState<Undoable | null>(null);
  /**
   * Kommt aus dem Scrolloffset und lebt nur, solange der Screen sichtbar ist.
   * Er schaltet die Chips zwischen 40 und 36 um — dazwischen gibt es nichts,
   * also faellt die Entscheidung bei halbem Weg.
   */
  const [collapsed, setCollapsed] = useState(false);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  useAnimatedReaction(
    () => scrollY.value > COLLAPSE_DISTANCE / 2,
    (next, previous) => {
      if (next !== previous) runOnJS(setCollapsed)(next);
    }
  );

  const isGrid = viewMode === 'grid';

  /**
   * "Neu" heisst: seit dem letzten Tag importiert und noch keinem Ordner
   * zugeordnet. Die Zuordnung kommt seit Schritt 6 aus dem Dokument-Zustand,
   * damit die Sektion sich beim Einsortieren wirklich leert.
   */
  const newDocuments = useMemo(() => {
    const now = Date.now();
    return allDocuments.filter(
      (document) =>
        document.trashedAt === null &&
        document.folderName === null &&
        now - document.importedAt < DAY
    );
  }, [allDocuments]);

  const newIds = useMemo(() => new Set(newDocuments.map((entry) => entry.id)), [newDocuments]);

  const documents = useMemo(() => {
    const filtered = allDocuments.filter((document) => {
      if (document.trashedAt !== null) return false;
      // Was in "Neu" steht, steht nicht ein zweites Mal darunter (Blatt `1c`).
      // In der Kachelansicht gibt es die Sektion nicht, dort fehlt nichts.
      if (!isGrid && newIds.has(document.id)) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'favorites') return document.favorite;
      return document.tagIds.includes(activeFilter);
    });

    const sorted = [...filtered];
    if (sort === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
    } else if (sort === 'size') {
      sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [activeFilter, allDocuments, isGrid, newIds, sort]);

  /**
   * Die Zeile skaliert beim Druck (steckt in `PressableScale`), dann schiebt
   * der Viewer von rechts ein — den Uebergang liefert der Stack. Im
   * Auswahlmodus waehlt derselbe Tipp aus, statt zu oeffnen.
   */
  const openDocument = useCallback(
    (document: StoredDocument) => {
      if (selectionMode) {
        toggleSelected(document.id);
        return;
      }
      router.push(`/dokument/${document.id}`);
    },
    [router, selectionMode, toggleSelected]
  );

  const openSearch = useCallback(() => router.push('/suche'), [router]);

  /** Tags, die ALLE gewaehlten Dokumente tragen — nur die zeigt das Sheet gesetzt. */
  const commonTagIds = useMemo(() => {
    if (selectedIds.length === 0) return [];
    const selected = allDocuments.filter((document) => selectedIds.includes(document.id));
    if (selected.length === 0) return [];
    return selected[0].tagIds.filter((id) =>
      selected.every((document) => document.tagIds.includes(id))
    );
  }, [allDocuments, selectedIds]);

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

  /**
   * Die Auswahl-Aktionsleiste sitzt im Tab-Rahmen und legt ihren Wunsch im
   * Zustand ab; hier wird er ausgefuehrt und wieder weggeraeumt.
   */
  useEffect(() => {
    if (request === null) return;

    if (request === 'move') setSheet('move');
    if (request === 'tag') setSheet('tag');

    if (request === 'favorite') {
      // Setzen, nicht umschalten: bei gemischter Auswahl waere ein Umschalten
      // nicht vorhersagbar. Sind schon alle Favorit, nimmt der Griff sie weg.
      const allFavorite = selectedIds.every(
        (id) => allDocuments.find((document) => document.id === id)?.favorite === true
      );
      setFavorite(selectedIds, !allFavorite);
      setUndoable({
        message: allFavorite ? 'Aus Favoriten entfernt' : 'Zu Favoriten hinzugefügt',
        icon: Star,
        undo: () => setFavorite(selectedIds, allFavorite),
      });
    }

    if (request === 'trash') trashSelection(selectedIds);

    setRequest(null);
  }, [request, selectedIds, allDocuments, setFavorite, setRequest, trashSelection]);

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

  const header = (
    <View>
      <View style={styles.searchBlock}>
        <SearchField interactive={false} onPress={openSearch} />
      </View>

      {/* Platzhalter unter der schwebenden Filterleiste. */}
      <View style={styles.chipsSpacer} />

      {isGrid ? null : (
        <>
          {newDocuments.length > 0 ? (
            <View style={styles.newSection}>
              <NewSection
                documents={newDocuments}
                onOpen={openDocument}
                // "Einsortieren" waehlt alle neuen Dokumente aus und oeffnet
                // das Verschieben-Sheet: einsortieren heisst hier, sie in
                // einen Ordner zu legen, und das betrifft in aller Regel
                // mehrere auf einmal.
                onSortIn={() => {
                  startSelectionWith(newDocuments.map((entry) => entry.id));
                  setSheet('move');
                }}
              />
            </View>
          ) : null}
          <SectionHeader
            title="Alle Dokumente"
            count={documents.length}
            style={styles.sectionHeader}
          />
        </>
      )}
    </View>
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<StoredDocument>) => {
      const selected = selectedIds.includes(item.id);

      if (isGrid) {
        return (
          <DocCard
            id={item.id}
            title={item.title}
            type={item.docType}
            folderName={item.folderName}
            favorite={item.favorite}
            unavailable={!item.cached}
            state={item.cached ? 'default' : 'unavailable'}
            onPress={() => openDocument(item)}
            onToggleFavorite={() => toggleFavorite(item.id)}
            style={styles.gridCard}
          />
        );
      }

      return (
        <View style={styles.rowWrap}>
          <DocRow
            id={item.id}
            title={item.title}
            type={item.docType}
            meta={formatDocumentMeta(item.updatedAt, item.sizeBytes)}
            tagColors={documentTags(tags, item.tagIds).map((tag) => tag.color)}
            favorite={item.favorite}
            unavailable={!item.cached}
            selectionMode={selectionMode}
            selected={selected}
            last={index === documents.length - 1}
            onPress={() => openDocument(item)}
            onLongPress={selectionMode ? undefined : () => setMenuFor(item)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        </View>
      );
    },
    [documents.length, isGrid, openDocument, selectedIds, selectionMode, tags, toggleFavorite]
  );

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

  return (
    <View style={styles.screen}>
      <Animated.FlatList
        // numColumns laesst sich nicht im laufenden Betrieb aendern; der
        // Schluessel baut die Liste beim Ansichtswechsel neu auf.
        key={viewMode}
        data={documents}
        renderItem={renderItem}
        keyExtractor={(item: StoredDocument) => item.id}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        ListHeaderComponent={header}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          {
            paddingTop: insets.top + CONTENT_TOP,
            // FAB und Tab-Bar duerfen keine Zeile verdecken.
            paddingBottom: size.listBottomPadding + insets.bottom,
          },
          isGrid ? styles.gridContent : null,
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
      />

      {selectionMode ? null : (
        <LibraryHeader
          scrollY={scrollY}
          collapsed={collapsed}
          viewMode={viewMode}
          onToggleViewMode={toggleViewMode}
          onOpenSort={() => setSheet('sort')}
          syncStatus={syncStatus}
          activeFilter={activeFilter}
          onSelectFilter={setFilter}
          top={insets.top}
        />
      )}

      <SelectionHeader
        visible={selectionMode}
        count={selectedIds.length}
        top={insets.top}
        onCancel={endSelection}
      />

      {/* Kein FAB im Auswahlmodus: Importieren ist dort keine sinnvolle Aktion. */}
      {selectionMode ? null : (
        <Fab
          withTabBar
          onPress={() => setSheet('import')}
          accessibilityLabel="Dokument importieren"
        />
      )}

      <SortSheet
        visible={sheet === 'sort'}
        value={sort}
        onSelect={setSort}
        onClose={() => setSheet(null)}
      />

      <ImportSheet
        visible={sheet === 'import'}
        onClose={() => setSheet(null)}
        onImported={(document) =>
          setUndoable({
            message: `„${document.title}“ importiert`,
            icon: FileHtml,
            undo: () => trash([document.id]),
          })
        }
        onFailed={(reason) => setUndoable({ message: reason, icon: WarningCircle })}
      />

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
              folderName === null
                ? 'Aus dem Ordner genommen'
                : `Nach „${folderName}“ verschoben`,
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  searchBlock: {
    paddingTop: size.screenPadding,
    paddingHorizontal: size.screenPadding,
  },
  chipsSpacer: {
    height: CHIPS_SPACER,
  },
  newSection: {
    marginTop: size.screenPadding,
  },
  sectionHeader: {
    marginTop: space['24'],
    marginBottom: space['8'],
    paddingHorizontal: size.screenPadding,
  },
  rowWrap: {
    paddingHorizontal: size.screenPadding,
  },
  gridContent: {
    gap: space['16'],
  },
  gridRow: {
    gap: space['12'],
    paddingHorizontal: size.screenPadding,
  },
  gridCard: {
    flex: 1,
  },
});
