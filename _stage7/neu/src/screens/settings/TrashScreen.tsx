/**
 * Screen 15 — Papierkorb (Blatt `6a`), erreichbar aus den Einstellungen.
 *
 * Aufbau von oben: Kopfzeile 56 mit Zurueck-Pfeil, "Papierkorb" als `title` und
 * "Auswählen" als Mint-Textbutton; darunter ein 36-px-Hinweisstreifen mit
 * `clock-countdown`; dann Sektionskopf "6 Dokumente" mit Gesamtgroesse rechts
 * und die Zeilen.
 *
 * Die Zeilen sind die Dokumentzeile, aber gedaempft: Kachel entsaettigt, Titel
 * in `text/secondary`, Metazeile "gelöscht vor 2 Tagen · 28 Tage übrig".
 * Unter drei Tagen wechselt die Restfrist auf `warning` **mit** Warnsymbol —
 * Farbe traegt nie allein die Bedeutung.
 *
 * "Wiederherstellen" ist je Zeile ein eigenes 48-x-48-Ziel; Wischen waere hier
 * zu riskant. "Papierkorb leeren" steht als sekundaerer Button mit
 * `danger`-Icon am Fuss der Liste, nicht als roter Block: die Aktion ist
 * unumkehrbar und soll nicht der auffaelligste Punkt des Screens sein.
 *
 * **Abweichung:** endgueltiges Loeschen ist die einzige Stelle der App, an der
 * ein Toast mit "Rueckgaengig" nicht genuegt — danach ist die Datei weg. Der
 * Screen fragt deshalb einmal nach, und zwar im Kontextmenue-Muster
 * (Komponente 9) statt in einem Dialog, den es sonst nirgends gibt.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, type ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatBytes, formatTrashMeta, trashDaysLeft } from '../../data/format';
import { TRASH_DAYS, type StoredDocument } from '../../data/library';
import { totalBytes } from '../../data/storage';
import { useDocumentStore } from '../../state/documents';
import { bg, border, iconSize, semantic, size, space, text as textColor } from '../../theme';
import { SecondaryButton, TextButton } from '../../ui/Button';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import { DocRow } from '../../ui/DocRow';
import { ArrowCounterClockwise, ClockCountdown, Trash, Warning } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { CompactHeader } from '../../ui/ScreenHeader';
import { SectionHeader } from '../../ui/SectionHeader';
import { Text } from '../../ui/Text';
import { Toast } from '../../ui/Toast';

/** Ab hier wechselt die Restfrist auf `warning` (Blatt `6a`). */
const URGENT_DAYS = 3;

interface Undoable {
  message: string;
  undo?: () => void;
}

