/**
 * Screen 12 · Import-Sheet (Blatt `3g`) — hinter dem FAB der Bibliothek.
 *
 * Drei **gleichwertige** Auswahlflaechen untereinander: Datei waehlen, aus
 * Zwischenablage, von URL laden. Keine ist als Mint-Button ausgezeichnet — sie
 * sind gleichwertige Wege, eine Vorauswahl waere geraten. Mint traegt nur das
 * Icon.
 *
 * Seit Schritt 7 wirken alle drei (`data/importDocument.ts`): das HTML landet
 * im lokalen Dateicache, Titel und Dokumenttyp werden einmal erkannt, die
 * Zeile geht in die Datenbank. Die Fussnote sagt, wo das Dokument danach
 * auftaucht.
 *
 * **Abweichung:** "Von URL laden" braucht ein Eingabefeld, das kein Blatt
 * zeigt — der Prototyp endet bei der Auswahlflaeche. Gebaut ist es deshalb
 * ausschliesslich aus vorhandenen Teilen: Sheet-Huelle, fokussiertes Feld und
 * der Fuss aus Blatt `6d` ("Abbrechen" schmal neben der primaeren Aktion). Das
 * zweite Sheet legt sich ueber das erste, statt es zu ersetzen — der Rueckweg
 * fuehrt in die Auswahl der drei Wege, nicht in die Bibliothek.
 *
 * **Abweichung:** dieselbe Datei zweimal zu importieren ergab bisher zwei
 * Eintraege, ohne jeden Hinweis. Erkennt `documentFrom` ein Dokument mit
 * gleichem Titel und gleicher Byte-Zahl, fragt das Sheet nach — im
 * Kontextmenue-Muster wie "Papierkorb leeren", mit dem Titel des vorhandenen
 * Dokuments als Hinweiszeile. "Abbrechen" schliesst ohne Meldung und wirft die
 * schon geschriebene Datei wieder weg (`discardImport`).
 *
 * Waehrend ein Weg laeuft, sind alle drei deaktiviert (Farbwechsel auf
 * `text/tertiary`, nie Deckkraft) — ein zweiter Tipp waehrend des Ladens
 * legte sonst zwei Dokumente an.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  discardImport,
  importFromClipboard,
  importFromFile,
  importFromUrl,
  type ImportOutcome,
} from '../../data/importDocument';
import type { StoredDocument } from '../../data/library';
import { useDocumentStore } from '../../state/documents';
import {
  accent,
  bg,
  border,
  iconSize,
  radius,
  size,
  space,
  text as textColor,
} from '../../theme';
import { typeScale } from '../../theme/typography';
import { BottomSheet } from '../../ui/BottomSheet';
import { PrimaryButton, SecondaryButton } from '../../ui/Button';
import { ContextMenu, type ContextMenuItem } from '../../ui/ContextMenu';
import {
  CaretRight,
  ClipboardText,
  FileHtml,
  LinkSimple,
  WarningCircle,
  type Icon,
} from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { Text } from '../../ui/Text';

interface ImportWay {
  key: 'file' | 'clipboard' | 'url';
  icon: Icon;
  title: string;
  note: string;
}

const ways: ImportWay[] = [
  { key: 'file', icon: FileHtml, title: 'Datei wählen', note: 'HTML-Datei vom Gerät' },
  { key: 'clipboard', icon: ClipboardText, title: 'Aus Zwischenablage', note: 'HTML-Code einfügen' },
  { key: 'url', icon: LinkSimple, title: 'Von URL laden', note: 'Adresse eingeben' },
];

export interface ImportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Das fertige Dokument — der Screen zeigt den Toast. */
  onImported?: (document: StoredDocument) => void;
  /** Grund des Scheiterns in einem Satz; ein Abbruch meldet gar nichts. */
  onFailed?: (reason: string) => void;
}

