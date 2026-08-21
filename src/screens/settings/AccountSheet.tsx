/**
 * Konto — E-Mail verknuepfen oder sich damit anmelden.
 *
 * Zwei Wege durch dasselbe Sheet, weil sie sich nur in einem Aufruf
 * unterscheiden:
 *
 *   `link`    Erstgeraet. Haengt die Adresse an die VORHANDENE anonyme
 *             Identitaet (`linkEmail` → `confirmEmail`). Die Kennung bleibt
 *             dieselbe, sonst waeren alle Zeilen oben verwaist.
 *   `signin`  Zweitgeraet. Meldet sich mit derselben Adresse an
 *             (`signInWithEmail` → `confirmSignIn`).
 *
 * Beide laufen ueber einen sechsstelligen Code aus der Mail und nicht ueber
 * einen Magic Link: der braeuchte einen Deep-Link-Rueckweg, den Expo Go nicht
 * verlaesslich bedient (Begruendung ausfuehrlich in `data/supabase.ts`).
 *
 * Aufbau wie `ui/RenameSheet`: Beschriftung, ein fokussiertes Feld, eine
 * Hinweiszeile, Fuss aus zwei Knoepfen. Ein zweites Eingabe-Sheet zu erfinden
 * waere eine zweite Formsprache fuer dieselbe Sache.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  cancelSignIn,
  confirmEmail,
  confirmSignIn,
  linkEmail,
  signInWithEmail,
  type Identity,
} from '../../data/supabase';
import { accent, bg, radius, semantic, size, space, text as textColor } from '../../theme';
import { typeScale } from '../../theme/typography';
import { BottomSheet } from '../../ui/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../../ui/Button';
import { Info } from '../../ui/icons';
import { Text } from '../../ui/Text';

export type AccountMode = 'link' | 'signin';

export interface AccountSheetProps {
  visible: boolean;
  mode: AccountMode;
  onClose: () => void;
  /** Geschafft — der Aufrufer laedt die Identitaet neu und meldet es. */
  onDone: (identity: Identity) => void;
}

/** Sieht das ueberhaupt nach einer Adresse aus? Mehr prueft der Server. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AccountSheet({ visible, mode, onClose, onDone }: AccountSheetProps) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [hint, setHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Jedes Oeffnen faengt vorn an: ein halb ausgefuellter Vorgang von vorhin
  // waere ein Zustand, den niemand mehr einordnen kann.
  useEffect(() => {
    if (!visible) return;
    setStep('email');
    setEmail('');
    setCode('');
    setHint('');
    setError(null);
    setBusy(false);
  }, [visible]);

  const title = mode === 'link' ? 'Gerät verknüpfen' : 'Mit E-Mail anmelden';

  const close = () => {
    // Einen abgebrochenen Anmeldevorgang wieder freigeben, sonst legte
    // `ensureSession` bis zum naechsten Start keine Identitaet mehr an.
    cancelSignIn();
    onClose();
  };

  const sendCode = async () => {
    if (busy || !looksLikeEmail(email)) return;
    setBusy(true);
    setError(null);
    try {
      const message = mode === 'link' ? await linkEmail(email) : await signInWithEmail(email);
      setHint(message);
      setStep('code');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (busy || code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const identity =
        mode === 'link' ? await confirmEmail(email, code) : await confirmSignIn(email, code);
      onDone(identity);
      onClose();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title={title} onClose={close}>
      {step === 'email' ? (
        <>
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
              onSubmitEditing={() => void sendCode()}
              maxFontSizeMultiplier={1.3}
              accessibilityLabel="E-Mail-Adresse"
              underlineColorAndroid="transparent"
            />
          </View>

          <Hint
            text={
              mode === 'link'
                ? 'Die Adresse wird an diese Installation gehängt. Deine Dokumente bleiben, wo sie sind.'
                : 'Dieselbe Adresse wie auf dem ersten Gerät.'
            }
          />

          {error !== null ? <ErrorLine message={error} /> : null}

          <View style={styles.footer}>
            <SecondaryButton label="Abbrechen" onPress={close} style={styles.cancel} />
            <PrimaryButton
              label={busy ? 'Wird gesendet …' : 'Code anfordern'}
              disabled={busy || !looksLikeEmail(email)}
              onPress={() => void sendCode()}
              style={styles.submit}
            />
          </View>
        </>
      ) : (
        <>
          <Text variant="overline" tone="tertiary" style={styles.label}>
            Code aus der Mail
          </Text>
          <View style={styles.field}>
            <TextInput
              style={[typeScale.body, styles.input]}
              value={code}
              onChangeText={setCode}
              selectionColor={accent.base}
              cursorColor={accent.base}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="number-pad"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={() => void submitCode()}
              maxFontSizeMultiplier={1.3}
              accessibilityLabel="Code aus der Mail"
              underlineColorAndroid="transparent"
            />
          </View>

          <Hint text={`${hint} (${email.trim()})`} />

          {error !== null ? <ErrorLine message={error} /> : null}

          <View style={styles.footer}>
            <SecondaryButton label="Zurück" onPress={() => setStep('email')} style={styles.cancel} />
            <PrimaryButton
              label={busy ? 'Wird geprüft …' : 'Bestätigen'}
              disabled={busy || code.trim().length < 6}
              onPress={() => void submitCode()}
              style={styles.submit}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <View style={styles.hint}>
      <Info size={14} color={textColor.secondary} weight="regular" />
      <Text variant="caption" tone="secondary" style={styles.hintText}>
        {text}
      </Text>
    </View>
  );
}

/**
 * Der Grund steht als Satz, nicht als Code. Farbe traegt die Bedeutung nicht
 * allein — der Text sagt bereits, was schiefging.
 */
function ErrorLine({ message }: { message: string }) {
  return (
    <Text variant="caption" style={styles.error}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: space['8'],
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
