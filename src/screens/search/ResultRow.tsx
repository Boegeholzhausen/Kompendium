/**
 * Trefferzeile der Suche (Blatt `3d`).
 *
 * Kachel 44 x 44, Titel `body` mit hervorgehobener Fundstelle, Textausschnitt
 * `body-sm` in `text/secondary` (hoechstens zwei Zeilen), Fusszeile
 * "Finanzen · vor 1 Woche" als `caption` in `text/tertiary`.
 *
 * Sie ist bewusst NICHT die Dokumentzeile (Komponente 1): dort steht eine
 * Metazeile, hier ein Textausschnitt, und der braucht zwei Zeilen. Die Zeile
 * traegt auch keinen Favoriten-Stern — in einer Trefferliste geht es ums
 * Finden, nicht ums Sortieren.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { formatRelative } from '../../data/format';
import { isArchived } from '../../data/library';
import { useUnavailable } from '../../state/network';
import type { SearchResult } from '../../data/search';
import { border, size, space } from '../../theme';
import { DocTile } from '../../ui/DocTile';
import { HighlightedText } from '../../ui/HighlightedText';
import { PressableScale } from '../../ui/press';
import { Text } from '../../ui/Text';

export interface ResultRowProps {
  result: SearchResult;
  /** Letzte Zeile traegt keine Trennlinie. */
  last?: boolean;
  onPress: () => void;
}

export function ResultRow({ result, last = false, onPress }: ResultRowProps) {
  const { document, title, folderName, snippet, snippetHit, titleHit } = result;
  // Archivierte Dokumente werden mitgesucht (siehe `passesFilters`), stehen
  // aber in keiner Liste. Das "Archiv ·" davor sagt, warum — ohne es waere der
  // Treffer ein Dokument, das man danach nirgends wiederfindet.
  const place = `${isArchived(document) ? 'Archiv · ' : ''}${folderName ?? 'Nicht einsortiert'}`;
  const footer = `${place} · ${formatRelative(document.updatedAt)}`;
  // Gesperrt ist ein Treffer nur ohne Cache UND ohne Netz (Blatt `4c`) —
  // sonst waere ein gefundenes Dokument nicht zu oeffnen, obwohl es sich
  // laden liesse.
  const unavailable = useUnavailable()(document);

  return (
    <PressableScale
      style={[styles.row, last && styles.rowLast]}
      pressedStyle={styles.rowPressed}
      scaleOnPress={false}
      onPress={onPress}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${footer}`}
    >
      <DocTile
        id={document.id}
        type={document.docType}
        variant="row"
        state={unavailable ? 'unavailable' : 'default'}
      />

      <View style={styles.body}>
        <HighlightedText
          text={title}
          hit={titleHit}
          variant="body"
          tone={unavailable ? 'tertiary' : 'primary'}
          numberOfLines={2}
        />
        <HighlightedText
          text={snippet}
          hit={snippetHit}
          variant="bodySm"
          tone="secondary"
          numberOfLines={2}
          style={styles.snippet}
        />
        <Text variant="caption" tone="tertiary" numeric numberOfLines={1} style={styles.footer}>
          {footer}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Die Kachel steht oben, nicht mittig: der Textblock ist drei Zeilen hoch,
    // und eine mittig gesetzte Kachel saehe daneben verrutscht aus.
    alignItems: 'flex-start',
    gap: space['12'],
    paddingVertical: space['12'],
    paddingHorizontal: size.screenPadding,
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  rowLast: {
    borderBottomColor: 'transparent',
  },
  rowPressed: {
    backgroundColor: border.subtle,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  snippet: {
    marginTop: space['4'],
  },
  footer: {
    marginTop: space['4'] + space['2'],
  },
});
