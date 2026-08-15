/**
 * Screen 4 — Ordner-Detail (Blatt `3b`) und zugleich "Alle Dokumente".
 *
 * Aufbau: 56er Kopfzeile **ohne Titel** (Zurueck-Pfeil und Ueberlaufmenue),
 * darunter Ordner-Icon 32, Name als `display`, "38 Dokumente · 12 MB" als
 * `caption`, zwei kompakte Aktionen und dann Sektionskopf "Zuletzt geaendert"
 * mit Ansichtsumschalter und derselben Liste wie in der Bibliothek.
 *
 * Beide Aktionen sind **sekundaer**: der Ordner hat keine primaere Aktion, ein
 * Mint-Button fuer "Offline laden" haette mehr Gewicht als die Sache verdient.
 *
 * "Alle Dokumente" (`folderName === null`) benutzt denselben Screen: es ist
 * dieselbe Liste mit demselben Kopf, nur ohne Ordnerfarbe und ohne Aktionen —
 * ein zweiter Screen dafuer waere dieselbe Datei mit weniger darin.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatBytes, formatDocumentMeta } from '../../data/format';
import type { StoredDocument } from '../../data/library';
import { documentTags, useDocumentStore } from '../../state/documents';
import { colorOf, useFolderStore } from '../../state/folders';
import { useLibraryStore } from '../../state/library';
import { useUnavailable } from '../../state/network';
import { bg, size, space } from '../../theme';
import { SecondaryButton } from '../../ui/Button';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { DocCard } from '../../ui/DocCard';
import { DocRow } from '../../ui/DocRow';
import {
  Books,
  CloudCheck,
  CloudSlash,
  DotsThreeVertical,
  DownloadSimple,
  Folder,
  PencilSimple,
  Rows,
  SquaresFour,
} from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { RenameSheet } from '../../ui/RenameSheet';
import { CompactHeader } from '../../ui/ScreenHeader';
import { SectionHeader } from '../../ui/SectionHeader';
import { Text } from '../../ui/Text';

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
  const setFolderOffline = useFolderStore((state) => state.setKeepOffline);

  const allDocuments = useDocumentStore((state) => state.documents);
  const tags = useDocumentStore((state) => state.tags);
  const renameFolderEverywhere = useDocumentStore((state) => state.renameFolderEverywhere);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);
  const setDocumentsKeepOffline = useDocumentStore((state) => state.setDocumentsKeepOffline);

  const viewMode = useLibraryStore((state) => state.viewMode);
  const toggleViewMode = useLibraryStore((state) => state.toggleViewMode);

  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

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
    return list.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allDocuments, folderName, isAll]);

  const totalBytes = useMemo(
    () => documents.reduce((sum, document) => sum + document.sizeBytes, 0),
    [documents]
  );

  const isGrid = viewMode === 'grid';
  const keepOffline = folder?.keepOffline ?? false;

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

      <SectionHeader
        title="Zuletzt geändert"
        style={styles.section}
        right={
          <IconButton
            icon={isGrid ? SquaresFour : Rows}
            active
            onPress={toggleViewMode}
            accessibilityLabel={
              isGrid ? 'Kachelansicht, zu Liste wechseln' : 'Listenansicht, zu Kacheln wechseln'
            }
          />
        }
      />
    </View>
  );

  /** Nicht geladen UND kein Netz (Blatt `4c`) — siehe `data/library`. */
  const unavailable = useUnavailable();

  const renderItem = ({ item, index }: ListRenderItemInfo<StoredDocument>) => {
    const open = () => router.push(`/dokument/${item.id}`);

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
          last={index === documents.length - 1}
          onPress={open}
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
