/**
 * Screen 14 — Einstellungen (Blatt `3i`).
 *
 * Gruppierte Liste. Aufbau von oben:
 *
 *   Synchronisierung   Statuszeile mit Wolkensymbol und Zeitpunkt, darunter
 *                      "Jetzt synchronisieren" als Mint-Textzeile
 *   Speicher           Balken aus zwei Segmenten mit Legende, "Offline
 *                      behaltene Dokumente" mit Chevron, "Cache leeren"
 *   ohne Ueberschrift  Papierkorb (mit Anzahl), Darstellung, Über
 *
 * "Papierkorb, Darstellung und Über stehen ohne Gruppenueberschrift zusammen —
 * drei Einzelziele brauchen keine drei Ueberschriften."
 *
 * Aktionen sind Mint-**Text**, keine Buttons, damit die Liste eine Liste
 * bleibt. Der Screen hat damit keine primaere Aktion, und das ist richtig: er
 * ist ein Verzeichnis, keine Aufgabe.
 *
 * **Abweichung:** die Zeile "Abnahmeblätter" ist ergaenzt. Die Blaetter aus
 * `src/dev` sind das Werkzeug, mit dem dieser Auftrag geprueft wird; sie muessen
 * erreichbar bleiben, und der Platz dafuer ist die letzte Gruppe. In einer
 * ausgelieferten Fassung faellt die Zeile weg.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedPush } from '../../navigation/useGuardedPush';

import * as Clipboard from 'expo-clipboard';

import { clearCache } from '../../data/cache';
import { formatRelative, formatTime } from '../../data/format';
import { storageUsage } from '../../data/storage';
import { isSupabaseConfigured } from '../../data/supabase';
import { useDocumentStore } from '../../state/documents';
import { useSessionStore } from '../../state/session';
import { syncLabels, useSyncStore } from '../../state/sync';
import { accent, bg, semantic, size, space, text as textColor } from '../../theme';
import { ArrowsDownUp, CloudCheck, CloudSlash, Warning } from '../../ui/icons';
import { TitleHeader } from '../../ui/ScreenHeader';
import { SettingsBlock, SettingsGroup, SettingsRow } from '../../ui/SettingsList';
import { Text } from '../../ui/Text';
import { Toast } from '../../ui/Toast';
import { StorageBar } from './StorageBar';

/** Version der App — steht in Blatt `3i` als "Version 1.4.0". */
const APP_VERSION = '1.4.0';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const push = useGuardedPush();

  const documents = useDocumentStore((state) => state.documents);
  const markUncached = useDocumentStore((state) => state.markUncached);

  const status = useSyncStore((state) => state.status);
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt);
  const sync = useSyncStore((state) => state.sync);
  const lastError = useSyncStore((state) => state.lastError);
  const userId = useSessionStore((state) => state.userId);

  const [notice, setNotice] = useState<string | null>(null);

  const usage = useMemo(() => storageUsage(documents), [documents]);

  const syncIcon =
    status === 'error' ? Warning : status === 'pending' ? CloudSlash : CloudCheck;
  const syncTint =
    status === 'error'
      ? semantic.danger
      : status === 'pending'
        ? textColor.secondary
        : accent.base;
  // Im Fehlerfall steht der Grund unter dem Wort. "Sync fehlgeschlagen" allein
  // laesst den Nutzer raten, ob er etwas tun kann — "Anonymous sign-ins are
  // disabled" beantwortet genau das.
  const syncNote =
    status === 'error' && lastError !== null
      ? lastError
      : lastSyncedAt === null
        ? 'noch nicht synchronisiert'
        : `zuletzt ${formatTime(lastSyncedAt)} · ${formatRelative(lastSyncedAt)}`;

  /**
   * Die Geraetekennung — dieselbe, unter der die Dokumente in Supabase liegen.
   *
   * Sie steht hier, weil der Weg vom PC sie braucht: `scripts/upload.mjs` laedt
   * unter genau dieser Kennung hoch, und bei mehr als einer Identitaet im
   * Projekt muss der Nutzer sagen koennen, welche gemeint ist. Angezeigt wird
   * der Anfang, kopiert wird die ganze — eine UUID ist nichts zum Abtippen.
   */
  const copyUserId = async () => {
    if (userId === null) return;
    await Clipboard.setStringAsync(userId);
    setNotice('Kennung kopiert');
  };

  /**
   * "Cache leeren" nimmt weg, was nur zufaellig noch da ist — Dokumente mit
   * "Offline behalten" bleiben. Die Zeilen selbst bleiben in allen Listen
   * stehen und sind nur nicht mehr zu oeffnen, genau wie jedes nicht geladene
   * Dokument (Blatt `4c`).
   */
  const emptyCache = async () => {
    const keep = documents
      .filter((document) => document.keepOffline && document.cacheKey !== null)
      .map((document) => document.cacheKey as string);

    const dropped = await clearCache(keep);
    const droppedIds = documents
      .filter((document) => document.cacheKey !== null && dropped.includes(document.cacheKey))
      .map((document) => document.id);

    if (droppedIds.length > 0) markUncached(droppedIds);
    setNotice(
      usage.cacheBytes > 0 ? 'Cache geleert' : 'Der Cache war schon leer'
    );
  };

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <TitleHeader title="Einstellungen" />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: size.listBottomPadding + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup title="Synchronisierung">
          {/* Wort UND Symbol: Farbe traegt nie allein die Bedeutung. */}
          <SettingsRow
            label={syncLabels[status]}
            note={syncNote}
            icon={syncIcon}
            iconColor={syncTint}
          />
          <SettingsRow
            label={status === 'syncing' ? 'Wird synchronisiert …' : 'Jetzt synchronisieren'}
            action
            inert={status === 'syncing'}
            onPress={sync}
          />
          {isSupabaseConfigured && userId !== null ? (
            <SettingsRow
              label="Gerätekennung"
              value={`${userId.slice(0, 8)} …`}
              note="tippen zum Kopieren"
              onPress={() => void copyUserId()}
            />
          ) : null}
        </SettingsGroup>

        <SettingsGroup title="Speicher" style={styles.group}>
          <SettingsBlock>
            <StorageBar usage={usage} />
          </SettingsBlock>
          <SettingsRow
            label="Offline behaltene Dokumente"
            value={String(usage.offlineCount)}
            chevron
            onPress={() => push('/offline')}
          />
          <SettingsRow label="Cache leeren" action onPress={() => void emptyCache()} />
        </SettingsGroup>

        <SettingsGroup style={styles.group}>
          <SettingsRow
            label="Papierkorb"
            value={String(usage.trashCount)}
            chevron
            onPress={() => push('/papierkorb')}
          />
          <SettingsRow label="Darstellung" chevron onPress={() => push('/darstellung')} />
          <SettingsRow label="Über" value={`Version ${APP_VERSION}`} />
          <SettingsRow label="Abnahmeblätter" chevron onPress={() => push('/abnahme')} />
        </SettingsGroup>

        <Text variant="label" tone="tertiary" style={styles.footnote}>
          Die Bibliothek liegt lokal auf diesem Gerät. Ohne Zugangsdaten für die
          Synchronisierung bleibt sie dort.
        </Text>
      </ScrollView>

      <Toast
        visible={notice !== null}
        message={notice ?? ''}
        icon={ArrowsDownUp}
        onHide={() => setNotice(null)}
        style={{ bottom: insets.bottom + size.screenPadding }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  content: {
    padding: size.screenPadding,
    paddingTop: space['8'],
  },
  group: {
    marginTop: space['24'],
  },
  footnote: {
    marginTop: space['20'],
    paddingHorizontal: space['4'],
  },
});
