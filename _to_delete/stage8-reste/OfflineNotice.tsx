/**
 * Screen 22 — Dokument nicht im Cache und offline (Blatt `4d`).
 *
 * Eigene Ansicht IM Viewer statt einer weissen WebView: der Screen bleibt auf
 * `bg/base`, und die Kopfzeile behaelt Titel und Zurueck-Pfeil. Der Nutzer
 * soll sehen, welches Dokument gemeint ist, und mit einem Tipp zurueckkommen —
 * eine leere weisse Flaeche sagt beides nicht.
 *
 * Zwei Aktionen. "Erneut versuchen" ist die primaere; "Für offline vormerken"
 * ist die Abweichung vom Auftrag und der Grund, warum dieser Screen nicht
 * folgenlos ist: ohne sie wiederholt sich derselbe Fehlschlag bei jedem
 * Offline-Versuch, ohne dass der Nutzer etwas dagegen tun kann.
 *
 * Die Metazeile unten zeigt, dass das Dokument existiert und nur sein Inhalt
 * fehlt.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { formatBytes, formatRelative } from '../../data/format';
import type { StoredDocument } from '../../data/library';
import { bg, border, iconSize, size, space, text as textColor } from '../../theme';
import { PrimaryButton, SecondaryButton } from '../../ui/Button';
import { ArrowClockwise, ClockCounterClockwise, CloudSlash, DownloadSimple } from '../../ui/icons';
import { Text } from '../../ui/Text';

export interface OfflineNoticeProps {
  document: StoredDocument;
  /** Oberer Freiraum: die Kopfzeile schwebt darueber. */
  top: number;
  bottom: number;
  onRetry: () => void;
  onKeepOffline: () => void;
}

export function OfflineNotice({
  document,
  top,
  bottom,
  onRetry,
  onKeepOffline,
}: OfflineNoticeProps) {
  const meta =
    document.lastOpenedAt === null
      ? `Noch nie geöffnet · ${formatBytes(document.sizeBytes)}`
      : `Zuletzt geöffnet ${formatRelative(document.lastOpenedAt)} · ${formatBytes(document.sizeBytes)}`;

  return (
    <View style={[styles.screen, { paddingTop: top, paddingBottom: bottom }]}>
      <View style={styles.box}>
        {/* 36 wie in den uebrigen Leerdarstellungen (Screens 10, 15, 3i). */}
        <CloudSlash size={36} color={textColor.tertiary} weight="regular" />
      </View>

      <Text variant="titleLg" style={styles.centered}>
        Offline nicht verfügbar
      </Text>
      <Text variant="body" tone="secondary" style={styles.centered}>
        Dieses Dokument liegt nicht im Gerätespeicher. Sobald eine Verbindung besteht, wird es
        geladen — oder du markierst es dauerhaft als offline.
      </Text>

      <View style={styles.actions}>
        <PrimaryButton label="Erneut versuchen" icon={ArrowClockwise} onPress={onRetry} />
        <SecondaryButton
          label={document.keepOffline ? 'Für offline vorgemerkt' : 'Für offline vormerken'}
          icon={DownloadSimple}
          // Zweimal vormerken aendert nichts; die Schaltflaeche sagt das,
          // statt einen zweiten Toast mit derselben Meldung zu schicken.
          disabled={document.keepOffline}
          onPress={onKeepOffline}
        />
      </View>

      <View style={styles.metaRow}>
        <ClockCounterClockwise size={iconSize.sm} color={textColor.tertiary} weight="regular" />
        <Text variant="caption" tone="tertiary" numeric>
          {meta}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: bg.base,
    paddingHorizontal: space['32'],
    gap: space['20'],
  },
  box: {
    width: size.emptyIconBox,
    height: size.emptyIconBox,
    borderRadius: size.emptyIconRadius,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: space['8'] + space['2'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
  },
});
