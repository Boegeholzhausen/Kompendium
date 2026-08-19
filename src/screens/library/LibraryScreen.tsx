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
import { useGuardedPush } from '../../navigation/useGuardedPush';

import { formatDocumentMeta } from '../../data/format';
import type { StoredDocument } from '../../data/library';
import { documentTags, useDocumentStore } from '../../state/documents';
import { isAllSelected, sortDocuments, useLibraryStore } from '../../state/library';
import { useNotice } from '../../state/notice';
import { useUnavailable } from '../../state/network';
import { useSyncStore } from '../../state/sync';
import { bg, size, space } from '../../theme';
import { DocCard } from '../../ui/DocCard';
import { DocRow } from '../../ui/DocRow';
import { Fab } from '../../ui/Fab';
import { FileHtml, WarningCircle } from '../../ui/icons';
import { SearchField } from '../../ui/SearchField';
import { SectionHeader } from '../../ui/SectionHeader';
import { useDocumentActions } from './documentActions';
import { EmptyLibrary } from './EmptyLibrary';
import { ImportSheet } from './ImportSheet';
import { LibraryHeader } from './LibraryHeader';
import { LoadingLibrary } from './LoadingLibrary';
import { CHIPS_SPACER, COLLAPSE_DISTANCE, contentTop } from './metrics';
import { NewSection } from './NewSection';
import { SelectionHeader } from './SelectionHeader';
import { SortSheet } from './SortSheet';

const DAY = 24 * 60 * 60 * 1000;

type OpenSheet = null | 'sort' | 'import';

