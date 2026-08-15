/**
 * "Offline behaltene Dokumente" — das Ziel des Chevrons in der Gruppe
 * "Speicher" (Blatt `3i`).
 *
 * Kein eigenes Blatt im Prototyp: das Blatt zeigt die Zeile mit Anzahl und
 * Chevron, also etwas, das irgendwohin fuehrt. Gebaut ist der Screen deshalb
 * ausschliesslich aus vorhandenen Teilen — kompakte Kopfzeile (`3b`, `6a`),
 * Sektionskopf mit Gesamtgroesse (`6a`) und die Dokumentzeile.
 *
 * Jede Zeile traegt `cloud-check` und das Wort "offline", nie Farbe allein.
 * Der Schalter dahinter ist derselbe wie im Info-Sheet — wer hier eines
 * herausnimmt, sieht die Zahl in den Einstellungen sofort sinken.
 */
import React, { useMemo } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { formatBytes } from '../../data/format';
import type { StoredDocument } from '../../data/library';
import { totalBytes } from '../../data/storage';
import { useDocumentStore } from '../../state/documents';
import { bg, border, iconSize, size, space, text as textColor } from '../../theme';
import { DocRow } from '../../ui/DocRow';
import { CloudCheck, CloudSlash } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { CompactHeader } from '../../ui/ScreenHeader';
import { SectionHeader } from '../../ui/SectionHeader';
import { Text } from '../../ui/Text';

export function OfflineScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const allDocuments = useDocumentStore((state) => state.documents);
  const setKeepOffline = useDocumentStore((state) => state.setKeepOffline);
  const toggleFavorite = useDocumentStore((state) => state.toggleFavorite);

  const documents = useMemo(
    () =>
      allDocuments
        .filter((document) => document.keepOffline && document.trashedAt === null)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [allDocuments]
  );

  const bytes = useMemo(() => totalBytes(documents), [documents]);

  const renderItem = ({ item, index }: ListRenderItemInfo<StoredDocument>) => (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <View style={styles.rowBody}>
          <DocRow
            id={item.id}
            title={item.title}
            type={item.docType}
            meta={`offline · ${formatBytes(item.sizeBytes)}`}
            metaIcon={CloudCheck}
            favorite={item.favorite}
            last
            onPress={() => router.push(`/dokument/${item.id}`)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        </View>

        <PressableScale
          style={styles.drop}
          onPress={() => setKeepOffline(item.id, false)}
          accessibilityRole="button"
          accessibilityLabel={`${item.title} nicht mehr offline behalten`}
        >
          <CloudSlash size={iconSize.md} color={textColor.secondary} weight="regular" />
        </PressableScale>
      </View>

      {/*
        Die Trennlinie gehoert hierher und nicht in die Zeile: sie muss unter
        der Schaltflaeche rechts durchlaufen, sonst endet sie mitten im Bild.
      */}
      {index === documents.length - 1 ? null : <View style={styles.divider} />}
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <CompactHeader title="Offline behalten" onBack={onBack} raised />
      </View>

      {documents.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyBox}>
            <CloudSlash size={36} color={border.strong} weight="regular" />
          </View>
          <Text variant="titleLg" style={styles.emptyTitle}>
            Nichts offline behalten
          </Text>
          <Text variant="body" tone="secondary" style={styles.emptyNote}>
            Im Info-Sheet eines Dokuments oder über „Für offline laden" in einem Ordner
            lässt sich festlegen, was ohne Netz verfügbar bleibt.
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <SectionHeader
              title={documents.length === 1 ? '1 Dokument' : `${documents.length} Dokumente`}
              hint={formatBytes(bytes)}
              style={styles.section}
            />
          }
          contentContainerStyle={{ paddingBottom: size.screenPadding + insets.bottom }}
          showsVerticalScrollIndicator={false}
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
  section: {
    marginTop: space['20'],
    marginBottom: space['8'],
    paddingHorizontal: size.screenPadding,
  },
  rowWrap: {
    paddingHorizontal: size.screenPadding,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  divider: {
    height: 1,
    backgroundColor: border.subtle,
  },
  drop: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['32'],
  },
  emptyBox: {
    width: size.emptyIconBox,
    height: size.emptyIconBox,
    borderRadius: size.emptyIconRadius,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: space['20'],
  },
  emptyNote: {
    marginTop: space['8'],
    textAlign: 'center',
  },
});
