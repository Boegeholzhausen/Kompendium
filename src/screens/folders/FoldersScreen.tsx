/**
 * Screen 3 — Ordner-Uebersicht (Blatt `3a`).
 *
 * Aufbau von oben: Kopf "Ordner" mit Sortier-Schaltflaeche, Sync-Leiste, dann
 * das 2-Spalten-Raster der Ordner-Kacheln mit "Ordner anlegen" als letzter,
 * gestrichelter Kachel.
 *
 * Eine Zeile "Alle Dokumente" gibt es hier bewusst nicht mehr: der
 * Bibliothek-Tab zeigt bereits alle Dokumente. Mit ihr ist auch das
 * `marginTop: 20` des Rasters weggefallen — es war der Abstand zwischen jener
 * Zeile und den Kacheln und stand danach als zusaetzliche Luft unter der
 * Sync-Leiste. Das Raster beginnt jetzt auf dem Seitenrand 16, demselben
 * Abstand wie in Bibliothek und Einstellungen, sodass beim Tab-Wechsel nichts
 * springt.
 *
 * Das Raster ist von Hand in Zeilen gelegt statt ueber eine FlatList mit
 * `numColumns`: die Kacheln sind unterschiedlich hoch (ein langer Ordnername
 * bricht um), und nur in einer Zeile mit `alignItems: 'stretch'` bleiben beide
 * Kacheln gleich hoch. Bei hoechstens ein paar Dutzend Ordnern kostet das
 * nichts.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedPush } from '../../navigation/useGuardedPush';

import { useDocumentStore } from '../../state/documents';
import { useSyncStore } from '../../state/sync';
import { useFolderStore, type LibraryFolder } from '../../state/folders';
import { bg, size, space } from '../../theme';
import { ChoiceSheet } from '../../ui/ChoiceSheet';
import { CreateFolderTile, FolderTile } from '../../ui/FolderTile';
import { ArrowsDownUp, Folder } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { TitleHeader } from '../../ui/ScreenHeader';
import { SyncIndicator } from '../../ui/SyncIndicator';
import { Toast } from '../../ui/Toast';
import { CreateFolderSheet } from './CreateFolderSheet';

type FolderSort = 'name' | 'count';

const sortOptions = [
  { key: 'name', label: 'Name' },
  { key: 'count', label: 'Anzahl' },
];

/** Zeilenweise in Paare legen — siehe Kopfkommentar. */
function inPairs<T>(items: T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], i + 1 < items.length ? items[i + 1] : null]);
  }
  return rows;
}

export function FoldersScreen() {
  const insets = useSafeAreaInsets();
  const push = useGuardedPush();

  const folders = useFolderStore((state) => state.folders);
  const documents = useDocumentStore((state) => state.documents);
  const syncStatus = useSyncStore((state) => state.status);
  /** "Ordner geloescht" aus dem Detail-Screen — siehe `PendingUndo`. */
  const pendingUndo = useFolderStore((state) => state.pendingUndo);
  const setPendingUndo = useFolderStore((state) => state.setPendingUndo);

  const [sort, setSort] = useState<FolderSort>('name');
  const [sortOpen, setSortOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  /** Anzahl je Ordner aus der Zuordnung im Dokument-Zustand. */
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const document of documents) {
      if (document.trashedAt !== null) continue;
      if (document.folderName !== null) {
        result[document.folderName] = (result[document.folderName] ?? 0) + 1;
      }
    }
    return result;
  }, [documents]);

  const sorted = useMemo(() => {
    const list = [...folders];
    if (sort === 'count') {
      list.sort((a, b) => (counts[b.name] ?? 0) - (counts[a.name] ?? 0));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }
    return list;
  }, [counts, folders, sort]);

  const openFolder = (folder: LibraryFolder) => {
    push(`/ordner/${encodeURIComponent(folder.name)}`);
  };

  /**
   * Die gestrichelte Kachel haengt hinten an der Liste und teilt sich die
   * Zeile mit dem letzten Ordner. Deshalb wandert sie als Marker `'create'`
   * durch dieselbe Paar-Bildung — das `null` aus `inPairs` bleibt damit
   * eindeutig das blosse Auffuellen einer halben Zeile.
   */
  const tiles: (LibraryFolder | 'create' | null)[] = [...sorted, 'create'];
  const rows = inPairs(tiles);

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <TitleHeader
          title="Ordner"
          right={
            <IconButton
              icon={ArrowsDownUp}
              onPress={() => setSortOpen(true)}
              accessibilityLabel="Ordner sortieren"
            />
          }
        />
        <SyncIndicator status={syncStatus} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: size.listBottomPadding + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {rows.map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((folder, column) =>
                folder === 'create' ? (
                  <CreateFolderTile
                    key={`create-${column}`}
                    style={styles.tile}
                    onPress={() => setCreateOpen(true)}
                  />
                ) : folder === null ? (
                  // Haelt die letzte Kachel auf halber Breite, wenn die Zeile
                  // nur eine traegt.
                  <View key={`spacer-${column}`} style={styles.tile} />
                ) : (
                  <FolderTile
                    key={folder.name}
                    name={folder.name}
                    count={counts[folder.name] ?? 0}
                    color={folder.color}
                    style={styles.tile}
                    onPress={() => openFolder(folder)}
                  />
                )
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <ChoiceSheet
        visible={sortOpen}
        title="Ordner sortieren"
        options={sortOptions}
        value={sort}
        onSelect={(key) => setSort(key as FolderSort)}
        onClose={() => setSortOpen(false)}
      />

      <CreateFolderSheet visible={createOpen} onClose={() => setCreateOpen(false)} />

      <Toast
        visible={pendingUndo !== null}
        message={pendingUndo?.message ?? ''}
        icon={Folder}
        actionLabel="Rückgängig"
        onAction={() => {
          pendingUndo?.undo();
          setPendingUndo(null);
        }}
        onHide={() => setPendingUndo(null)}
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
  content: {
    padding: size.screenPadding,
  },
  grid: {
    gap: space['12'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space['12'],
  },
  tile: {
    flex: 1,
  },
});
