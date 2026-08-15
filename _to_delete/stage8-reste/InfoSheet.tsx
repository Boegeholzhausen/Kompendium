/**
 * Screen 7 · Info-Sheet (Blatt `2d`).
 *
 * Bottom-Sheet ueber dem Viewer, Hoehe etwa 75 %. Die Reihenfolge folgt der
 * Haeufigkeit: Titel, Ordner, Tags, Notiz, "Offline behalten", zuletzt die
 * Metadaten — abgelesen wird selten, sortiert oft.
 *
 * "In den Papierkorb" steht **ausserhalb** des scrollenden Bereichs hinter
 * einer eigenen Trennlinie: es darf nie unter den Daumen rutschen, waehrend
 * jemand Tags setzt.
 */
import React from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { formatBytes, formatDate } from '../../data/format';
import { sourceLabels, type LibraryTag, type StoredDocument } from '../../data/library';
import {
  bg,
  border,
  iconSize,
  radius,
  semantic,
  size,
  space,
  text as textColor,
} from '../../theme';
import { typeScale } from '../../theme/typography';
import { SheetLayer } from '../../ui/BottomSheet';
import { CaretRight, Folder, PencilSimple, Trash, Tray } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { Switch } from '../../ui/Switch';
import { AddTagChip, TagChip } from '../../ui/TagChip';
import { Text } from '../../ui/Text';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text variant="overline" tone="tertiary">
        {label}
      </Text>
      {children}
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text variant="label" numeric>
        {value}
      </Text>
    </View>
  );
}

export interface InfoSheetProps {
  visible: boolean;
  document: StoredDocument;
  title: string;
  /** Ordner aus dem Dokument-Zustand — nicht aus dem Bestand, er kann sich aendern. */
  folderName: string | null;
  /** Farbe dieses Ordners; sie lebt im Ordner-Zustand, nicht am Dokument. */
  folderColor: string;
  tags: LibraryTag[];
  note: string;
  keepOffline: boolean;
  openCount: number;
  height: number;
  onClose: () => void;
  onChangeTitle: (title: string) => void;
  onChangeNote: (note: string) => void;
  onChangeKeepOffline: (keep: boolean) => void;
  onOpenFolder: () => void;
  onAddTag: () => void;
  onRemoveTag: (tagId: string) => void;
  onTrash: () => void;
}

