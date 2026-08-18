/**
 * Screen 4 — Ordner-Detail (Blatt `3b`) und zugleich "Alle Dokumente".
 *
 * Aufbau: 56er Kopfzeile **ohne Titel** (Zurueck-Pfeil und Ueberlaufmenue),
 * darunter Ordner-Icon 32, Name als `display`, "38 Dokumente · 12 MB" als
 * `caption`, zwei kompakte Aktionen und dann Sektionskopf mit
 * Ansichtsumschalter, Sortier-Schaltflaeche und derselben Liste wie in der
 * Bibliothek.
 *
 * Beide Aktionen sind **sekundaer**: der Ordner hat keine primaere Aktion, ein
 * Mint-Button fuer "Offline laden" haette mehr Gewicht als die Sache verdient.
 *
 * **Abweichung von Blatt `3b`:** dort gibt es weder Auswahlmodus noch FAB noch
 * Suchfeld, und die Sektionsueberschrift steht fest auf "Zuletzt geaendert".
 * Aufgeraeumt wird aber genau hier — ohne diese Stuecke waere der Ordner der
 * einzige Listen-Screen, in dem man nichts tun kann. Kontextmenue, Sheets und
 * Toast kommen deshalb aus demselben Modul wie in der Bibliothek
 * (`screens/library/documentActions`), die Reihenfolge aus `useLibraryStore`.
 * Das Suchfeld ueber der Sektionsueberschrift fuehrt in die Suche und setzt
 * dabei den Ordnerfilter vorab; die Abstaende von Blatt `3b` darunter bleiben
 * unveraendert.
 *
 * "Alle Dokumente" (`folderName === null`) benutzt denselben Screen: es ist
 * dieselbe Liste mit demselben Kopf, nur ohne Ordnerfarbe und ohne Aktionen —
 * ein zweiter Screen dafuer waere dieselbe Datei mit weniger darin.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatBytes, formatDocumentMeta } from '../../data/format';
import type { StoredDocument } from '../../data/library';
import { documentTags, useDocumentStore } from '../../state/documents';
import { colorOf, useFolderStore } from '../../state/folders';
import { isAllSelected, sortDocuments, sortLabels, useLibraryStore } from '../../state/library';
import { useUnavailable } from '../../state/network';
import { useSearchStore } from '../../state/search';
import { bg, size, space } from '../../theme';
import { SecondaryButton } from '../../ui/Button';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { DocCard } from '../../ui/DocCard';
import { DocRow } from '../../ui/DocRow';
import { Fab } from '../../ui/Fab';
import {
  ArrowsDownUp,
  Books,
  CloudCheck,
  CloudSlash,
  DotsThreeVertical,
  DownloadSimple,
  FileHtml,
  Folder,
  FolderOpen,
  PencilSimple,
  Rows,
  SquaresFour,
  Star,
  Tag as TagIcon,
  Trash,
  WarningCircle,
} from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { RenameSheet } from '../../ui/RenameSheet';
import { CompactHeader } from '../../ui/ScreenHeader';
import { SearchField } from '../../ui/SearchField';
import { SectionHeader } from '../../ui/SectionHeader';
import { SelectionBar } from '../../ui/TabBar';
import { Text } from '../../ui/Text';
import { useDocumentActions } from '../library/documentActions';
import { ImportSheet } from '../library/ImportSheet';
import { SelectionHeader } from '../library/SelectionHeader';
import { SortSheet } from '../library/SortSheet';

export interface FolderDetailScreenProps {
  /** `null` zeigt "Alle Dokumente". */
  folderName: string | null;
  onBack: () => void;
}

