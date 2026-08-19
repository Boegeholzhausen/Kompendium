/**
 * Screen 18 · Sheet "Umbenennen" (Blatt `6d`).
 *
 * Es steht hier in `ui/` und nicht bei den Ordnern, weil das Handoff-Dokument es
 * ausdruecklich doppelt verwendet: "identisch fuer „Ordner bearbeiten"". Ein
 * zweites, fast gleiches Sheet waere die schlechtere Loesung.
 *
 * Aufbau: Titelzeile, unveraenderliche Kontextzeile (Farbpunkt, alter Name,
 * "12 Dokumente"), "Neuer Name" als fokussiertes Feld mit `x-circle`,
 * Hinweiszeile mit `info` 14, Fuss aus "Abbrechen" (120 breit, sekundaer)
 * **neben** "Speichern" (Rest, primaer).
 *
 * Warum die Kontextzeile: umbenannt wird hier aus einer Liste heraus, oft nach
 * einer Wischgeste. Ohne sie bliebe offen, welche Zeile gemeint ist — und die
 * Zahl sagt zugleich, wie viele Dokumente die Aenderung trifft.
 *
 * Warum Abbrechen daneben und nicht darunter: bei aufgeschlagener Tastatur ist
 * Hoehe knapp, und das Sheet soll vollstaendig sichtbar bleiben.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { accent, bg, border, iconSize, radius, size, space, text as textColor } from '../theme';
import { typeScale } from '../theme/typography';
import { BottomSheet } from './BottomSheet';
import { PrimaryButton, SecondaryButton } from './Button';
import { Info, XCircle } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface RenameSheetProps {
  visible: boolean;
  /** Etwa "Ordner umbenennen". */
  title: string;
  /** Bisheriger Name — steht in der Kontextzeile und als Ausgangswert im Feld. */
  currentName: string;
  /** Farbpunkt der Kontextzeile: die Ordnerfarbe. */
  color: string;
  /** Zahl der betroffenen Dokumente. */
  count: number;
  /** Ganzer Satz der Hinweiszeile, etwa "Wirkt auf alle 12 Dokumente im Ordner". */
  hint: string;
  onSubmit: (name: string) => void;
  onClose: () => void;
}

export function RenameSheet({
  visible,
  title,
  currentName,
  color,
  count,
  hint,
  onSubmit,
  onClose,
}: RenameSheetProps) {
  const [value, setValue] = useState(currentName);

  useEffect(() => {
    if (visible) setValue(currentName);
  }, [visible, currentName]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentName;

  const submit = () => {
    if (!canSave) return;
    onSubmit(trimmed);
    onClose();
  };

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <View style={styles.context}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text variant="label" tone="secondary" numberOfLines={1} style={styles.contextName}>
          {currentName}
        </Text>
        <Text variant="caption" tone="secondary" numeric>
          {count === 1 ? '1 Dokument' : `${count} Dokumente`}
        </Text>
      </View>

      <Text variant="overline" tone="tertiary" style={styles.label}>
        Neuer Name
      </Text>
      <View style={styles.field}>
        <TextInput
          style={[typeScale.body, styles.input]}
          value={value}
          onChangeText={setValue}
          selectionColor={accent.base}
          cursorColor={accent.base}
          autoFocus={visible}
          returnKeyType="done"
          onSubmitEditing={submit}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="Neuer Name"
          underlineColorAndroid="transparent"
        />
        {value.length > 0 ? (
          <PressableScale
            style={styles.clear}
            onPress={() => setValue('')}
            accessibilityRole="button"
            accessibilityLabel="Eingabe loeschen"
          >
            <XCircle size={iconSize.md} color={textColor.secondary} weight="regular" />
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.hint}>
        <Info size={14} color={textColor.secondary} weight="regular" />
        <Text variant="caption" tone="secondary" numeric style={styles.hintText}>
          {hint}
        </Text>
      </View>

      <View style={styles.footer}>
        <SecondaryButton label="Abbrechen" onPress={onClose} style={styles.cancel} />
        <PrimaryButton
          label="Speichern"
          disabled={!canSave}
          onPress={submit}
          style={styles.save}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'] + space['2'],
    height: size.buttonHeightCompact,
    paddingHorizontal: size.cardPadding,
    borderRadius: radius.md,
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.strong,
  },
  dot: {
    width: size.tagDotLarge,
    height: size.tagDotLarge,
    borderRadius: radius.pill,
  },
  contextName: {
    flex: 1,
  },
  label: {
    marginTop: size.screenPadding,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: size.searchFieldHeight,
    marginTop: space['8'],
    borderRadius: radius.md,
    backgroundColor: bg.raised,
    borderWidth: 2,
    borderColor: accent.border,
    paddingHorizontal: size.screenPadding - 3,
  },
  input: {
    flex: 1,
    height: '100%',
    // Siehe `ui/SearchField`: ohne diesen Wert draengt das Eingabefeld im
    // Web-Export seine Nachbarn auf Breite null.
    minWidth: 0,
    color: textColor.primary,
    padding: 0,
  },
  clear: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    marginTop: space['8'] + space['2'],
  },
  hintText: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: space['8'],
    marginTop: size.screenPadding,
  },
  cancel: {
    // 120 fest aus Blatt `6d` — "Abbrechen" soll die Breite nicht mit
    // "Speichern" teilen, sonst wirken beide gleich schwer.
    width: 120,
  },
  save: {
    flex: 1,
  },
});