export function InfoSheet({
  visible,
  document,
  title,
  folderName,
  folderColor,
  tags,
  note,
  keepOffline,
  openCount,
  height,
  onClose,
  onChangeTitle,
  onChangeNote,
  onChangeKeepOffline,
  onOpenFolder,
  onAddTag,
  onRemoveTag,
  onTrash,
}: InfoSheetProps) {
  // Die Herkunft steht seit Schritt 7 in der Zeile — bis dahin stand hier
  // "Datei-Import" fuer alles, was es noch gar nicht geben konnte.
  const source = sourceLabels[document.source];

  return (
    <SheetLayer
      visible={visible}
      height={height}
      title="Dokument"
      onClose={onClose}
      footer={
        <PressableScale
          style={styles.trash}
          scaleOnPress={false}
          onPress={onTrash}
          accessibilityRole="button"
          accessibilityLabel="In den Papierkorb"
        >
          <Trash size={iconSize.md} color={semantic.danger} weight="regular" />
          <Text variant="body" tone="danger">
            In den Papierkorb
          </Text>
        </PressableScale>
      }
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/*
          Der Titel ist ein Feld, kein Text mit Stift daneben: Umbenennen ist
          die haeufigste Aenderung am Dokument, und ein eigenes Sheet dafuer
          waere ein Umweg. Der Stift zeigt nur, dass hier geschrieben wird.
        */}
        <Field label="Titel">
          <View style={styles.box}>
            <TextInput
              style={[typeScale.body, styles.input]}
              value={title}
              onChangeText={onChangeTitle}
              selectionColor={textColor.primary}
              maxFontSizeMultiplier={1.3}
              accessibilityLabel="Titel des Dokuments"
              underlineColorAndroid="transparent"
            />
            <PencilSimple size={iconSize.md} color={textColor.secondary} weight="regular" />
          </View>
        </Field>

        <Field label="Ordner">
          <PressableScale
            style={styles.box}
            pressedStyle={styles.boxPressed}
            scaleOnPress={false}
            onPress={onOpenFolder}
            accessibilityRole="button"
            accessibilityLabel={`Ordner ${folderName ?? 'Nicht einsortiert'} aendern`}
          >
            {folderName === null ? (
              <Tray size={iconSize.md} color={textColor.secondary} weight="regular" />
            ) : (
              <Folder size={iconSize.md} color={folderColor} weight="fill" />
            )}
            <Text variant="body" style={styles.boxLabel} numberOfLines={1}>
              {folderName ?? 'Nicht einsortiert'}
            </Text>
            <CaretRight size={18} color={textColor.secondary} weight="regular" />
          </PressableScale>
        </Field>

        <Field label="Tags">
          <View style={styles.chips}>
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                label={tag.name}
                color={tag.color}
                large
                removable
                onRemove={() => onRemoveTag(tag.id)}
              />
            ))}
            <AddTagChip large onPress={onAddTag} />
          </View>
        </Field>

        <Field label="Notiz">
          <View style={[styles.box, styles.noteBox]}>
            <TextInput
              style={[typeScale.body, styles.input, styles.noteInput]}
              value={note}
              onChangeText={onChangeNote}
              placeholder="Notiz hinzufügen"
              placeholderTextColor={textColor.tertiary}
              selectionColor={textColor.primary}
              multiline
              maxFontSizeMultiplier={1.3}
              accessibilityLabel="Notiz zum Dokument"
              underlineColorAndroid="transparent"
            />
          </View>
        </Field>

        <View style={styles.offlineRow}>
          <View style={styles.offlineLabel}>
            <Text variant="body">Offline behalten</Text>
            <Text variant="caption" tone="secondary" numeric>
              {`${formatBytes(document.sizeBytes)} im Cache`}
            </Text>
          </View>
          <Switch
            value={keepOffline}
            onValueChange={onChangeKeepOffline}
            accessibilityLabel="Dokument offline behalten"
          />
        </View>

        <View style={styles.meta}>
          <MetaRow label="Importiert am" value={formatDate(document.importedAt)} />
          <MetaRow label="Größe" value={formatBytes(document.sizeBytes)} />
          <MetaRow label="Geöffnet" value={`${openCount}×`} />
          <MetaRow label="Quelle" value={source} />
        </View>
      </ScrollView>
    </SheetLayer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    gap: space['12'],
    paddingBottom: space['12'],
  },
  field: {
    gap: space['8'],
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'] + space['2'],
    minHeight: size.searchFieldHeight,
    borderRadius: radius.md,
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.strong,
    paddingHorizontal: size.cardPadding,
  },
  boxPressed: {
    backgroundColor: bg.overlay,
  },
  boxLabel: {
    flex: 1,
  },
  input: {
    flex: 1,
    // Siehe `ui/SearchField`: ohne diesen Wert draengt das Eingabefeld im
    // Web-Export seine Nachbarn auf Breite null.
    minWidth: 0,
    color: textColor.primary,
    padding: 0,
  },
  noteBox: {
    // Mindestens 56 hoch, waechst mit der Notiz.
    minHeight: size.toastHeight,
    alignItems: 'flex-start',
    paddingVertical: space['12'],
  },
  noteInput: {
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['8'],
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: size.toastHeight,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.strong,
  },
  offlineLabel: {
    flex: 1,
  },
  meta: {
    gap: space['4'] + space['2'],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trash: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'] + space['2'],
    minHeight: size.touchTarget,
    borderTopWidth: 1,
    borderTopColor: border.strong,
    paddingTop: space['12'],
  },
});
