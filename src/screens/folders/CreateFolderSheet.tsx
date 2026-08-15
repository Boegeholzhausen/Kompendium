/**
 * Screen 17 · Sheet "Ordner anlegen" (Blatt `6c`).
 *
 * Aufbau: Titelzeile, **Name** als fokussiertes Feld, **Farbe** als sechs
 * Kacheln 48 x 48, Schalter "Inhalt offline behalten" zwischen zwei Linien,
 * primaerer Button "Anlegen", darunter "Abbrechen" als sekundaerer Textbutton.
 *
 * Sechs Farben statt acht: mehr Auswahl macht Ordner nicht unterscheidbarer,
 * und in dieser Zahl bleiben die Kacheln 48 dp breit. Die gewaehlte Kachel ist
 * doppelt markiert — 12-%-Flaeche UND 2-px-Rand in 50 % der Farbe, nie durch
 * Farbe allein.
 *
 * Der Inhalt scrollt, weil im Betrieb die Tastatur ueber den Fuss schiebt:
 * "Anlegen" soll das letzte Element im Sheet sein, das mitscrollt, nicht ein
 * angehefteter Balken unter der Tastatur.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useDocumentStore } from '../../state/documents';
import { folderColorChoices, useFolderStore } from '../../state/folders';
import {
  accent,
  bg,
  border,
  radius,
  size,
  space,
  text as textColor,
  withAlpha,
} from '../../theme';
import { typeScale } from '../../theme/typography';
import { BottomSheet } from '../../ui/BottomSheet';
import { PrimaryButton } from '../../ui/Button';
import { Folder } from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { Switch } from '../../ui/Switch';
import { Text } from '../../ui/Text';

export interface CreateFolderSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Dokumente, die gleich in den neuen Ordner wandern (aus der Mehrfachauswahl). */
  moveIds?: string[];
  onCreated?: (name: string) => void;
}

export function CreateFolderSheet({
  visible,
  onClose,
  moveIds,
  onCreated,
}: CreateFolderSheetProps) {
  const createFolder = useFolderStore((state) => state.createFolder);
  const setFolder = useDocumentStore((state) => state.setFolder);

  const [name, setName] = useState('');
  const [color, setColor] = useState(folderColorChoices[0].value);
  const [keepOffline, setKeepOffline] = useState(false);

  // Jedes Oeffnen faengt leer an — ein halb ausgefuelltes Sheet von vorhin
  // waere ein Angebot, das niemand gemacht hat.
  useEffect(() => {
    if (visible) {
      setName('');
      setColor(folderColorChoices[0].value);
      setKeepOffline(false);
    }
  }, [visible]);

  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    const folder = createFolder(trimmed, color, keepOffline);
    if (moveIds && moveIds.length > 0) setFolder(moveIds, folder.name);
    onCreated?.(folder.name);
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="Ordner anlegen" onClose={onClose}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="overline" tone="tertiary">
          Name
        </Text>
        <View style={styles.field}>
          <TextInput
            style={[typeScale.body, styles.input]}
            value={name}
            onChangeText={setName}
            placeholder="Ordnername"
            placeholderTextColor={textColor.tertiary}
            selectionColor={accent.base}
            cursorColor={accent.base}
            autoFocus={visible}
            returnKeyType="done"
            onSubmitEditing={submit}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Name des Ordners"
            underlineColorAndroid="transparent"
          />
        </View>

        <Text variant="overline" tone="tertiary" style={styles.colorLabel}>
          Farbe
        </Text>
        <View style={styles.colors}>
          {folderColorChoices.map((choice) => {
            const selected = choice.value === color;
            return (
              <PressableScale
                key={choice.key}
                style={[
                  styles.colorTile,
                  selected
                    ? {
                        backgroundColor: withAlpha(choice.value, 0.12),
                        borderColor: withAlpha(choice.value, 0.5),
                        borderWidth: 2,
                      }
                    : styles.colorTileIdle,
                ]}
                onPress={() => setColor(choice.value)}
                accessibilityRole="radio"
                accessibilityLabel={`Ordnerfarbe ${choice.key}`}
                accessibilityState={{ selected }}
              >
                <Folder size={22} color={choice.value} weight="fill" />
              </PressableScale>
            );
          })}
        </View>

        <View style={styles.offlineRow}>
          <View style={styles.offlineLabel}>
            <Text variant="body">Inhalt offline behalten</Text>
            <Text variant="caption" tone="secondary">
              Gilt für alles in diesem Ordner
            </Text>
          </View>
          <Switch
            value={keepOffline}
            onValueChange={setKeepOffline}
            accessibilityLabel="Inhalt dieses Ordners offline behalten"
          />
        </View>

        <PrimaryButton
          label="Anlegen"
          disabled={trimmed.length === 0}
          onPress={submit}
          style={styles.submit}
        />
        {/*
          "Abbrechen" traegt keine Flaeche und keinen Rahmen: es ist der
          Rueckweg, nicht die zweite Haelfte einer Entscheidung. Hoehe 56 aus
          Blatt `6c`, Text in `text/secondary`.
        */}
        <PressableScale
          style={styles.cancel}
          scaleOnPress={false}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Abbrechen"
        >
          <Text variant="button" tone="secondary">
            Abbrechen
          </Text>
        </PressableScale>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    // Deckelt das Sheet bei etwa zwei Dritteln des Bildes; darueber waere es
    // ein Screen und kein Sheet mehr.
    maxHeight: size.touchTarget * 11,
  },
  content: {
    paddingBottom: space['8'],
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: size.searchFieldHeight,
    marginTop: space['8'],
    borderRadius: radius.md,
    backgroundColor: bg.raised,
    // 2 px Rahmen wie im Blatt: das Feld ist beim Oeffnen fokussiert.
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
  colorLabel: {
    marginTop: space['20'],
  },
  colors: {
    flexDirection: 'row',
    gap: space['8'],
    marginTop: space['8'] + space['2'],
  },
  colorTile: {
    flex: 1,
    // Bei 393 dp sind sechs Kacheln mit gap 8 genau 48 breit; auf 360 dp
    // schrumpfen sie mit, das Beruehrungsziel bleibt ueber die Hoehe erhalten.
    aspectRatio: 1,
    maxWidth: size.touchTarget,
    height: size.touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  colorTileIdle: {
    backgroundColor: bg.raised,
    borderColor: border.subtle,
    // Der Rahmen bleibt 2 breit und wird nur schmaler gezeichnet, damit die
    // Kachel beim Auswaehlen nicht um 2 waechst.
    borderWidth: 2,
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: size.rowHeight - space['4'],
    marginTop: space['20'],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: border.strong,
  },
  offlineLabel: {
    flex: 1,
  },
  submit: {
    marginTop: size.screenPadding,
  },
  cancel: {
    height: size.toastHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