export function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const push = useGuardedPush();

  const viewMode = useLibraryStore((state) => state.viewMode);
  const sort = useLibraryStore((state) => state.sort);
  const activeFilter = useLibraryStore((state) => state.activeFilter);
  const selectionMode = useLibraryStore((state) => state.selectionMode);
  const selectedIds = useLibraryStore((state) => state.selectedIds);
  const request = useLibraryStore((state) => state.request);
  const toggleViewMode = useLibraryStore((state) => state.toggleViewMode);
  const setSort = useLibraryStore((state) => state.setSort);
  const setFilter = useLibraryStore((state) => state.setFilter);
  const startSelectionWith = useLibraryStore((state) => state.startSelectionWith);
  const toggleSelected = useLibraryStore((state) => state.toggleSelected);
  const endSelection = useLibraryStore((state) => state.endSelection);
  const selectAll = useLibraryStore((state) => state.selectAll);
  const setRequest = useLibraryStore((state) => state.setRequest);

  /**
   * Der ganze Bestand aus der Datenbank. Titel, Tags, Ordner und Favorit sind
   * Spalten dieser Zeilen — was im Info-Sheet, im Tag-Sheet oder beim
   * Verschieben geaendert wird, steht damit sofort auch hier.
   */
  const allDocuments = useDocumentStore((state) => state.documents);
  /** Vor dem ersten Lesen aus der Datenbank ist die Bibliothek nicht leer, sondern unbekannt. */
  const hydrated = useDocumentStore((state) => state.hydrated);
  const tags = useDocumentStore((state) => state.tags);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const trash = useDocumentStore((state) => state.trash);

  /**
   * Kontextmenue, Verschieben, Taggen und der Toast — dieselben Griffe, die
   * auch das Ordner-Detail benutzt (`documentActions`).
   */
  const actions = useDocumentActions();

  const syncStatus = useSyncStore((state) => state.status);
  /** Offline oder Sync-Fehler — der 36-px-Streifen statt der 2-px-Leiste (Blatt `4c`). */
  const notice = useNotice();

  const [sheet, setSheet] = useState<OpenSheet>(null);
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

    return sortDocuments(filtered, sort);
  }, [activeFilter, allDocuments, isGrid, newIds, sort]);

  /**
   * Was gerade auf dem Schirm steht: die Liste UND die Sektion "Neu" darueber.
   * "Alle auswaehlen" haelt sich daran — in der Kachelansicht gibt es die
   * Sektion nicht, dort stehen die neuen Dokumente schon in `documents`.
   */
  const visibleIds = useMemo(() => {
    const ids = new Set(newDocuments.map((entry) => entry.id));
    for (const document of documents) ids.add(document.id);
    return [...ids];
  }, [documents, newDocuments]);

  /** Nicht geladen UND kein Netz (Blatt `4c`) — siehe `data/library`. */
  const unavailable = useUnavailable();

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
      push(`/dokument/${document.id}`);
    },
    [push, selectionMode, toggleSelected]
  );

  const openSearch = useCallback(() => push('/suche'), [push]);

  /**
   * Die Auswahl-Aktionsleiste sitzt im Tab-Rahmen und legt ihren Wunsch im
   * Zustand ab; hier wird er ausgefuehrt und wieder weggeraeumt.
   */
  useEffect(() => {
    if (request === null) return;

    if (request === 'move') actions.openMove();
    if (request === 'tag') actions.openTag();
    if (request === 'favorite') actions.toggleFavoriteSelection();
    if (request === 'trash') actions.trashSelection(selectedIds);

    setRequest(null);
  }, [actions, request, selectedIds, setRequest]);

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
                  actions.openMove();
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
            unavailable={unavailable(item)}
            state={unavailable(item) ? 'unavailable' : 'default'}
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
            unavailable={unavailable(item)}
            selectionMode={selectionMode}
            selected={selected}
            last={index === documents.length - 1}
            onPress={() => openDocument(item)}
            onLongPress={selectionMode ? undefined : () => actions.openMenu(item)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        </View>
      );
    },
    [
      documents.length,
      isGrid,
      openDocument,
      selectedIds,
      selectionMode,
      tags,
      toggleFavorite,
      unavailable,
    ]
  );

  /**
   * Drei Zustaende, ein Aufbau (Schritt 8):
   *   loading  die Datenbank ist noch nicht gelesen (Blatt `4b`)
   *   empty    sie ist gelesen und leer — Erststart (Blatt `4a`)
   *   ready    die Liste
   *
   * Kopfzeile, Streifen und Tab-Bar stehen in allen dreien an derselben
   * Stelle; nur der Inhalt darunter wechselt. Genau deshalb springt beim
   * Eintreffen der Daten nichts.
   */
  const mode = !hydrated
    ? 'loading'
    : allDocuments.every((document) => document.trashedAt !== null)
      ? 'empty'
      : 'ready';

  const listTop = insets.top + contentTop(notice !== null);

  const body =
    mode === 'loading' ? (
      <LoadingLibrary top={listTop} />
    ) : mode === 'empty' ? (
      <View style={[styles.emptyBody, { paddingTop: listTop }]}>
        <EmptyLibrary onImport={() => setSheet('import')} />
      </View>
    ) : (
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
            paddingTop: listTop,
            // FAB und Tab-Bar duerfen keine Zeile verdecken.
            paddingBottom: size.listBottomPadding + insets.bottom,
          },
          isGrid ? styles.gridContent : null,
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={7}
      />
    );

  return (
    <View style={styles.screen}>
      {body}

      {selectionMode ? null : (
        <LibraryHeader
          scrollY={scrollY}
          collapsed={collapsed}
          viewMode={viewMode}
          onToggleViewMode={toggleViewMode}
          onOpenSort={() => setSheet('sort')}
          syncStatus={syncStatus}
          notice={notice}
          activeFilter={activeFilter}
          onSelectFilter={setFilter}
          chips={mode === 'loading' ? 'skeleton' : mode === 'empty' ? 'none' : 'filters'}
          top={insets.top}
        />
      )}

      {/*
        "Alle auswaehlen" wirkt auf die sichtbare Liste, nicht auf den Bestand:
        gefiltert und sortiert ist sie schon, und was der Filter gerade
        ausblendet, darf ein Tipp nicht mitwaehlen.
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
        Kein FAB im Auswahlmodus (Importieren ist dort keine sinnvolle Aktion),
        keiner auf der leeren Bibliothek (der primaere Button traegt dieselbe
        Aktion) und keiner, solange geladen wird (Blatt `4b` zeigt keinen).
      */}
      {selectionMode || mode !== 'ready' ? null : (
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
          actions.notify({
            message: `„${document.title}“ importiert`,
            icon: FileHtml,
            undo: () => trash([document.id]),
          })
        }
        onFailed={(reason) => actions.notify({ message: reason, icon: WarningCircle })}
      />

      {actions.overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  emptyBody: {
    flex: 1,
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
