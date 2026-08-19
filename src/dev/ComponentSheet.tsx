/**
 * Komponenten-Blatt (Referenz `2a`) — Abnahmeblatt fuer die 18 Basiskomponenten.
 *
 * Zeigt jede Komponente in allen Zustaenden, in der Reihenfolge des
 * Komponenten-Inventars. Das Blatt ist Werkzeug, kein Produktions-UI: es
 * benutzt aber ausschliesslich dieselben Tokens und Komponenten, damit ein
 * Fehler hier derselbe Fehler ist wie in der App.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accent, border, radius, size, space, tagPalette } from '../theme';
import {
  ContextMenuSurface,
  CreateFolderTile,
  DocCard,
  DocRow,
  Fab,
  FilterChip,
  FolderTile,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  SectionHeader,
  SelectionBar,
  SheetSurface,
  Skeleton,
  SkeletonCard,
  SkeletonList,
  SyncIndicator,
  TabBar,
  Text,
  TextButton,
  ToastSurface,
} from '../ui';
import {
  Archive,
  Books,
  Check,
  CheckCircle,
  Folder,
  FolderOpen,
  Folders,
  Gear,
  Star,
  Trash,
} from '../ui/icons';

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <Text variant="overline" tone="tertiary">
        {title}
      </Text>
      <View style={styles.blockBody}>{children}</View>
      {note ? (
        <Text variant="bodySm" tone="secondary" style={styles.note}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <Text variant="caption" tone="tertiary" style={styles.caption}>
      {children}
    </Text>
  );
}

export function ComponentSheet() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('annuit');
  const [tab, setTab] = useState('library');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space['16'], paddingBottom: insets.bottom + space['48'] },
      ]}
    >
      <Text variant="display">Komponenten</Text>
      <Text variant="body" tone="secondary" style={styles.intro}>
        Achtzehn Bausteine in allen Zustaenden. Gedrueckt ist immer Skalierung 0.97 plus eine
        Flaechenstufe hoeher; deaktiviert ist ein Farbwechsel, nie Deckkraft.
      </Text>

      <Block
        title="01 · Dokumentzeile"
        note="Der Stern ist ein eigenes 48-dp-Ziel neben der Zeile, nicht darin."
      >
        <Caption>Ruhe</Caption>
        <DocRow
          id="doc-quartal-2026"
          title="Portfolio-Analyse Q3"
          type="chart"
          meta="vor 3 Tagen · 240 KB"
          unread
          favorite
        />
        <Caption>Zweizeiliger Titel</Caption>
        <DocRow
          id="doc-marktbericht-juli"
          title="Vergleich der Cloud-Anbieter fuer den Betrieb kleiner Dienste"
          type="table"
          meta="vor 1 Woche · 1,2 MB"
        />
        <Caption>Ausgewaehlt — Mehrfachauswahl</Caption>
        <DocRow
          id="doc-quartal-2026"
          title="Portfolio-Analyse Q3"
          type="chart"
          meta="vor 3 Tagen · 240 KB"
          selectionMode
          selected
        />
        <Caption>Nicht gewaehlt, aber auswaehlbar</Caption>
        <DocRow
          id="doc-einkaufsliste"
          title="Einkauf Wochenende"
          type="list"
          meta="vor 2 Tagen · 8 KB"
          selectionMode
        />
        <Caption>Deaktiviert — offline nicht geladen</Caption>
        <DocRow
          id="doc-marktbericht-juli"
          title="Marktbericht Juli"
          type="text"
          meta="vor 6 Tagen · 88 KB"
          unavailable
          last
        />
      </Block>

      <Block title="02 · Dokumentkarte" note="Zwei Spalten, gap 16 / 12. Titel zwei Zeilen, feste Hoehe 36.">
        <View style={styles.cardGrid}>
          <DocCard
            id="doc-cloud-vergleich"
            title="Vergleich Cloud-Anbieter"
            type="table"
            folderName="Technik"
            style={styles.cardCell}
          />
          <DocCard
            id="doc-einkaufsliste"
            title="Einkauf Wochenende"
            type="list"
            favorite
            style={styles.cardCell}
          />
        </View>
      </Block>

      <Block title="03 · Ordner-Kachel">
        <View style={styles.folderRow}>
          <FolderTile name="Finanzen" count={38} color={tagPalette.sky} style={styles.folderCell} />
          <FolderTile name="Recht" count={12} color={tagPalette.violet} style={styles.folderCell} />
        </View>
        <CreateFolderTile style={styles.createFolder} />
      </Block>

      <Block title="05 · Filter-Chip">
        <View style={styles.chipRow}>
          <FilterChip label="Alle" active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip
            label="Favoriten"
            icon={Star}
            active={filter === 'fav'}
            onPress={() => setFilter('fav')}
          />
          <FilterChip
            label="Finanzen"
            dotColor={tagPalette.sky}
            active={filter === 'fin'}
            onPress={() => setFilter('fin')}
          />
          <FilterChip label="Zeitraum" dropdown />
          <FilterChip label="Technik" active removable />
        </View>
        <Caption>Kollabierter Header — Hoehe 36</Caption>
        <View style={styles.chipRow}>
          <FilterChip label="Alle" compact active />
          <FilterChip label="Favoriten" compact icon={Star} />
        </View>
      </Block>

      <Block
        title="06 · Suchfeld"
        note="In der Bibliothek fuehrt das Feld auf den Suchscreen. Beim Fokussieren wechselt der Rahmen auf 2 px accent/border; der Innenabstand sinkt um 1, damit nichts springt."
      >
        <Caption>Ruhe — fuehrt auf den Suchscreen</Caption>
        <SearchField interactive={false} />
        <Caption>Gefuellt — mit Loeschen</Caption>
        <SearchField value={query} onChangeText={setQuery} onClear={() => setQuery('')} />
      </Block>

      <Block title="07 · Sektionskopf">
        <SectionHeader title="Neu" badge={4} actionLabel="Einsortieren" accent />
        <View style={styles.gap16} />
        <SectionHeader title="Alle Dokumente" count={247} />
        <View style={styles.gap16} />
        <SectionHeader title="7 Treffer" hint="Relevanz" />
      </Block>

      <Block title="15 · Sync-Indikator" note="Bei Offline oder Fehler ersetzt der 36-px-Streifen diese Leiste.">
        <Caption>Sync laeuft</Caption>
        <SyncIndicator status="syncing" />
        <Caption>Aenderungen offen</Caption>
        <SyncIndicator status="pending" />
        <Caption>Synchron — unsichtbar</Caption>
        <SyncIndicator status="idle" />
      </Block>

      <Block title="08 · Bottom-Sheet">
        <SheetSurface title="In Ordner verschieben" onClose={() => undefined} style={styles.sheet}>
          <View style={styles.sheetRow}>
            <Folder size={20} color={tagPalette.sky} weight="fill" />
            <Text variant="body" style={styles.sheetLabel}>
              Finanzen
            </Text>
            <Check size={20} color={accent.base} weight="regular" />
          </View>
          <View style={styles.sheetRow}>
            <Folder size={20} color={tagPalette.violet} weight="fill" />
            <Text variant="body" style={styles.sheetLabel}>
              Recht
            </Text>
          </View>
        </SheetSurface>
      </Block>

      <Block
        title="09 · Kontextmenue"
        note="Der destruktive Eintrag steht immer unten, in danger und mit eigener Linie."
      >
        <ContextMenuSurface
          items={[
            { key: 'fav', label: 'Zu Favoriten', icon: Star },
            { key: 'move', label: 'Verschieben', icon: FolderOpen },
            { key: 'read', label: 'Als gelesen markieren', icon: CheckCircle },
            { key: 'trash', label: 'In den Papierkorb', icon: Trash, destructive: true },
          ]}
        />
      </Block>

      <Block title="10–13 · Buttons und FAB" note="Pro Screen genau eine primaere Aktion.">
        <PrimaryButton label="Importieren" />
        <View style={styles.gap12} />
        <PrimaryButton label="Importieren" disabled />
        <View style={styles.gap12} />
        <SecondaryButton label="Bearbeiten" />
        <View style={styles.gap12} />
        <SecondaryButton label="Papierkorb leeren" icon={Trash} danger />
        <View style={styles.gap12} />
        <View style={styles.buttonRow}>
          <TextButton label="Fuer offline laden" />
          <TextButton label="deaktiviert" disabled />
          <Fab inline style={styles.fab} />
        </View>
      </Block>

      <Block title="14 · Tab-Bar · 17 · Auswahl-Aktionsleiste">
        <View style={styles.barFrame}>
          <TabBar
            inline
            value={tab}
            onChange={setTab}
            items={[
              { key: 'library', label: 'Bibliothek', icon: Books },
              { key: 'folders', label: 'Ordner', icon: Folders },
              { key: 'settings', label: 'Einstellungen', icon: Gear },
            ]}
          />
        </View>
        <View style={styles.gap12} />
        <View style={styles.barFrame}>
          <SelectionBar
            inline
            actions={[
              { key: 'move', label: 'Verschieben', icon: FolderOpen },
              { key: 'read', label: 'Gelesen', icon: CheckCircle },
              { key: 'archive', label: 'Archiv', icon: Archive },
              { key: 'delete', label: 'Loeschen', icon: Trash, destructive: true },
            ]}
          />
        </View>
      </Block>

      <Block title="16 · Toast" note="Standzeit 5 s; die Absicherung liegt im Rueckweg, nicht in einem Dialog.">
        <ToastSurface message="3 verschoben" icon={Trash} actionLabel="Rueckgaengig" />
      </Block>

      <Block
        title="18 · Skelett-Platzhalter"
        note="Schimmer nur auf den oberen drei Zeilen; darunter Deckkraft 1 → 0.6 → 0.3."
      >
        <SkeletonList count={6} />
        <View style={styles.gap16} />
        <View style={styles.cardGrid}>
          <SkeletonCard style={styles.cardCell} />
          <View style={styles.cardCell}>
            <Skeleton width="100%" height={size.skeletonTitleBar} />
            <View style={styles.gap12} />
            <Skeleton width="60%" height={size.skeletonMetaBar} shimmer={false} />
          </View>
        </View>
      </Block>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: size.screenPadding,
  },
  intro: {
    marginTop: space['8'],
  },
  block: {
    marginTop: space['32'],
    borderTopWidth: 1,
    borderTopColor: border.subtle,
    paddingTop: space['20'],
  },
  blockBody: {
    marginTop: space['12'],
  },
  note: {
    marginTop: space['12'],
  },
  caption: {
    marginTop: space['12'],
    marginBottom: space['4'],
  },
  cardGrid: {
    flexDirection: 'row',
    gap: space['12'],
  },
  cardCell: {
    flex: 1,
  },
  folderRow: {
    flexDirection: 'row',
    gap: space['12'],
  },
  folderCell: {
    flex: 1,
  },
  createFolder: {
    marginTop: space['12'],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space['8'],
  },
  gap12: {
    height: space['12'],
  },
  gap16: {
    height: space['16'],
  },
  sheet: {
    marginHorizontal: -size.screenPadding,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.buttonHeight,
    borderTopWidth: 1,
    borderTopColor: border.strong,
  },
  sheetLabel: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['20'],
  },
  fab: {
    marginLeft: 'auto',
  },
  barFrame: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
