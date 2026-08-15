/**
 * Sektion "Neu" (Blatt `1c`).
 *
 * Eigener Rahmen in `accent/surface` mit 1 px `accent/border`, `radius md`,
 * Innenabstand 12. Kopf: `overline` in `accent`, Anzahl-Badge in Mint und
 * "Einsortieren" als Mint-Textbutton. Darunter waagerecht scrollende Karten,
 * Breite 148, `gap 10`.
 *
 * Dies ist laut Handoff-Dokument der einzige Ort in der App, der Handlungsdruck
 * erzeugen darf — deshalb bekommt er als einzige Sektion eine eigene Flaeche,
 * und deshalb erscheint er nur in der Listenansicht mit ihrem grossen Kopf.
 *
 * Der Anschnitt der dritten Karte ist nicht gezeichnet, sondern entsteht: die
 * Kartenreihe ist breiter als der Rahmen und wird an dessen Innenkante
 * abgeschnitten.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { formatDocumentMeta } from '../../data/format';
import type { StoredDocument } from '../../data/library';
import { accent, radius, size, space } from '../../theme';
import { DocCard } from '../../ui/DocCard';
import { SectionHeader } from '../../ui/SectionHeader';
import { NEW_CARD_WIDTH } from './metrics';

export interface NewSectionProps {
  documents: StoredDocument[];
  onOpen: (document: StoredDocument) => void;
  onSortIn: () => void;
}

export function NewSection({ documents, onOpen, onSortIn }: NewSectionProps) {
  if (documents.length === 0) return null;

  return (
    <View style={styles.box}>
      <SectionHeader
        title="Neu"
        accent
        badge={documents.length}
        actionLabel="Einsortieren"
        onAction={onSortIn}
        style={styles.header}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {documents.map((document) => (
          <DocCard
            key={document.id}
            id={document.id}
            title={document.title}
            type={document.docType}
            meta={formatDocumentMeta(document.updatedAt, document.sizeBytes)}
            showFavorite={false}
            onPress={() => onOpen(document)}
            style={styles.card}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: size.screenPadding,
    borderRadius: radius.md,
    backgroundColor: accent.surface,
    borderWidth: 1,
    borderColor: accent.border,
    paddingTop: space['12'],
    paddingLeft: space['12'],
    paddingBottom: space['12'] + space['2'],
    // Rechts kein Innenabstand: die Karten sollen bis an die Rahmenkante
    // laufen, damit der Anschnitt sichtbar wird.
    overflow: 'hidden',
  },
  header: {
    paddingRight: space['12'],
    paddingLeft: space['4'],
    paddingBottom: space['8'] + space['2'],
  },
  row: {
    flexDirection: 'row',
    gap: space['8'] + space['2'],
  },
  card: {
    width: NEW_CARD_WIDTH,
  },
});
