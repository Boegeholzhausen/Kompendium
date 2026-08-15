/**
 * 06 · Suchfeld.
 *
 * Hoehe 48, `radius md`, `bg/raised`.
 *   Ruhe   1 px `border/subtle`, Lupe 20 in `text/tertiary`, Platzhalter
 *          "Titel, Inhalt, Tag"
 *   Fokus  2 px `accent/border`, Lupe in `text/secondary`, `x-circle` rechts.
 *          Der Innenabstand sinkt um 1, damit beim Fokussieren nichts springt.
 *
 * In der Bibliothek ist das Feld nur eine Schaltflaeche: Tippen navigiert auf
 * den Suchscreen, es gibt keinen Inline-Fokus (`interactive={false}`).
 */
import React, { useState } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, border, iconSize, radius, size, space, text as textColor } from '../theme';
import { typeScale } from '../theme/typography';
import { MagnifyingGlass, XCircle } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface SearchFieldProps {
  value?: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  /** false = reine Schaltflaeche, die auf den Suchscreen fuehrt. */
  interactive?: boolean;
  autoFocus?: boolean;
  onPress?: () => void;
  onSubmit?: () => void;
  onClear?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SearchField({
  value = '',
  onChangeText,
  placeholder = 'Titel, Inhalt, Tag',
  interactive = true,
  autoFocus = false,
  onPress,
  onSubmit,
  onClear,
  style,
}: SearchFieldProps) {
  const [focused, setFocused] = useState(false);
  const hasValue = interactive && value.length > 0;
  // Der 2-px-Mint-Rahmen gehoert allein zum Fokus. Ein gefuelltes, aber nicht
  // fokussiertes Feld (Suchergebnisse) traegt den ruhenden Rahmen und nur das
  // Loeschen-Symbol.
  const focusedNow = interactive && focused;

  const frame = [styles.field, focusedNow ? styles.fieldFocused : styles.fieldIdle, style];
  const glass = (
    <MagnifyingGlass
      size={iconSize.md}
      color={focusedNow || hasValue ? textColor.secondary : textColor.tertiary}
      weight="regular"
    />
  );

  if (!interactive) {
    return (
      <PressableScale
        style={frame}
        pressedStyle={styles.fieldPressed}
        scaleOnPress={false}
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel={`Suchen. ${placeholder}`}
      >
        {glass}
        <Text variant="body" tone="tertiary">
          {placeholder}
        </Text>
      </PressableScale>
    );
  }

  return (
    <View style={frame}>
      {glass}
      <TextInput
        style={[typeScale.body, styles.input]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={textColor.tertiary}
        selectionColor={accent.base}
        cursorColor={accent.base}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxFontSizeMultiplier={1.3}
        accessibilityLabel="Suchbegriff"
        underlineColorAndroid="transparent"
      />
      {hasValue ? (
        <PressableScale
          onPress={onClear}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel="Eingabe loeschen"
        >
          <XCircle size={iconSize.md} color={textColor.secondary} weight="regular" />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'] + space['2'],
    height: size.searchFieldHeight,
    borderRadius: radius.md,
    backgroundColor: bg.raised,
  },
  fieldIdle: {
    borderWidth: 1,
    borderColor: border.subtle,
    paddingHorizontal: size.screenPadding - 2,
  },
  fieldFocused: {
    // 2 px Rahmen, Innenabstand um 1 kleiner — die Gesamtbreite bleibt gleich.
    borderWidth: 2,
    borderColor: accent.border,
    paddingHorizontal: size.screenPadding - 3,
  },
  fieldPressed: {
    backgroundColor: bg.overlay,
    borderColor: border.strong,
  },
  input: {
    flex: 1,
    height: '100%',
    // Ohne `minWidth: 0` draengt das Eingabefeld im Web-Export die Lupe auf
    // Breite null: ein `input` bringt dort eine eigene Mindestbreite mit und
    // schrumpft lieber die Nachbarn als sich selbst. Auf dem Geraet ist der
    // Wert wirkungslos.
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
});