export function FolderDetailScreen({ folderName, onBack }: FolderDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const folders = useFolderStore((state) => state.folders);
  const renameFolder = useFolderStore((state) => state.renameFolder);
  const removeFolder = useFolderStore((state) => state.deleteFolder);
  const createFolder = useFolderStore((state) => state.createFolder);
  const setPendingUndo = useFolderStore((state) => state.setPendingUndo);
  const setFolderOffline = useFolderStore((state) => state.setKeepOffline);

  const allDocuments = useDocumentStore((state) => state.documents);
  const tags = useDocumentStore((state) => state.tags);
  const renameFolderEverywhere = useDocumentStore((state) => state.renameFolderEverywhere);
  const clearFolderEverywhere = useDocumentStore((state) => state.clearFolderEverywhere);
  const setFolder = useDocumentStore((state) => state.setFolder);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const trashDocuments = useDocumentStore((state) => state.trash);
  const setDocumentsKeepOffline = useDocumentStore((state) => state.setDocumentsKeepOffline);

  const viewMode = useLibraryStore((state) => state.viewMode);
  const toggleViewMode = useLibraryStore((state) => state.toggleViewMode);
  const sort = useLibraryStore((state) => state.sort);
  const setSort = useLibraryStore((state) => state.setSort);
  const selectionMode = useLibraryStore((state) => state.selectionMode);
  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const toggleSelected = useLibraryStore((state) => state.toggleSelected);
  const endSelection = useLibraryStore((state) => state.endSelection);
  const selectAll = useLibraryStore((state) => state.selectAll);

  const setFolderFilter = useSearchStore((state) => state.setFolderFilter);

  /**
   * Kontextmenue, Verschieben, Taggen und der Toast — dasselbe Modul wie in
   * der Bibliothek. Hier wird aufgeraeumt, also muss es hier dieselben Griffe
   * geben.
   */
  const actions = useDocumentActions();

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  /**
   * Die Auswahl gilt ueber Screens hinweg, dieser Screen aber nicht: wer
   * zurueckgeht, findet sonst die Bibliothek im Auswahlmodus vor, ohne je
   * dort etwas gewaehlt zu haben.
   */
  useEffect(() => endSelection, [endSelection]);

  const folder = folders.find((entry) => entry.name === folderName) ?? null;
  const isAll = folderName === null;

  /**
   * "Inhalt offline behalten" gilt laut Blatt `6c` fuer alles im Ordner. Der
   * Schalter setzt deshalb beide Seiten: die Regel am Ordner (damit sie fuer
   * spaeter Hinzukommende gilt) und den Zustand an jedem Dokument darin (damit
   * der Speicherbalken in den Einstellungen die Wahrheit zeigt).
   */
  const setFolderKeepOffline = (keep: boolean) => {
    if (folderName === null) return;
    setFolderOffline(folderName, keep);
    const ids = allDocuments
      .filter((document) => document.folderName === folderName && document.trashedAt === null)
      .map((document) => document.id);
    if (ids.length > 0) setDocumentsKeepOffline(ids, keep);
  };

  const documents = useMemo(() => {
    const list = allDocuments.filter((document) => {
      if (document.trashedAt !== null) return false;
      if (isAll) return true;
      return document.folderName === folderName;
    });
    return sortDocuments(list, sort);
  }, [allDocuments, folderName, isAll, sort]);

  /** Was gerade auf dem Schirm steht — Grundlage fuer "Alle auswaehlen". */
  const visibleIds = useMemo(() => documents.map((document) => document.id), [documents]);

  const totalBytes = useMemo(
    () => documents.reduce((sum, document) => sum + document.sizeBytes, 0),
    [documents]
  );

  const isGrid = viewMode === 'grid';
  const keepOffline = folder?.keepOffline ?? false;

  /**
   * Ordner loeschen. Die Dokumente bleiben und landen in "Nicht einsortiert" —
   * die Datenbank erledigt beides in einer Transaktion
   * (`repository.deleteFolder`).
   *
   * Wer den Ordner zurueckholt, will ihn samt Inhalt zurueck. Welche Dokumente
   * darin lagen, muss deshalb VOR dem Loeschen feststehen — danach ist es nicht
   * mehr zu ermitteln (dasselbe Muster wie `TagsScreen.remove`). Der Toast
   * dazu steht in der Ordner-Uebersicht, weil dieser Screen im selben Moment
   * schliesst (siehe `PendingUndo` in `state/folders.ts`).
   */
  const removeThisFolder = () => {
    if (folder === null) return;

    const affected = allDocuments
      .filter((document) => document.folderName === folder.name)
      .map((document) => document.id);
    const { name, color, keepOffline: kept } = folder;

    removeFolder(name);
    clearFolderEverywhere(name);
    setPendingUndo({
      message: `Ordner „${name}“ gelöscht`,
      undo: () => {
        createFolder(name, color, kept);
        if (affected.length > 0) setFolder(affected, name);
      },
    });
    onBack();
  };

  const menuItems: ContextMenuItem[] = [
    {
      key: 'rename',
      label: 'Ordner umbenennen',
      icon: PencilSimple,
      onPress: () => {
        setMenuOpen(false);
        setRenameOpen(true);
      },
    },
    {
      key: 'offline',
      label: keepOffline ? 'Nicht mehr offline behalten' : 'Inhalt offline behalten',
      icon: keepOffline ? CloudSlash : CloudCheck,
      onPress: () => {
        setFolderKeepOffline(!keepOffline);
        setMenuOpen(false);
      },
    },
    {
      key: 'delete',
      label: 'Ordner löschen',
      icon: Trash,
      destructive: true,
      onPress: () => {
        setMenuOpen(false);
        removeThisFolder();
      },
    },
  ];

  const header = (
    <View style={styles.head}>
      {isAll ? (
        <Books size={32} color={colorOf(folders, null)} weight="fill" />
      ) : (
        <Folder size={32} color={colorOf(folders, folderName)} weight="fill" />
      )}

      <Text variant="display" numberOfLines={2} style={styles.name}>
        {isAll ? 'Alle Dokumente' : folderName}
      </Text>

      <Text variant="caption" tone="secondary" numeric style={styles.meta}>
        {`${documents.length === 1 ? '1 Dokument' : `${documents.length} Dokumente`} · ${formatBytes(totalBytes)}`}
      </Text>

      {isAll ? null : (
        <View style={styles.actions}>
          <SecondaryButton
            compact
            icon={DownloadSimple}
            label={keepOffline ? 'Offline geladen' : 'Für offline laden'}
            onPress={() => setFolderKeepOffline(!keepOffline)}
            style={styles.actionWide}
          />
          <SecondaryButton
            compact
            icon={PencilSimple}
            label="Bearbeiten"
            onPress={() => setRenameOpen(true)}
            style={styles.actionFixed}
          />
        </View>
      )}

      {/*
        Suchen aus dem Ordner heraus: das Feld ist wie in der Bibliothek nur
        eine Schaltflaeche, setzt aber vorher den Ordnerfilter. Der Chip in der
        Suche nennt den Ordnernamen und bleibt mit einem Tipp abwaehlbar — die
        Einschraenkung gehoert weiter dem Nutzer. "Alle Dokumente" schraenkt
        nichts ein, dort waere ein Filter eine Behauptung.
      */}
      <View style={styles.searchBlock}>
        <SearchField
          interactive={false}
          onPress={() => {
            setFolderFilter(folderName);
            router.push('/suche');
          }}
        />
      </View>

      {/*
        Die Ueberschrift benennt die geltende Reihenfolge, statt "Zuletzt
        geaendert" zu behaupten: seit der Screen aus `useLibraryStore`
        sortiert, kann sie jede der vier sein.
      */}
      <SectionHeader
        title={sortLabels[sort]}
        style={styles.section}
        right={
          <View style={styles.sectionActions}>
            <IconButton
              icon={isGrid ? SquaresFour : Rows}
              active
              onPress={toggleViewMode}
              accessibilityLabel={
                isGrid ? 'Kachelansicht, zu Liste wechseln' : 'Listenansicht, zu Kacheln wechseln'
              }
            />
            <IconButton
              icon={ArrowsDownUp}
              onPress={() => setSortOpen(true)}
              accessibilityLabel="Sortieren"
            />
          </View>
        }
      />
    </View>
  );

  /** Nicht geladen UND kein Netz (Blatt `4c`) — siehe `data/library`. */
  const unavailable = useUnavailable();

  const renderItem = ({ item, index }: ListRenderItemInfo<StoredDocument>) => {
    // Im Auswahlmodus waehlt derselbe Tipp aus, statt zu oeffnen — wie in der
    // Bibliothek.
    const open = () => {
      if (selectionMode) {
        toggleSelected(item.id);
        return;
      }
      router.push(`/dokument/${item.id}`);
    };

    if (isGrid) {
      return (
        <DocCard
          id={item.id}
          title={item.title}
          type={item.docType}
          folderName={item.folderName}
          favorite={item.favorite}
          unavailable={unavailable(item)}
          state={unavailable(item) ? 'unavailable' : 'default'}
          onPress={open}
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
          meta={
            item.keepOffline && item.cached
              ? `offline · ${formatBytes(item.sizeBytes)}`
              : formatDocumentMeta(item.updatedAt, item.sizeBytes)
          }
          // Offline gehaltene Dokumente zeigen es mit Wolkensymbol UND Wort,
          // nie durch Farbe allein.
          metaIcon={item.keepOffline && item.cached ? CloudCheck : undefined}
          tagColors={documentTags(tags, item.tagIds).map((tag) => tag.color)}
          favorite={item.favorite}
          unavailable={unavailable(item)}
          selectionMode={selectionMode}
          selected={selectedIds.includes(item.id)}
          last={index === documents.length - 1}
          onPress={open}
          onLongPress={selectionMode ? undefined : () => actions.openMenu(item)}
          onToggleFavorite={() => toggleFavorite(item.id)}
        />
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <CompactHeader
          onBack={onBack}
          right={
            isAll ? undefined : (
              <IconButton
                icon={DotsThreeVertical}
                onPress={() => setMenuOpen(true)}
                accessibilityLabel="Weitere Aktionen"
              />
            )
          }
        />
      </View>

      <FlatList
        key={viewMode}
        data={documents}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? styles.gridRow : undefined}
        ListHeaderComponent={header}
        contentContainerStyle={[
          { paddingBottom: size.listBottomPadding + insets.bottom },
          isGrid ? styles.gridContent : null,
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
      />

      {/*
        Im Auswahlmodus liegt die Auswahl-Kopfzeile ueber der 56er Kopfzeile —
        dieselbe Ebene wie in der Bibliothek, deshalb springt nichts. "Alle
        auswaehlen" wirkt auf die sichtbare Liste dieses Ordners.
      */}
      <SelectionHeader
        visible={selectionMode}
        count={selectedIds.length}
        top={insets.top}
        allSelected={isAllSelected(visibleIds, selectedIds)}
        onToggleAll={() => selectAll(isAllSelected(visibleIds, selectedIds) ? [] : visibleIds)}
        onCancel={endSelection}
      />

      {/*
        Die Auswahl-Aktionsleiste (Komponente 17) ersetzt in der Bibliothek die
        Tab-Bar. Hier gibt es keine — der Screen liegt darueber —, also schwebt
        sie ueber dem unteren Rand. Ihre Wuensche fuehrt der Screen selbst aus:
        `request` im Bibliothek-Zustand gehoert der Bibliothek, und zwei
        Zuhoerer auf demselben Wunsch fuehrten ihn doppelt aus.
      */}
      {selectionMode ? (
        <SelectionBar
          style={styles.selectionBar}
          actions={[
            {
              key: 'move',
              label: 'Verschieben',
              icon: FolderOpen,
              onPress: actions.openMove,
            },
            { key: 'tag', label: 'Taggen', icon: TagIcon, onPress: actions.openTag },
            {
              key: 'favorite',
              label: 'Favorit',
              icon: Star,
              onPress: actions.toggleFavoriteSelection,
            },
            {
              key: 'trash',
              label: 'Löschen',
              icon: Trash,
              destructive: true,
              onPress: () => actions.trashSelection(selectedIds),
            },
          ]}
        />
      ) : (
        /*
          Ein Import aus dem Ordner heraus landet in DIESEM Ordner — wer hier
          importiert, hat die Einsortierung schon getroffen. Nur "Alle
          Dokumente" hat keinen Ordner, dort gilt weiter "landet in Neu".
        */
        <Fab onPress={() => setImportOpen(true)} accessibilityLabel="Dokument importieren" />
      )}

      <SortSheet
        visible={sortOpen}
        value={sort}
        onSelect={setSort}
        onClose={() => setSortOpen(false)}
      />

      <ImportSheet
        visible={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(document) => {
          if (!isAll) setFolder([document.id], folderName);
          actions.notify({
            message: isAll
              ? `„${document.title}“ importiert`
              : `„${document.title}“ nach „${folderName}“ importiert`,
            icon: FileHtml,
            undo: () => trashDocuments([document.id]),
          });
        }}
        onFailed={(reason) => actions.notify({ message: reason, icon: WarningCircle })}
      />

      <ContextMenu visible={menuOpen} items={menuItems} onClose={() => setMenuOpen(false)} />

      {folder === null ? null : (
        <RenameSheet
          visible={renameOpen}
          title="Ordner umbenennen"
          currentName={folder.name}
          color={folder.color}
          count={documents.length}
          hint={`Wirkt auf alle ${documents.length} Dokumente in diesem Ordner`}
          onSubmit={(next) => {
            renameFolder(folder.name, next);
            renameFolderEverywhere(folder.name, next);
            // Der Pfad traegt den alten Namen; nach dem Umbenennen zeigt er
            // ins Leere, also zurueck in die Uebersicht.
            router.replace(`/ordner/${encodeURIComponent(next)}`);
          }}
          onClose={() => setRenameOpen(false)}
        />
      )}

      {actions.overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  head: {
    paddingHorizontal: size.screenPadding,
  },
  name: {
    marginTop: space['8'] + space['2'],
  },
  meta: {
    marginTop: space['4'],
  },
  actions: {
    flexDirection: 'row',
    gap: space['8'],
    marginTop: size.screenPadding,
  },
  actionWide: {
    flex: 1,
  },
  actionFixed: {
    // 100 fest aus Blatt `3b` — "Bearbeiten" soll nicht so breit wirken wie
    // die teurere Entscheidung daneben. Ohne seitlichen Innenabstand, sonst
    // bleiben fuer Icon und Wort keine 100 mehr uebrig.
    width: 100,
    paddingHorizontal: 0,
  },
  searchBlock: {
    marginTop: size.screenPadding,
  },
  sectionActions: {
    flexDirection: 'row',
    // Mindestabstand zwischen zwei Beruehrungsflaechen (harte Regel).
    gap: size.touchGap,
  },
  selectionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  section: {
    marginTop: space['24'],
    marginBottom: space['8'],
    // Der 48er Umschalter rechts zieht die Zeile sonst auseinander.
    marginRight: -space['12'],
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
