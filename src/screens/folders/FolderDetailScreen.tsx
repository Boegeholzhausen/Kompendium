/**
 * Screen 4 — Ordner-Detail (Blatt `3b`).
 *
 * Aufbau: 56er Kopfzeile **ohne Titel** (Zurueck-Pfeil und Ueberlaufmenue),
 * darunter Ordner-Icon 32 und Name als `display` in EINER Zeile, "38
 * Dokumente · 12 MB" als `caption`, Suchfeld, Filterleiste und dann
 * Sektionskopf mit Ansichtsumschalter, Sortier-Schaltflaeche und derselben
 * Liste wie in der Bibliothek.
 *
 * **Abweichung von Blatt `3b`:** dort stehen unter dem Namen zwei sekundaere
 * Aktionen ("Fuer offline laden" und "Bearbeiten"), und es gibt weder
 * Auswahlmodus noch FAB noch Suchfeld; die Sektionsueberschrift steht fest
 * auf "Zuletzt geaendert". Die beiden Aktionen sind ersatzlos entfallen —
 * sie stehen bereits im Ueberlaufmenue, und zwei Wege zur selben Sache
 * kosteten oben nur Hoehe. An ihrer Stelle steht dieselbe Filterleiste wie in
 * der Bibliothek (`Alle · Ungelesen · Favoriten · Archiv`), damit der
 * Ordner dieselben Fragen beantworten kann wie sie.
 *
 * Aufgeraeumt wird ebenfalls genau hier — ohne Auswahlmodus, FAB und
 * Suchfeld waere der Ordner der einzige Listen-Screen, in dem man nichts tun
 * kann. Kontextmenue, Sheets und Toast kommen deshalb aus demselben Modul wie
 * in der Bibliothek (`screens/library/documentActions`), die Reihenfolge aus
 * `useLibraryStore`. Das Suchfeld ueber der Filterleiste fuehrt in die Suche
 * und setzt dabei den Ordnerfilter vorab; die Abstaende von Blatt `3b`
 * darunter bleiben unveraendert.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { formatBytes, formatDocumentMeta } from '../../data/format';
import type { StoredDocument } from '../../data/library';
import { useGuardedPush } from '../../navigation/useGuardedPush';
import { isArchived, isUnread, useDocumentStore } from '../../state/documents';
import { colorOf, useFolderStore } from '../../state/folders';
import {
  isAllSelected,
  sortDocuments,
  sortLabels,
  useLibraryStore,
  type LibraryFilter,
} from '../../state/library';
import { useUnavailable } from '../../state/network';
import { useSearchStore } from '../../state/search';
import { accent, bg, size, space, text as textColor } from '../../theme';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { DocCard } from '../../ui/DocCard';
import { DocRow } from '../../ui/DocRow';
import { Fab } from '../../ui/Fab';
import { FilterChip } from '../../ui/FilterChip';
import {
  ArrowsDownUp,
  CloudCheck,
  CloudSlash,
  Archive,
  CheckCircle,
  Circle,
  DotsThreeVertical,
  FileHtml,
  Folder,
  FolderOpen,
  PencilSimple,
  Rows,
  SquaresFour,
  Star,
  Trash,
  WarningCircle,
} from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { RenameSheet } from '../../ui/RenameSheet';
import { CompactHeader } from '../../ui/ScreenHeader';
import { SearchField } from '../../ui/SearchField';
import { SwipeActions } from '../../ui/SwipeActions';
import { SectionHeader } from '../../ui/SectionHeader';
import { SelectionBar } from '../../ui/TabBar';
import { Text } from '../../ui/Text';
import { useDocumentActions } from '../library/documentActions';
import { ImportSheet } from '../library/ImportSheet';
import { SelectionHeader } from '../library/SelectionHeader';
import { SortSheet } from '../library/SortSheet';

export interface FolderDetailScreenProps {
  folderName: string;
  onBack: () => void;
}

export function FolderDetailScreen({ folderName, onBack }: FolderDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const push = useGuardedPush();

  const folders = useFolderStore((state) => state.folders);
  const renameFolder = useFolderStore((state) => state.renameFolder);
  const removeFolder = useFolderStore((state) => state.deleteFolder);
  const createFolder = useFolderStore((state) => state.createFolder);
  const setPendingUndo = useFolderStore((state) => state.setPendingUndo);
  const setFolderOffline = useFolderStore((state) => state.setKeepOffline);

  const allDocuments = useDocumentStore((state) => state.documents);
  const renameFolderEverywhere = useDocumentStore((state) => state.renameFolderEverywhere);
  const clearFolderEverywhere = useDocumentStore((state) => state.clearFolderEverywhere);
  const setFolder = useDocumentStore((state) => state.setFolder);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const toggleRead = useDocumentStore((state) => state.toggleRead);
  const toggleArchived = useDocumentStore((state) => state.toggleArchived);
  const setRead = useDocumentStore((state) => state.setRead);
  const setArchived = useDocumentStore((state) => state.setArchived);
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
   * Kontextmenue, Verschieben, Status und der Toast — dasselbe Modul wie in
   * der Bibliothek. Hier wird aufgeraeumt, also muss es hier dieselben Griffe
   * geben.
   */
  const actions = useDocumentActions();

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  /**
   * Der Filter ist LOKAL, nicht `activeFilter` aus `useLibraryStore`:
   * `activeFilter` gehoert der Bibliothek. Wuerde der Ordner ihn mitbenutzen,
   * stuende die Bibliothek nach einem Blick ins Ordner-Archiv ebenfalls auf
   * "Archiv", ohne dass der Nutzer sie angefasst hat. Der Ordner startet
   * deshalb immer auf "Alle" — genauso, wie der Auswahlmodus beim Verlassen
   * zurueckgesetzt wird.
   */
  const [filter, setFilter] = useState<LibraryFilter>('all');

  /**
   * Die Auswahl gilt ueber Screens hinweg, dieser Screen aber nicht: wer
   * zurueckgeht, findet sonst die Bibliothek im Auswahlmodus vor, ohne je
   * dort etwas gewaehlt zu haben.
   */
  useEffect(() => endSelection, [endSelection]);

  const folder = folders.find((entry) => entry.name === folderName) ?? null;

  /**
   * "Inhalt offline behalten" gilt laut Blatt `6c` fuer alles im Ordner. Der
   * Schalter setzt deshalb beide Seiten: die Regel am Ordner (damit sie fuer
   * spaeter Hinzukommende gilt) und den Zustand an jedem Dokument darin (damit
   * der Speicherbalken in den Einstellungen die Wahrheit zeigt).
   */
  const setFolderKeepOffline = (keep: boolean) => {
    setFolderOffline(folderName, keep);
    const ids = allDocuments
      .filter((document) => document.folderName === folderName && document.trashedAt === null)
      .map((document) => document.id);
    if (ids.length > 0) setDocumentsKeepOffline(ids, keep);
  };

  const documents = useMemo(() => {
    // Dieselbe Filterregel wie in der Bibliothek, nur auf diesen Ordner
    // beschraenkt — die Chips oben beantworten hier dieselben Fragen.
    const list = allDocuments.filter((document) => {
      if (document.trashedAt !== null) return false;
      if (document.folderName !== folderName) return false;
      if (filter === 'archive') return isArchived(document);
      // Archiv ist eine zweite Achse, kein Filterwert: die anderen drei Chips
      // zeigen nie Archiviertes, sonst stuende es doppelt herum.
      if (isArchived(document)) return false;
      if (filter === 'unread') return isUnread(document);
      if (filter === 'favorites') return document.favorite;
      return true;
    });
    return sortDocuments(list, sort);
  }, [allDocuments, filter, folderName, sort]);

  /**
   * Wie viele Dokumente wirklich im Ordner liegen — unabhaengig vom Chip.
   * Das Umbenennen wirkt auf alle, nicht nur auf die gerade gezeigten; die
   * gefilterte `documents` waere dort eine Falschaussage.
   */
  const folderCount = useMemo(
    () =>
      allDocuments.filter(
        (document) => document.folderName === folderName && document.trashedAt === null
      ).length,
    [allDocuments, folderName]
  );

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
   * mehr zu ermitteln. Der Toast
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
      {/*
        Icon und Name nebeneinander statt untereinander: der Kopf wird dadurch
        eine Zeile flacher. Bei zweizeiligen Namen bleibt das Icon bewusst
        mittig (`center`) — `flex-start` wirkt neben einem Umbruch unruhig.
      */}
      <View style={styles.titleRow}>
        <Folder size={32} color={colorOf(folders, folderName)} weight="fill" />
        <Text variant="display" numberOfLines={2} style={styles.name}>
          {folderName}
        </Text>
      </View>

      <Text variant="caption" tone="secondary" numeric style={styles.meta}>
        {`${documents.length === 1 ? '1 Dokument' : `${documents.length} Dokumente`} · ${formatBytes(totalBytes)}`}
      </Text>

      {/*
        Suchen aus dem Ordner heraus: das Feld ist wie in der Bibliothek nur
        eine Schaltflaeche, setzt aber vorher den Ordnerfilter. Der Chip in der
        Suche nennt den Ordnernamen und bleibt mit einem Tipp abwaehlbar — die
        Einschraenkung gehoert weiter dem Nutzer.
      */}
      <View style={styles.searchBlock}>
        <SearchField
          interactive={false}
          onPress={() => {
            setFolderFilter(folderName);
            push('/suche');
          }}
        />
      </View>

      {/*
        Dieselbe Filterleiste wie in der Bibliothek, wort- und icon-gleich.
        Ohne `compact`: hier kollabiert kein Kopf, die Chips sind immer 40 hoch.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.chips}
        contentContainerStyle={styles.chipRow}
      >
        <FilterChip label="Alle" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterChip
          label="Ungelesen"
          icon={Circle}
          active={filter === 'unread'}
          onPress={() => setFilter('unread')}
        />
        <FilterChip
          label="Favoriten"
          icon={Star}
          active={filter === 'favorites'}
          onPress={() => setFilter('favorites')}
        />
        <FilterChip
          label="Archiv"
          icon={Archive}
          active={filter === 'archive'}
          onPress={() => setFilter('archive')}
        />
      </ScrollView>

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

  /**
   * Was die beiden Wischrichtungen tun — wortgleich zur Bibliothek. Beide mit
   * Toast und "Rueckgaengig": eine Geste loest sich leichter versehentlich aus
   * als ein Menueeintrag.
   */
  const swipeArchive = (document: StoredDocument) => {
    // Unter dem Chip "Archiv" stehen archivierte Dokumente in dieser Liste —
    // die Geste muss deshalb beide Richtungen koennen und richtig melden.
    const wasArchived = isArchived(document);
    toggleArchived(document.id);
    actions.notify({
      message: wasArchived ? 'Aus dem Archiv geholt' : 'Archiviert',
      icon: Archive,
      undo: () => setArchived([document.id], wasArchived),
    });
  };

  const swipeRead = (document: StoredDocument) => {
    const wasUnread = isUnread(document);
    toggleRead(document.id);
    actions.notify({
      message: wasUnread ? 'Als gelesen markiert' : 'Als ungelesen markiert',
      icon: CheckCircle,
      undo: () => setRead([document.id], !wasUnread),
    });
  };

  const renderItem = ({ item, index }: ListRenderItemInfo<StoredDocument>) => {
    // Im Auswahlmodus waehlt derselbe Tipp aus, statt zu oeffnen — wie in der
    // Bibliothek.
    const open = () => {
      if (selectionMode) {
        toggleSelected(item.id);
        return;
      }
      push(`/dokument/${item.id}`);
    };

    if (isGrid) {
      return (
        <DocCard
          id={item.id}
          title={item.title}
          type={item.docType}
          folderName={item.folderName}
          favorite={item.favorite}
          unread={isUnread(item)}
          unavailable={unavailable(item)}
          state={unavailable(item) ? 'unavailable' : 'default'}
          onPress={open}
          onToggleFavorite={() => toggleFavorite(item.id)}
          style={styles.gridCard}
        />
      );
    }

    return (
      // Dieselbe Abkuerzung wie in der Bibliothek — und dieselben Aktionen
      // ohne Geste im Kontextmenue und in der Auswahl-Aktionsleiste.
      <SwipeActions
        style={styles.rowWrap}
        right={{
          icon: Archive,
          label: isArchived(item) ? 'Zurück' : 'Archiv',
          surface: bg.raised,
          tint: textColor.primary,
          onTrigger: () => swipeArchive(item),
        }}
        left={{
          icon: isUnread(item) ? CheckCircle : Circle,
          label: isUnread(item) ? 'Gelesen' : 'Ungelesen',
          surface: accent.surface,
          tint: accent.base,
          onTrigger: () => swipeRead(item),
        }}
      >
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
          unread={isUnread(item)}
          favorite={item.favorite}
          unavailable={unavailable(item)}
          selectionMode={selectionMode}
          selected={selectedIds.includes(item.id)}
          last={index === documents.length - 1}
          onPress={open}
          onLongPress={selectionMode ? undefined : () => actions.openMenu(item)}
          onToggleFavorite={() => toggleFavorite(item.id)}
        />
      </SwipeActions>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <CompactHeader
          onBack={onBack}
          right={
            <IconButton
              icon={DotsThreeVertical}
              onPress={() => setMenuOpen(true)}
              accessibilityLabel="Weitere Aktionen"
            />
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
            // Wie in der Bibliothek: statt "Taggen" der Workflow-Status, und der
            // Favorit weicht in das Kontextmenue aus (Abweichung von Blatt `3h`).
            { key: 'read', label: 'Gelesen', icon: CheckCircle, onPress: actions.readSelection },
            {
              key: 'archive',
              label: 'Archiv',
              icon: Archive,
              onPress: actions.archiveSelection,
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
          importiert, hat die Einsortierung schon getroffen.
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
          setFolder([document.id], folderName);
          actions.notify({
            message: `„${document.title}“ nach „${folderName}“ importiert`,
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
          count={folderCount}
          hint={`Wirkt auf alle ${folderCount} Dokumente in diesem Ordner`}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    marginTop: space['8'],
  },
  name: {
    flex: 1,
  },
  meta: {
    marginTop: space['4'],
  },
  searchBlock: {
    marginTop: size.screenPadding,
  },
  chips: {
    // Derselbe Abstand wie `CHIPS_GAP` der Bibliothek. Eine waagerechte
    // ScrollView braucht `flexGrow: 0`, sonst beansprucht sie die volle Hoehe.
    flexGrow: 0,
    marginTop: space['12'],
    // Der Kopfblock hat seitlichen Innenabstand; die Chips sollen beim
    // Scrollen trotzdem bis an den Bildrand laufen.
    marginHorizontal: -size.screenPadding,
  },
  chipRow: {
    flexDirection: 'row',
    gap: space['8'],
    paddingHorizontal: size.screenPadding,
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
