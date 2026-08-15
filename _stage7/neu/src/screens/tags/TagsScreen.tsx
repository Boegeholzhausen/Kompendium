/**
 * Screen 11 — Tag-Verwaltung (Blatt `3f`).
 *
 * Kopf "Tags" als `display`, rechts "+ Neuer Tag" als **sekundaere Pille**,
 * nicht als FAB: Tags entstehen beim Zuweisen (Kernflow `4e`), ein Mint-FAB
 * gaebe diesem Screen falsches Gewicht.
 *
 * Zeilen 60 hoch ueber die ganze Breite mit Farbpunkt 10, Name, Anzahl und
 * Chevron. Wischen nach links legt "Umbenennen" (88) und "Loeschen" (72) frei —
 * beides mit Icon UND Wort.
 *
 * Wischen ist nur eine Abkuerzung: dieselben Aktionen liegen hinter dem
 * Chevron, und die Hinweiszeile am Listenende sagt das ausdruecklich.
 *
 * Loeschen ist unumkehrbar genug, um abgesichert zu werden — aber nicht mit
 * einem Dialog: der Toast traegt fuenf Sekunden lang "Rueckgaengig", wie
 * ueberall sonst in der App.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LibraryTag } from '../../data/library';
import { useDocumentStore } from '../../state/documents';
import { bg, border, size, space, text as textColor } from '../../theme';
import { PillButton } from '../../ui/Button';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { CaretRight, PencilSimple, Plus, Tag as TagIcon, Trash } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { RenameSheet } from '../../ui/RenameSheet';
import { TitleHeader } from '../../ui/ScreenHeader';
import { SwipeRow } from '../../ui/SwipeRow';
import { Text } from '../../ui/Text';
import { Toast } from '../../ui/Toast';
import { NewTagSheet } from './NewTagSheet';

/** Breiten aus Blatt `3f` — mit Wort statt nur Icon. */
const RENAME_WIDTH = 88;
const DELETE_WIDTH = 72;

interface Undoable {
  message: string;
  undo: () => void;
}

export function TagsScreen() {
  const insets = useSafeAreaInsets();

  const tags = useDocumentStore((state) => state.tags);
  const documents = useDocumentStore((state) => state.documents);
  const renameTag = useDocumentStore((state) => state.renameTag);
  const deleteTag = useDocumentStore((state) => state.deleteTag);
  const restoreTag = useDocumentStore((state) => state.restoreTag);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<LibraryTag | null>(null);
  const [renameFor, setRenameFor] = useState<LibraryTag | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [undoable, setUndoable] = useState<Undoable | null>(null);

  /** Wie viele Dokumente jeden Tag tragen — die Zahl in der Zeile. */
  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const document of documents) {
      if (document.trashedAt !== null) continue;
      for (const id of document.tagIds) result[id] = (result[id] ?? 0) + 1;
    }
    return result;
  }, [documents]);

  const remove = (tag: LibraryTag) => {
    // Welche Dokumente den Tag tragen, muss VOR dem Loeschen feststehen —
    // danach ist es nicht mehr zu ermitteln.
    const affected = documents
      .filter((document) => document.tagIds.includes(tag.id))
      .map((document) => document.id);

    deleteTag(tag.id);
    setOpenKey(null);
    setUndoable({
      message: `Tag „${tag.name}“ gelöscht`,
      undo: () => restoreTag(tag, affected),
    });
  };

  const menuItems: ContextMenuItem[] =
    menuFor === null
      ? []
      : [
          {
            key: 'rename',
            label: 'Umbenennen',
            icon: PencilSimple,
            onPress: () => {
              const tag = menuFor;
              setMenuFor(null);
              setRenameFor(tag);
            },
          },
          {
            key: 'delete',
            label: 'Löschen',
            icon: Trash,
            destructive: true,
            onPress: () => {
              const tag = menuFor;
              setMenuFor(null);
              remove(tag);
            },
          },
        ];

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <TitleHeader
          title="Tags"
          right={<PillButton icon={Plus} label="Neuer Tag" onPress={() => setNewOpen(true)} />}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: size.listBottomPadding + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {tags.map((tag) => (
          <SwipeRow
            key={tag.id}
            id={tag.id}
            openKey={openKey}
            onOpenChange={setOpenKey}
            actions={[
              {
                key: 'rename',
                label: 'Umbenennen',
                icon: PencilSimple,
                width: RENAME_WIDTH,
                onPress: () => setRenameFor(tag),
              },
              {
                key: 'delete',
                label: 'Löschen',
                icon: Trash,
                width: DELETE_WIDTH,
                danger: true,
                onPress: () => remove(tag),
              },
            ]}
          >
            <PressableScale
              style={styles.row}
              pressedStyle={styles.rowPressed}
              scaleOnPress={false}
              onPress={() => setMenuFor(tag)}
              accessibilityRole="button"
              accessibilityLabel={`Tag ${tag.name}, ${counts[tag.id] ?? 0} Dokumente`}
            >
              <View style={[styles.dot, { backgroundColor: tag.color }]} />
              <Text variant="body" numberOfLines={1} style={styles.name}>
                {tag.name}
              </Text>
              <Text variant="caption" tone="secondary" numeric>
                {counts[tag.id] ?? 0}
              </Text>
              <CaretRight size={18} color={textColor.tertiary} weight="regular" />
            </PressableScale>
          </SwipeRow>
        ))}

        <Text variant="label" tone="tertiary" style={styles.hint}>
          Wischen ist nur eine Abkürzung — dieselben Aktionen liegen hinter dem Chevron.
        </Text>
      </ScrollView>

      <ContextMenu visible={menuFor !== null} items={menuItems} onClose={() => setMenuFor(null)} />

      {renameFor === null ? null : (
        <RenameSheet
          visible
          title="Tag umbenennen"
          currentName={renameFor.name}
          color={renameFor.color}
          count={counts[renameFor.id] ?? 0}
          hint={`Wirkt auf alle ${counts[renameFor.id] ?? 0} Dokumente mit diesem Tag`}
          onSubmit={(next) => renameTag(renameFor.id, next)}
          onClose={() => setRenameFor(null)}
        />
      )}

      <NewTagSheet visible={newOpen} onClose={() => setNewOpen(false)} />

      <Toast
        visible={undoable !== null}
        message={undoable?.message ?? ''}
        icon={TagIcon}
        actionLabel="Rückgängig"
        onAction={() => {
          undoable?.undo();
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
  content: {
    paddingTop: space['8'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    // 60 aus Blatt `3f`; das Beruehrungsziel ist damit ueber 48.
    height: size.rowHeight - space['4'],
    paddingHorizontal: size.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  rowPressed: {
    backgroundColor: bg.surface,
  },
  dot: {
    width: size.tagDotLarge,
    height: size.tagDotLarge,
    borderRadius: size.tagDotLarge,
  },
  name: {
    flex: 1,
  },
  hint: {
    padding: size.screenPadding,
  },
});