export function ImportSheet({ visible, onClose, onImported, onFailed }: ImportSheetProps) {
  const addDocument = useDocumentStore((state) => state.addDocument);
  /** Grundlage der Duplikat-Pruefung — der Bestand, wie er gerade ist. */
  const documents = useDocumentStore((state) => state.documents);

  const [busy, setBusy] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [address, setAddress] = useState('');
  /** Fertiger Import, der noch auf die Antwort der Rueckfrage wartet. */
  const [duplicate, setDuplicate] = useState<{
    document: StoredDocument;
    existing: StoredDocument;
  } | null>(null);

  useEffect(() => {
    if (!visible) {
      setUrlOpen(false);
      setAddress('');
      setBusy(false);
      setDuplicate(null);
    }
  }, [visible]);

  const accept = (document: StoredDocument) => {
    setDuplicate(null);
    addDocument(document);
    onImported?.(document);
    onClose();
  };

  const finish = (outcome: ImportOutcome) => {
    setBusy(false);
    if (outcome.ok) {
      if (outcome.duplicateOf !== undefined) {
        setDuplicate({ document: outcome.document, existing: outcome.duplicateOf });
        return;
      }
      accept(outcome.document);
      return;
    }
    // `reason: null` heisst: der Nutzer hat abgebrochen. Dazu gibt es nichts
    // zu sagen, und ein Toast waere ein Vorwurf.
    if (outcome.reason !== null) onFailed?.(outcome.reason);
  };

  const choose = async (key: ImportWay['key']) => {
    if (busy) return;
    if (key === 'url') {
      setUrlOpen(true);
      return;
    }
    setBusy(true);
    finish(
      key === 'file' ? await importFromFile(documents) : await importFromClipboard(documents)
    );
  };

  const loadUrl = async () => {
    if (busy || address.trim().length === 0) return;
    setBusy(true);
    const outcome = await importFromUrl(address, documents);
    setUrlOpen(false);
    finish(outcome);
  };

  /**
   * Die erste Zeile ist der Hinweis, nicht die Aktion: sie nennt den Titel des
   * vorhandenen Dokuments und ist deshalb `disabled`. Darunter der eine Weg
   * weiter — "Abbrechen" ist der Rueckweg des Menues selbst.
   */
  const duplicateItems: ContextMenuItem[] = [
    {
      key: 'existing',
      label: `Schon vorhanden: „${duplicate?.existing.title ?? ''}“`,
      icon: WarningCircle,
      disabled: true,
    },
    {
      key: 'anyway',
      label: 'Trotzdem importieren',
      icon: FileHtml,
      onPress: () => {
        if (duplicate !== null) accept(duplicate.document);
      },
    },
  ];

  /** Abbrechen: die Datei ist schon geschrieben, sie muss wieder weg. */
  const dismissDuplicate = () => {
    const waiting = duplicate;
    setDuplicate(null);
    if (waiting !== null) void discardImport(waiting.document);
    onClose();
  };

  return (
    <>
      <BottomSheet
        visible={visible && !urlOpen && duplicate === null}
        title="Dokument hinzufügen"
        onClose={onClose}
      >
        <View style={styles.ways}>
          {ways.map((way) => {
            const WayIcon = way.icon;
            const tint = busy ? textColor.tertiary : accent.base;
            return (
              <PressableScale
                key={way.key}
                style={styles.way}
                pressedStyle={styles.wayPressed}
                scaleOnPress={false}
                disabled={busy}
                onPress={() => void choose(way.key)}
                accessibilityRole="button"
                accessibilityLabel={`${way.title}. ${way.note}`}
                accessibilityState={{ disabled: busy }}
              >
                <WayIcon size={iconSize.lg} color={tint} weight="regular" />
                <View style={styles.wayBody}>
                  <Text variant="title" tone={busy ? 'tertiary' : 'primary'}>
                    {way.title}
                  </Text>
                  <Text
                    variant="bodySm"
                    tone={busy ? 'tertiary' : 'secondary'}
                    style={styles.wayNote}
                  >
                    {way.note}
                  </Text>
                </View>
                <CaretRight size={18} color={textColor.tertiary} weight="regular" />
              </PressableScale>
            );
          })}
        </View>

        <Text variant="label" tone="tertiary" style={styles.footnote}>
          Importierte Dokumente landen in „Neu", bis sie einsortiert sind.
        </Text>
      </BottomSheet>

      <BottomSheet
        visible={visible && urlOpen && duplicate === null}
        title="Von URL laden"
        onClose={() => setUrlOpen(false)}
      >
        <View style={styles.field}>
          <TextInput
            style={[typeScale.body, styles.input]}
            value={address}
            onChangeText={setAddress}
            placeholder="beispiel.de/bericht.html"
            placeholderTextColor={textColor.tertiary}
            selectionColor={accent.base}
            cursorColor={accent.base}
            autoFocus={urlOpen}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={() => void loadUrl()}
            maxFontSizeMultiplier={1.3}
            accessibilityLabel="Adresse des Dokuments"
            underlineColorAndroid="transparent"
          />
        </View>

        <Text variant="label" tone="tertiary" style={styles.hint}>
          Geladen wird die Seite selbst, nicht ihre Bilder oder Schriften.
        </Text>

        <View style={styles.footer}>
          <SecondaryButton
            label="Abbrechen"
            onPress={() => setUrlOpen(false)}
            style={styles.cancel}
          />
          <PrimaryButton
            label={busy ? 'Lädt …' : 'Laden'}
            disabled={busy || address.trim().length === 0}
            onPress={() => void loadUrl()}
            style={styles.load}
          />
        </View>
      </BottomSheet>
      <ContextMenu
        visible={duplicate !== null}
        items={duplicateItems}
        onClose={dismissDuplicate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  ways: {
    gap: space['12'],
  },
  way: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: size.cardPadding,
    paddingVertical: space['16'] + space['2'],
    paddingHorizontal: size.screenPadding,
    borderRadius: radius.md,
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.strong,
  },
  wayPressed: {
    backgroundColor: bg.overlay,
  },
  wayBody: {
    flex: 1,
  },
  wayNote: {
    marginTop: space['2'],
  },
  footnote: {
    marginTop: size.screenPadding,
    marginBottom: space['8'],
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    height: size.searchFieldHeight,
    borderRadius: radius.md,
    backgroundColor: bg.raised,
    // 2 px Rahmen: das Feld ist beim Oeffnen fokussiert (wie in Blatt `6c`).
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
    marginTop: space['12'],
  },
  footer: {
    flexDirection: 'row',
    gap: space['8'],
    marginTop: space['20'],
    marginBottom: space['8'],
  },
  cancel: {
    // 120 aus Blatt `6d`: bei aufgeschlagener Tastatur ist Hoehe knapp, der
    // Rueckweg braucht aber keine halbe Zeile.
    width: 120,
  },
  load: {
    flex: 1,
  },
});
