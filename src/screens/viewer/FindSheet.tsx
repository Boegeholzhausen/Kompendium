/**
 * "Im Dokument suchen" (D2) — das Sheet dazu.
 *
 * Kein neues Bauteil, sondern die Form des URL-Sheets aus `ImportSheet`:
 * dieselbe Sheet-Huelle, dasselbe fokussierte Feld mit 2 px Mint-Rahmen. Nur
 * liegt es hier als `SheetLayer` im Screen und nicht als Modal — im Viewer
 * stapeln sich Sheets und Toast, und deren Reihenfolge ist die Reihenfolge im
 * JSX (siehe `ui/BottomSheet`).
 *
 * Das Sheet bleibt waehrend des Blaetterns offen: Zaehlung ("3 / 17") und
 * Weiter/Zurueck stehen darin, nicht in einer eigenen Leiste. Keine Fundstelle
 * meldet es an derselben Stelle ("Nicht im Dokument gefunden") — ein Toast
 * waere hier falsch, weil die Antwort zur Eingabe gehoert, die noch dasteht.
 *
 * `collapsed` ist der Fall aus D3: das Dokument wurde aus einem Suchtreffer
 * heraus geoeffnet und steht deshalb mitten im Text. Dann zeigt das Sheet nur
 * Zaehlung und Weiter/Zurueck — der Begriff ist bekannt, und ein aufgeklapptes
 * Feld mit Tastatur waere im Weg. Wer ihn aendern will, kommt ueber
 * "Suchbegriff ändern" an das Feld.
 */
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { accent, bg, radius, size, space, text as textColor } from '../../theme';
import { typeScale } from '../../theme/typography';
import { SheetLayer } from '../../ui/BottomSheet';
import { TextButton } from '../../ui/Button';
import { CaretDown, CaretUp } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { Text } from '../../ui/Text';

export interface FindSheetProps {
  visible: boolean;
  /** Nur Zaehlung und Weiter/Zurueck — der Sprung aus einem Suchtreffer (D3). */
  collapsed: boolean;
  term: string;
  onChangeTerm: (term: string) => void;
  /** Absenden des Feldes: von vorn suchen. */
  onSubmit: () => void;
  /** Wurde mit dem aktuellen Begriff schon gesucht? Erst dann ist "nichts gefunden" eine Aussage. */
  searched: boolean;
  total: number;
  /** 1-basiert; 0 heisst "keine Fundstelle". */
  index: number;
  onNext: () => void;
  onPrevious: () => void;
  /** Aus der eingeklappten Form zurueck ins Feld. */
  onExpand: () => void;
  onClose: () => void;
}

export function FindSheet({
  visible,
  collapsed,
  term,
  onChangeTerm,
  onSubmit,
  searched,
  total,
  index,
  onNext,
  onPrevious,
  onExpand,
  onClose,
}: FindSheetProps) {
  const nothingFound = searched && total === 0;

  return (
    <SheetLayer visible={visible} title="Im Dokument suchen" onClose={onClose}>
      {collapsed ? null : (
        <View style={styles.field}>
          <TextInput
            style={[typeScale.body, styles.input]}
            value={term}
            onChangeText={onChangeTerm}
            placeholder="Wort oder Wortgruppe"
            placeholderTextColor={textColor.tertiary}
            selectionColor={accent.base}
            cursorColor={accent.base}
            autoFocus={visible && !collapsed}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={onSubmit}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Suchbegriff im Dokument"
            underlineColorAndroid="transparent"
          />
        </View>
      )}

      <View style={styles.status}>
        {nothingFound ? (
          <Text variant="body" tone="secondary" style={styles.count}>
            Nicht im Dokument gefunden
          </Text>
        ) : (
          <Text variant="body" tone="secondary" numeric style={styles.count}>
            {total === 0 ? '' : `${index} / ${total}`}
          </Text>
        )}

        <IconButton
          icon={CaretUp}
          accessibilityLabel="Vorherige Fundstelle"
          disabled={total === 0}
          onPress={onPrevious}
        />
        <IconButton
          icon={CaretDown}
          accessibilityLabel="Nächste Fundstelle"
          disabled={total === 0}
          onPress={onNext}
        />
      </View>

      {collapsed ? (
        <TextButton
          label="Suchbegriff ändern"
          compact
          onPress={onExpand}
          style={styles.expand}
        />
      ) : (
        <Text variant="label" tone="tertiary" style={styles.hint}>
          Hervorgehoben wird die Fundstelle, die das Dokument selbst zeichnet.
        </Text>
      )}
    </SheetLayer>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: size.searchFieldHeight,
    borderRadius: radius.md,
    backgroundColor: bg.raised,
    // 2 px Rahmen wie im URL-Sheet: das Feld ist beim Oeffnen fokussiert.
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
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: size.touchGap,
    marginTop: space['12'],
  },
  count: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    marginTop: space['12'],
    marginBottom: space['8'],
  },
  expand: {
    alignSelf: 'flex-start',
    marginTop: space['4'],
    marginBottom: space['8'],
  },
});
