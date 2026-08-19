/**
 * Screen 7 · Info-Sheet (Blatt `2d`).
 *
 * Bottom-Sheet ueber dem Viewer, Hoehe etwa 75 %. Die Reihenfolge folgt der
 * Haeufigkeit: Titel, Ordner, Notiz, die drei Schalter ("Gelesen",
 * "Archiviert", "Offline behalten"), zuletzt die Metadaten — abgelesen wird
 * selten, sortiert oft.
 *
 * Die beiden Status-Schalter sind der **gestenfreie Weg** im Viewer: dieselbe
 * Wirkung wie die Wischgeste in der Liste, nur ohne Geste.
 *
 * "In den Papierkorb" steht **ausserhalb** des scrollenden Bereichs hinter
 * einer eigenen Trennlinie: es darf nie unter den Daumen rutschen, waehrend
 * jemand etwas einstellt.
 *
 * Titel und Notiz haben einen **eigenen Zustand im Sheet**. Nach draussen
 * gemeldet wird gedrosselt (fruehestens alle 600 ms) und in jedem Fall beim
 * Verlassen des Feldes sowie beim Schliessen. Vorher ging jeder einzelne
 * Buchstabe in die Datenbank und setzte `updatedAt` — der Titel wanderte beim
 * Tippen live in "Zuletzt geaendert" nach oben.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { formatBytes, formatDate, formatRelative } from '../../data/format';
import { sourceLabels, type StoredDocument } from '../../data/library';
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
import { Text } from '../../ui/Text';

/**
 * Wie lange ein Tastendruck hoechstens auf seinen Weg nach draussen wartet.
 * 600 ms sind laenger als eine Tastenfolge und kuerzer als eine Denkpause —
 * wer weitertippt, loest keinen zweiten Schreibvorgang aus, wer aufhoert,
 * merkt die Verzoegerung nicht.
 */
const REPORT_DELAY = 600;

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
  note: string;
  /** Workflow-Status; beide Achsen sind unabhaengig voneinander schaltbar. */
  read: boolean;
  archived: boolean;
  keepOffline: boolean;
  openCount: number;
  /**
   * Zeitpunkt des Besuchs **davor** — `null`, wenn es keinen gab. Der Viewer
   * zaehlt beim Oeffnen hoch, bevor dieses Sheet aufgeht; er reicht deshalb
   * den gemerkten Wert herein, sonst staende hier immer "gerade eben".
   */
  lastOpenedAt: number | null;
  height: number;
  onClose: () => void;
  onChangeTitle: (title: string) => void;
  onChangeNote: (note: string) => void;
  onChangeKeepOffline: (keep: boolean) => void;
  onOpenFolder: () => void;
  onChangeRead: (read: boolean) => void;
  onChangeArchived: (archived: boolean) => void;
  onTrash: () => void;
}

export function InfoSheet({
  visible,
  document,
  title,
  folderName,
  folderColor,
  note,
  read,
  archived,
  keepOffline,
  openCount,
  lastOpenedAt,
  height,
  onClose,
  onChangeTitle,
  onChangeNote,
  onChangeKeepOffline,
  onOpenFolder,
  onChangeRead,
  onChangeArchived,
  onTrash,
}: InfoSheetProps) {
  // Die Herkunft steht seit Schritt 7 in der Zeile — bis dahin stand hier
  // "Datei-Import" fuer alles, was es noch gar nicht geben konnte.
  const source = sourceLabels[document.source];

  /*
    Der Entwurf im Sheet: er fuehrt das Feld, nicht der Bestand. Beim Wechsel
    auf ein anderes Dokument wird er zurueckgesetzt — offene Aenderungen des
    vorherigen sind zu diesem Zeitpunkt schon gemeldet (`flush` beim
    Schliessen).
  */
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftNote, setDraftNote] = useState(note);

  const pending = useRef<{ title?: string; note?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const waiting = pending.current;
    pending.current = {};
    if (waiting.title !== undefined) onChangeTitle(waiting.title);
    if (waiting.note !== undefined) onChangeNote(waiting.note);
  }, [onChangeNote, onChangeTitle]);

  /** Beim Aushaengen darf nichts liegenbleiben — auch ohne "Schliessen". */
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), []);

  const schedule = () => {
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, REPORT_DELAY);
  };

  const changeTitle = (next: string) => {
    setDraftTitle(next);
    pending.current.title = next;
    schedule();
  };

  const changeNote = (next: string) => {
    setDraftNote(next);
    pending.current.note = next;
    schedule();
  };

  /*
    Der Bestand nur als Rueckfallebene: beim Wechsel des Dokuments fuellt er
    die Felder neu. Als Ref, damit ein Schreibvorgang waehrend des Tippens den
    Entwurf nicht ueberschreibt — der Zustand kommt dabei ja zurueck.
  */
  const stored = useRef({ title, note });
  stored.current = { title, note };

  const documentId = document.id;
  useEffect(() => {
    pending.current = {};
    setDraftTitle(stored.current.title);
    setDraftNote(stored.current.note);
  }, [documentId]);

  return (
    <SheetLayer
      visible={visible}
      height={height}
      title="Dokument"
      onClose={() => {
        flush();
        onClose();
      }}
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
              value={draftTitle}
              onChangeText={changeTitle}
              onBlur={flush}
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

        <Field label="Notiz">
          <View style={[styles.box, styles.noteBox]}>
            <TextInput
              style={[typeScale.body, styles.input, styles.noteInput]}
              value={draftNote}
              onChangeText={changeNote}
              onBlur={flush}
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
            <Text variant="body">Gelesen</Text>
          </View>
          <Switch
            value={read}
            onValueChange={onChangeRead}
            accessibilityLabel="Als gelesen markiert"
          />
        </View>

        <View style={styles.offlineRow}>
          <View style={styles.offlineLabel}>
            <Text variant="body">Archiviert</Text>
          </View>
          <Switch
            value={archived}
            onValueChange={onChangeArchived}
            accessibilityLabel="Archiviert"
          />
        </View>

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
          <MetaRow
            label="Zuletzt geöffnet"
            value={lastOpenedAt === null ? 'noch nie' : formatRelative(lastOpenedAt)}
          />
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
