/**
 * Sheet "Neuer Tag" — hinter der sekundaeren Pille im Kopf der Tag-Verwaltung.
 *
 * Der Prototyp hat dafuer kein eigenes Blatt, weil Tags im Regelfall beim
 * Zuweisen entstehen (Kernflow `4e`). Die Pille in Screen 11 gibt es trotzdem,
 * also braucht sie ein Ziel. Es ist bewusst das kleinstmoegliche: ein Feld und
 * ein Button. Die Farbe waehlt niemand — sie kommt reihum aus der Palette,
 * damit zwei kurz nacheinander angelegte Tags unterscheidbar bleiben.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useDocumentStore } from '../../state/documents';
import { accent, bg, radius, size, space, text as textColor } from '../../theme';
import { typeScale } from '../../theme/typography';
import { BottomSheet } from '../../ui/BottomSheet';
import { PrimaryButton } from '../../ui/Button';
import { Text } from '../../ui/Text';

export interface NewTagSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function NewTagSheet({ visible, onClose }: NewTagSheetProps) {
  const tags = useDocumentStore((state) => state.tags);
  const createTag = useDocumentStore((state) => state.createTag);

  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const trimmed = name.trim();
  const exists = tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());

  const submit = () => {
    if (!trimmed || exists) return;
    createTag(trimmed);
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="Neuer Tag" onClose={onClose}>
      <Text variant="overline" tone="tertiary">
        Name
      </Text>
      <View style={styles.field}>
        <TextInput
          style={[typeScale.body, styles.input]}
          value={name}
          onChangeText={setName}
          placeholder="Tagname"
          placeholderTextColor={textColor.tertiary}
          selectionColor={accent.base}
          cursorColor={accent.base}
          autoFocus={visible}
          returnKeyType="done"
          onSubmitEditing={submit}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="Name des Tags"
          underlineColorAndroid="transparent"
        />
      </View>

      {exists ? (
        <Text variant="caption" tone="secondary" style={styles.note}>
          Diesen Tag gibt es bereits.
        </Text>
      ) : null}

      <PrimaryButton
        label="Anlegen"
        disabled={trimmed.length === 0 || exists}
        onPress={submit}
        style={styles.submit}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
  note: {
    marginTop: space['8'],
  },
  submit: {
    marginTop: size.screenPadding,
    marginBottom: space['8'],
  },
});
