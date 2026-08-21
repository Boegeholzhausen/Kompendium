/**
 * Anmelden — das einzige Formular der App.
 *
 * Es sitzt in den Einstellungen und nicht als Schirm vor der App: die lokale
 * Datenbank ist die Wahrheitsquelle, jeder Screen rendert offline vollstaendig
 * (Begruendung ausfuehrlich in `data/supabase.ts`). Ein Anmeldeschirm davor
 * machte die Bibliothek ohne Netz unbenutzbar — fuer einen Vorgang, den man
 * pro Installation genau einmal braucht.
 *
 * Aufbau wie `ui/RenameSheet`: Beschriftung, fokussiertes Feld, Hinweiszeile,
 * Fuss aus zwei Knoepfen. Ein zweites Eingabe-Sheet zu erfinden waere eine
 * zweite Formsprache fuer dieselbe Sache.
 *
 * Das Passwort wird nirgends gemerkt — weder hier noch in der Datenbank noch
 * in der `.env`. Was liegen bleibt, ist die Session in AsyncStorage, und die
 * traegt nur ein Token.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useSessionStore } from '../../state/session';
import { accent, bg, radius, semantic, size, space, text as textColor } from '../../theme';
import { typeScale } from '../../theme/typography';
import { BottomSheet } from '../../ui/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../../ui/Button';
import { Info } from '../../ui/icons';
import { Text } from '../../ui/Text';

export interface LoginSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Geschafft — der Aufrufer meldet es und stoesst den Abgleich an. */
  onDone: (email: string | null) => void;
}

/** Sieht das ueberhaupt nach einer Adresse aus? Mehr prueft der Server. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginSheet({ visible, onClose, onDone }: LoginSheetProps) {
  const logIn = useSessionStore((state) => state.logIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Jedes Oeffnen faengt leer an. Ein Passwort, das vom letzten Versuch noch
  // im Feld steht, waere ein Wert, den niemand mehr einordnen kann.
  useEffect(() => {
    if (!visible) return;
    setEmail('');
    setPassword('');
    setError(null);
    setBusy(false);
  }, [visible]);

  const ready = looksLikeEmail(email) && password.length > 0;

  const submit = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await logIn(email, password);
      onDone(email.trim());
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title="Anmelden" onClose={onClose}>
      <Text variant="overline" tone="tertiary" style={styles.label}>
        E-Mail-Adresse
      </Text>
      <View style={styles.field}>
        <TextInput
          style={[typeScale.body, styles.input]}
          value={email}
          onChangeText={setEmail}
          selectionColor={accent.base}
          cursorColor={accent.base}
          autoFocus={visible}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="E-Mail-Adresse"
          underlineColorAndroid="transparent"
        />
      </View>

      <Text variant="overline" tone="tertiary" style={styles.label}>
        Passwort
      </Text>
      <View style={styles.field}>
        <TextInput
          style={[typeScale.body, styles.input]}
          value={password}
          onChangeText={setPassword}
          selectionColor={accent.base}
          cursorColor={accent.base}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
          maxFontSizeMultiplier={1.3}
          accessibilityLabel="Passwort"
          underlineColorAndroid="transparent"
        />
      </View>

      <View style={styles.hint}>
        <Info size={14} color={textColor.secondary} weight="regular" />
        <Text variant="caption" tone="secondary" style={styles.hintText}>
          Nur einmal pro Gerät. Danach bleibt die Anmeldung bestehen.
        </Text>
      </View>

      {error !== null ? (
        // Der Grund steht als Satz, nicht als Code. Farbe traegt die Bedeutung
        // nicht allein — der Text sagt bereits, was schiefging.
        <Text variant="caption" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <View style={styles.footer}>
        <SecondaryButton label="Abbrechen" onPress={onClose} style={styles.cancel} />
        <PrimaryButton
          label={busy ? 'Wird geprüft …' : 'Anmelden'}
          disabled={busy || !ready}
          onPress={() => void submit()}
          style={styles.submit}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: space['8'] + space['2'],
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
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    marginTop: space['8'] + space['2'],
  },
  hintText: {
    flex: 1,
  },
  error: {
    marginTop: space['8'],
    color: semantic.danger,
  },
  footer: {
    flexDirection: 'row',
    gap: space['8'],
    marginTop: size.screenPadding,
  },
  cancel: {
    // Dieselbe feste Breite wie in `ui/RenameSheet`: die abbrechende Seite
    // soll nicht so schwer wirken wie die bestaetigende.
    width: 120,
  },
  submit: {
    flex: 1,
  },
});
