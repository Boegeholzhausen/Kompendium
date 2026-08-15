/**
 * Screen 3 — Ordner-Uebersicht (Blatt `3a`).
 *
 * Aufbau von oben: Kopf "Ordner" mit Sortier-Schaltflaeche, Sync-Leiste, dann
 * "Alle Dokumente" als **volle Zeile** und darunter das 2-Spalten-Raster der
 * Ordner-Kacheln mit "Ordner anlegen" als letzter, gestrichelter Kachel.
 *
 * "Alle Dokumente" steht bewusst nicht als erste Kachel im Raster: es ist kein
 * Ordner und soll auch nicht wie einer aussehen.
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
import { useRouter } from 'expo-router';

import { useDocumentStore } from '../../state/documents';
import { useSyncStore } from '../../state/sync';
import { useFolderStore, type LibraryFolder } from '../../state/folders';
import { bg, border, iconSize, radius, size, space, text as textColor } from '../../theme';
import { ChoiceSheet } from '../../ui/ChoiceSheet';
import { CreateFolderTile, FolderTile } from '../../ui/FolderTile';
import { ArrowsDownUp, Books, CaretRight } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { PressableScale } from '../../ui/press';
import { TitleHeader } from '../../ui/ScreenHeader';
import { SyncIndicator } from '../../ui/SyncIndicator';
import { Text } from '../../ui/Text';
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
  const router = useRouter();

  const folders = useFolderStore((state) => state.folders);
  const documents = useDocumentStore((state) => state.documents);
  const syncStatus = useSyncStore((state) => state.status);

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

  const allCount = useMemo(
    () => documents.filter((document) => document.trashedAt === null).length,
    [documents]
  );

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
    router.push(`/ordner/${encodeURIComponent(folder.name)}`);
  };

  /**
   * Die gestrichelte Kachel haengt hinten an der Liste und teilt sich die
   * Zeile mit dem letzten Ordner. Deshalb wandert sie als Platzhalter durch
   * dieselbe Paar-Bildung.
   */
  const tiles: (LibraryFolder | null)[] = [...sorted, null];
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
        <PressableScale
          style={styles.allRow}
          pressedStyle={styles.allRowPressed}
          scaleOnPress={false}
          // Eigene Route, kein Ordner mit dem Namen "alle": ein echter Ordner
          // duerfte sonst nie so heissen.
          onPress={() => router.push('/alle-dokumente')}
          accessibilityRole="button"
          accessibilityLabel={`Alle Dokumente, ${allCount}`}
        >
          <Books size={iconSize.lg} color={textColor.secondary} weight="fill" />
          <View style={styles.allBody}>
            <Text variant="body">Alle Dokumente</Text>
            <Text variant="caption" tone="secondary" numeric>
              {allCount}
            </Text>
          </View>
          <CaretRight size={18} color={textColor.tertiary} weight="regular" />
        </PressableScale>

        <View style={styles.grid}>
          {rows.map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((folder, column) =>
                folder === null ? (
                  <CreateFolderTile
                    key={`create-${column}`}
                    style={styles.tile}
                    onPress={() => setCreateOpen(true)}
                  />
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
              {/* Haelt die letzte Kachel auf halber Breite, wenn die Zeile nur eine traegt. */}
              {row.length === 1 ? <View style={styles.tile} /> : null}
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
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.rowHeight,
    paddingHorizontal: size.cardPadding,
    borderRadius: radius.md,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  allRowPressed: {
    backgroundColor: bg.raised,
    borderColor: border.strong,
  },
  allBody: {
    flex: 1,
  },
  grid: {
    marginTop: space['20'],
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