export function TrashScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();

  const allDocuments = useDocumentStore((state) => state.documents);
  const restoreFromTrash = useDocumentStore((state) => state.restoreFromTrash);
  const deleteForever = useDocumentStore((state) => state.deleteForever);
  const trash = useDocumentStore((state) => state.trash);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [undoable, setUndoable] = useState<Undoable | null>(null);

  const documents = useMemo(
    () =>
      allDocuments
        .filter((document) => document.trashedAt !== null)
        // Zuletzt geloescht steht oben: was gerade weggeraeumt wurde, wird am
        // ehesten zurueckgeholt.
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)),
    [allDocuments]
  );

  const bytes = useMemo(() => totalBytes(documents), [documents]);

  const endSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const restore = (ids: string[]) => {
    const stamps = ids.map(
      (id) => allDocuments.find((document) => document.id === id)?.trashedAt ?? Date.now()
    );
    restoreFromTrash(ids);
    endSelection();
    setUndoable({
      message: ids.length === 1 ? 'Wiederhergestellt' : `${ids.length} wiederhergestellt`,
      // Jedes Dokument bekommt seinen eigenen Loeschzeitpunkt zurueck, sonst
      // saehe die Restfrist nach dem Zuruecknehmen anders aus als vorher.
      undo: () => ids.forEach((id, index) => trash([id], stamps[index])),
    });
  };

  const emptyTrash = () => {
    const ids = documents.map((document) => document.id);
    deleteForever(ids);
    endSelection();
    setConfirmOpen(false);
    setUndoable({ message: `${ids.length} endgültig gelöscht` });
  };

  const confirmItems: ContextMenuItem[] = [
    {
      key: 'empty',
      label: `${documents.length} endgültig löschen`,
      icon: Trash,
      destructive: true,
      onPress: emptyTrash,
    },
  ];

  const renderItem = ({ item, index }: ListRenderItemInfo<StoredDocument>) => {
    const trashedAt = item.trashedAt ?? Date.now();
    const left = trashDaysLeft(trashedAt, TRASH_DAYS);
    const urgent = left < URGENT_DAYS;
    const selected = selectedIds.includes(item.id);

    return (
      <View style={styles.rowWrap}>
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <DocRow
              id={item.id}
              title={item.title}
              type={item.docType}
              meta={formatTrashMeta(trashedAt, TRASH_DAYS)}
              metaIcon={urgent ? Warning : undefined}
              showFavorite={false}
              muted
              selectionMode={selectionMode}
              selected={selected}
              last
              onPress={() => {
                if (!selectionMode) return;
                setSelectedIds((current) =>
                  current.includes(item.id)
                    ? current.filter((entry) => entry !== item.id)
                    : [...current, item.id]
                );
              }}
            />
          </View>

          {/*
            Eigenes 48-x-48-Ziel neben der Zeile. Im Auswahlmodus entfaellt es:
            dort wirkt die Aktion auf alle Gewaehlten, und zwei Wege
            nebeneinander waeren nur eine Falle.
          */}
          {selectionMode ? null : (
            <PressableScale
              style={styles.restore}
              onPress={() => restore([item.id])}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} wiederherstellen`}
            >
              <ArrowCounterClockwise
                size={iconSize.md}
                color={urgent ? semantic.warning : textColor.secondary}
                weight="regular"
              />
            </PressableScale>
          )}
        </View>
          {/*
            Die Trennlinie gehoert hierher und nicht in die Zeile: sie muss
            unter der Schaltflaeche rechts durchlaufen, sonst endet sie
            mitten im Bild.
          */}
        {index === documents.length - 1 ? null : <View style={styles.divider} />}
      </View>
    );
  };

  const header = (
    <SectionHeader
      title={documents.length === 1 ? '1 Dokument' : `${documents.length} Dokumente`}
      hint={formatBytes(bytes)}
      style={styles.section}
    />
  );

  const footer =
    documents.length === 0 ? null : (
      <View style={styles.footer}>
        {selectionMode && selectedIds.length > 0 ? (
          <SecondaryButton
            icon={ArrowCounterClockwise}
            label={`${selectedIds.length} wiederherstellen`}
            onPress={() => restore(selectedIds)}
          />
        ) : (
          <SecondaryButton
            danger
            icon={Trash}
            label="Papierkorb leeren"
            onPress={() => setConfirmOpen(true)}
          />
        )}
      </View>
    );

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <CompactHeader
          title="Papierkorb"
          onBack={selectionMode ? endSelection : onBack}
          raised
          right={
            documents.length === 0 ? undefined : (
              <TextButton
                label={selectionMode ? 'Abbrechen' : 'Auswählen'}
                onPress={() => (selectionMode ? endSelection() : setSelectionMode(true))}
                style={styles.headerAction}
              />
            )
          }
        />

        {/* 36-px-Hinweisstreifen mit Linien oben und unten. */}
        <View style={styles.strip}>
          <ClockCountdown size={iconSize.sm} color={textColor.secondary} weight="regular" />
          <Text variant="caption" tone="secondary" numeric>
            {`Wird nach ${TRASH_DAYS} Tagen endgültig gelöscht`}
          </Text>
        </View>
      </View>

      {documents.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyBox}>
            <Trash size={36} color={border.strong} weight="regular" />
          </View>
          <Text variant="titleLg" style={styles.emptyTitle}>
            Papierkorb ist leer
          </Text>
          <Text variant="body" tone="secondary" style={styles.emptyNote}>
            Gelöschte Dokumente liegen hier {TRASH_DAYS} Tage lang und lassen sich bis
            dahin zurückholen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={documents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          contentContainerStyle={{ paddingBottom: size.screenPadding + insets.bottom }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ContextMenu
        visible={confirmOpen}
        items={confirmItems}
        onClose={() => setConfirmOpen(false)}
      />

      <Toast
        visible={undoable !== null}
        message={undoable?.message ?? ''}
        icon={undoable?.undo ? ArrowCounterClockwise : Trash}
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
  headerAction: {
    paddingHorizontal: space['12'],
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    height: size.noticeStripHeight,
    paddingHorizontal: size.screenPadding,
    backgroundColor: bg.raised,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.subtle,
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
  restore: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: size.screenPadding,
    paddingTop: space['24'],
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
