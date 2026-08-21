/**
 * Screen 14 — Einstellungen (Blatt `3i`).
 *
 * Gruppierte Liste. Aufbau von oben:
 *
 *   Synchronisierung   Statuszeile mit Wolkensymbol und Zeitpunkt, darunter
 *                      "Jetzt synchronisieren" als Mint-Textzeile
 *   Konto              wer angemeldet ist, Anmelden/Abmelden, Kennung
 *   Speicher           Balken aus zwei Segmenten mit Legende, "Offline
 *                      behaltene Dokumente", Papierkorb (beide mit Anzahl),
 *                      "Cache leeren"
 *   Sonstiges          Darstellung, Über
 *
 * **Abweichung von Blatt `3i`:** dort stehen Papierkorb, Darstellung und Über
 * ohne Gruppenueberschrift zusammen ("drei Einzelziele brauchen keine drei
 * Ueberschriften"). Der Papierkorb ist aber belegter Platz und gehoert damit
 * zu dem, was "Speicher" ohnehin aufzaehlt — neben "Offline behaltene
 * Dokumente" beantwortet er dieselbe Frage. Was bleibt, sind zwei Zeilen ohne
 * gemeinsames Thema; sie tragen jetzt "Sonstiges", damit keine Gruppe ohne
 * Ueberschrift zwischen zwei beschrifteten haengt.
 *
 * Aktionen sind Mint-**Text**, keine Buttons, damit die Liste eine Liste
 * bleibt. Der Screen hat damit keine primaere Aktion, und das ist richtig: er
 * ist ein Verzeichnis, keine Aufgabe.
 *
 * **Warum "Konto" eine eigene Gruppe ist und nicht in "Synchronisierung"
 * steht:** die Sync-Gruppe beantwortet "ist alles oben?", die Konto-Gruppe
 * "wem gehoert das oben?". Beides in einer Gruppe stuende nebeneinander, ohne
 * dass die Ueberschrift noch beides traegt — und die Kennung, die es dort
 * schon gab, gehoert ohnehin zur zweiten Frage. Sie ist deshalb mitgewandert.
 *
 * Das Anmelden sitzt hier und nicht als Schirm vor der App: die lokale
 * Datenbank ist die Wahrheitsquelle, jeder Screen rendert offline
 * vollstaendig, und ein Schirm davor machte die Bibliothek ohne Netz
 * unbenutzbar — fuer einen Vorgang, den man pro Installation genau einmal
 * braucht (siehe `data/supabase.ts` und `./LoginSheet`).
 *
 * Der Inhalt beginnt auf dem Seitenrand 16 unter der Sync-Leiste — derselbe
 * Abstand wie in Bibliothek und Ordner. Vorher waren es 8, wodurch die erste
 * Gruppenueberschrift beim Tab-Wechsel sichtbar hoeher sass als der Inhalt der
 * Nachbar-Tabs.
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
import {
  ArrowsDownUp,
  CloudCheck,
  CloudSlash,
  EnvelopeSimple,
  UserCircleDashed,
  Warning,
} from '../../ui/icons';
import { TitleHeader } from '../../ui/ScreenHeader';
import { SettingsBlock, SettingsGroup, SettingsRow } from '../../ui/SettingsList';
import { SyncIndicator } from '../../ui/SyncIndicator';
import { Toast } from '../../ui/Toast';
import { LoginSheet } from './LoginSheet';
import { StorageSummary } from './StorageSummary';

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
  const identity = useSessionStore((state) => state.identity);
  const sessionStatus = useSessionStore((state) => state.status);
  const logOut = useSessionStore((state) => state.logOut);

  const [notice, setNotice] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const usage = useMemo(() => storageUsage(documents), [documents]);

  const syncIcon =
    status === 'error'
      ? Warning
      : status === 'pending' || status === 'signed-out'
        ? CloudSlash
        : CloudCheck;
  const syncTint =
    status === 'error'
      ? semantic.danger
      : status === 'pending' || status === 'signed-out'
        ? textColor.secondary
        : accent.base;
  // Im Fehlerfall steht der Grund unter dem Wort. "Sync fehlgeschlagen" allein
  // laesst den Nutzer raten, ob er etwas tun kann — "Keine Verbindung."
  // beantwortet genau das. Ohne Anmeldung steht dort der Weg heraus.
  const syncNote =
    status === 'error' && lastError !== null
      ? lastError
      : status === 'signed-out'
        ? 'melde dich unter „Konto" an'
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
   * Abmelden — nur die Session, nie der Bestand.
   *
   * Die lokale Datenbank ist die Wahrheitsquelle; sie hier zu leeren waere ein
   * Datenverlust fuer einen Vorgang, der ausschliesslich die Identitaet
   * betrifft. Wer sich wieder anmeldet, findet alles vor.
   */
  const leaveAccount = async () => {
    try {
      await logOut();
      setNotice('Abgemeldet · deine Dokumente bleiben auf diesem Gerät');
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
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
        <SyncIndicator status={status} />
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
          {/* Ohne Anmeldung gibt es nichts anzustossen. Die Zeile bleibt
              stehen, damit der Aufbau nicht springt, ist aber stumm — und die
              Statuszeile darueber nennt den Weg. */}
          <SettingsRow
            label={status === 'syncing' ? 'Wird synchronisiert …' : 'Jetzt synchronisieren'}
            action
            inert={status === 'syncing' || status === 'signed-out'}
            onPress={sync}
          />
        </SettingsGroup>

        {isSupabaseConfigured ? (
          <SettingsGroup title="Konto" style={styles.group}>
            {/* Wort UND Symbol, wie in der Statuszeile darueber. */}
            <SettingsRow
              label={identity?.email ?? 'Nicht angemeldet'}
              note={
                identity !== null
                  ? 'angemeldet · jedes Gerät sieht denselben Bestand'
                  : 'die Bibliothek läuft weiter, nur der Abgleich ruht'
              }
              icon={identity !== null ? EnvelopeSimple : UserCircleDashed}
              iconColor={identity !== null ? accent.base : textColor.secondary}
            />
            {identity !== null ? (
              <SettingsRow
                label="Abmelden"
                note="Deine Dokumente bleiben auf diesem Gerät."
                action
                onPress={() => void leaveAccount()}
              />
            ) : (
              <SettingsRow
                label={sessionStatus === 'signing-in' ? 'Wird geprüft …' : 'Anmelden'}
                action
                inert={sessionStatus === 'signing-in'}
                onPress={() => setLoginOpen(true)}
              />
            )}
            {userId !== null ? (
              <SettingsRow
                label="Kennung"
                value={`${userId.slice(0, 8)} …`}
                note="tippen zum Kopieren · npm run upload braucht sie"
                onPress={() => void copyUserId()}
              />
            ) : null}
          </SettingsGroup>
        ) : null}

        <SettingsGroup title="Speicher" style={styles.group}>
          <SettingsBlock>
            <StorageSummary usage={usage} />
          </SettingsBlock>
          <SettingsRow
            label="Offline behaltene Dokumente"
            value={String(usage.offlineCount)}
            chevron
            onPress={() => push('/offline')}
          />
          <SettingsRow
            label="Papierkorb"
            value={String(usage.trashCount)}
            chevron
            onPress={() => push('/papierkorb')}
          />
          <SettingsRow label="Cache leeren" action onPress={() => void emptyCache()} />
        </SettingsGroup>

        <SettingsGroup title="Sonstiges" style={styles.group}>
          <SettingsRow label="Darstellung" chevron onPress={() => push('/darstellung')} />
          <SettingsRow label="Über" value={`Version ${APP_VERSION}`} />
        </SettingsGroup>
      </ScrollView>

      <LoginSheet
        visible={loginOpen}
        onClose={() => setLoginOpen(false)}
        onDone={(email) => {
          setNotice(email === null ? 'Angemeldet' : `Angemeldet als ${email}`);
          // Gleich abgleichen: wer sich anmeldet, will seinen Bestand sehen und
          // nicht erst noch eine zweite Zeile antippen.
          void sync();
        }}
      />

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
  },
  group: {
    marginTop: space['24'],
  },
});
