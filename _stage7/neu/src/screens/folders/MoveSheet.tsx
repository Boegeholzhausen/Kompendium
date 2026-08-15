/**
 * Sheet "Verschieben" — der Zustand `activeSheet: 'move'` aus dem
 * Handoff-Dokument.
 *
 * Es hat kein eigenes Blatt im Prototyp, wird aber an drei Stellen gebraucht:
 * "Ordner" im Info-Sheet (Blatt `2d`), "Verschieben" in der Auswahl-Aktions-
 * leiste (Blatt `3h`) und "Einsortieren" in der Sektion "Neu" (Blatt `1c`).
 *
 * Gebaut ist es aus vorhandenen Teilen: Sheet-Huelle und Zeilen in der Form des
 * Kontextmenues. Zwei Eintraege fallen aus dem Ordnerbestand heraus und stehen
 * deshalb abgesetzt:
 *
 *   "Nicht einsortiert"  der Rueckweg — ohne ihn waere Einsortieren eine
 *                        Einbahnstrasse.
 *   "Neuer Ordner"       weil beim Einsortieren am haeufigsten auffaellt, dass
 *                        der passende Ordner noch fehlt.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useDocumentStore } from '../../state/documents';
import { useFolderStore } from '../../state/folders';
import { accent, bg, border, iconSize, radius, size, space, text as textColor } from '../../theme';
import { BottomSheet } from '../../ui/BottomSheet';
import { Check, Folder, Plus, Tray } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { Text } from '../../ui/Text';
import { CreateFolderSheet } from './CreateFolderSheet';

export interface MoveSheetProps {
  visible: boolean;
  /** Die zu verschiebenden Dokumente. */
  documentIds: string[];
  onClose: () => void;
  /** Meldet den Zielordner zurueck — der Screen zeigt den Toast. */
  onMoved?: (folderName: string | null) => void;
}

export function MoveSheet({ visible, documentIds, onClose, onMoved }: MoveSheetProps) {
  const folders = useFolderStore((state) => state.folders);
  const documents = useDocumentStore((state) => state.documents);
  const setFolder = useDocumentStore((state) => state.setFolder);

  const [createOpen, setCreateOpen] = useState(false);

  /** Anzahl je Ordner, damit die Zeile so viel sagt wie in der Uebersicht. */
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

  /** Der aktuelle Ordner, wenn alle gewaehlten Dokumente im selben liegen. */
  const current = useMemo(() => {
    if (documentIds.length === 0) return undefined;
    const chosen = documentIds.map(
      (id) => documents.find((document) => document.id === id)?.folderName ?? null
    );
    const first = chosen[0];
    return chosen.every((name) => name === first) ? first : undefined;
  }, [documentIds, documents]);

  const move = (name: string | null) => {
    setFolder(documentIds, name);
    onMoved?.(name);
    onClose();
  };

  const title =
    documentIds.length === 1 ? 'Verschieben' : `${documentIds.length} Dokumente verschieben`;

  return (
    <>
      <BottomSheet visible={visible && !createOpen} title={title} onClose={onClose}>
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {folders.map((folder) => {
            const selected = current === folder.name;
            return (
              <PressableScale
                key={folder.name}
                style={styles.entry}
                pressedStyle={styles.entryPressed}
                scaleOnPress={false}
                onPress={() => move(folder.name)}
                accessibilityRole="menuitem"
                accessibilityLabel={`Nach ${folder.name} verschieben`}
                accessibilityState={{ selected }}
              >
                <Folder size={iconSize.md} color={folder.color} weight="fill" />
                <Text variant="body" tone={selected ? 'accent' : 'primary'} style={styles.label}>
                  {folder.name}
                </Text>
                <Text variant="caption" tone="secondary" numeric>
                  {counts[folder.name] ?? 0}
                </Text>
                {selected ? <Check size={20} color={accent.base} weight="bold" /> : null}
              </PressableScale>
            );
          })}

          <View style={styles.divider} />

          <PressableScale
            style={styles.entry}
            pressedStyle={styles.entryPressed}
            scaleOnPress={false}
            onPress={() => move(null)}
            accessibilityRole="menuitem"
            accessibilityLabel="Aus dem Ordner nehmen"
            accessibilityState={{ selected: current === null }}
          >
            <Tray size={iconSize.md} color={textColor.secondary} weight="regular" />
            <Text
              variant="body"
              tone={current === null ? 'accent' : 'primary'}
              style={styles.label}
            >
              Nicht einsortiert
            </Text>
            {current === null ? <Check size={20} color={accent.base} weight="bold" /> : null}
          </PressableScale>

          <PressableScale
            style={styles.entry}
            pressedStyle={styles.entryPressed}
            scaleOnPress={false}
            onPress={() => setCreateOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Neuen Ordner anlegen"
          >
            <Plus size={iconSize.md} color={accent.base} weight="regular" />
            <Text variant="body" tone="accent" style={styles.label}>
              Neuer Ordner
            </Text>
          </PressableScale>
        </ScrollView>
      </BottomSheet>

      <CreateFolderSheet
        visible={createOpen}
        moveIds={documentIds}
        onCreated={(name) => {
          onMoved?.(name);
          onClose();
        }}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: size.touchTarget * 8,
  },
  listContent: {
    paddingBottom: space['8'],
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.touchTarget,
    paddingHorizontal: space['12'],
    borderRadius: radius.sm,
  },
  entryPressed: {
    backgroundColor: bg.raised,
  },
  label: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: border.strong,
    marginVertical: space['8'],
    marginHorizontal: space['12'],
  },
});
