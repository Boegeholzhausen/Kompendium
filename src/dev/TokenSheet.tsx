/**
 * Token-Uebersicht (Referenz `1a`) — Abnahmeblatt fuer das Theme-Modul.
 *
 * Zeigt jeden Token so, wie er in der App aussieht: Flaechenstufen, Linien,
 * Text, Akzent, Semantik, Tag-Palette, Typo-Skala, Abstaende, Radien,
 * Icon-Groessen, Bewegung. Kein Produktionsscreen — dient der Kontrolle,
 * dass Werte und Schrift korrekt geladen sind.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  accent,
  bg,
  border,
  duration,
  iconSize,
  pressScale,
  radius,
  semantic,
  size,
  space,
  spacingScale,
  stagger,
  tagPalette,
  tagSurface,
  text,
  typeScale,
  type TypeVariant,
} from '../theme';
import { Text } from '../ui/Text';
import {
  Books,
  ChartBar,
  Folder,
  MagnifyingGlass,
  Star,
  Table,
} from '../ui/icons';

type Swatch = { token: string; value: string; note?: string };

const surfaces: Swatch[] = [
  { token: 'bg/base', value: bg.base, note: 'App-Hintergrund' },
  { token: 'bg/surface', value: bg.surface, note: 'Karten, Zeilen, Tab-Bar' },
  { token: 'bg/raised', value: bg.raised, note: 'Felder, Chips' },
  { token: 'bg/overlay', value: bg.overlay, note: 'Sheets, Menues' },
];

const lines: Swatch[] = [
  { token: 'border/subtle', value: border.subtle },
  { token: 'border/strong', value: border.strong },
];

const textTokens: Swatch[] = [
  { token: 'text/primary', value: text.primary, note: 'Titel, Fliesstext' },
  { token: 'text/secondary', value: text.secondary, note: 'Metadaten' },
  { token: 'text/tertiary', value: text.tertiary, note: 'Platzhalter' },
];

const accentTokens: Swatch[] = [
  { token: 'accent', value: accent.base },
  { token: 'accent/pressed', value: accent.pressed },
  { token: 'accent/surface', value: accent.surface },
  { token: 'accent/border', value: accent.border },
  { token: 'on-accent', value: accent.on },
];

const semanticTokens: Swatch[] = [
  { token: 'danger', value: semantic.danger },
  { token: 'warning', value: semantic.warning },
  { token: 'info', value: semantic.info },
];

const typeSamples: { variant: TypeVariant; label: string; sample: string }[] = [
  { variant: 'display', label: 'display · 30/36 · 700', sample: 'Bibliothek' },
  { variant: 'titleLg', label: 'title-lg · 22/28 · 600', sample: 'Noch keine Dokumente' },
  { variant: 'title', label: 'title · 18/24 · 600', sample: 'Quartalsauswertung' },
  { variant: 'body', label: 'body · 16/24 · 400', sample: 'Fliesstext, nie unter 16 px' },
  { variant: 'bodySm', label: 'body-sm · 14/20 · 400', sample: 'Textausschnitt im Suchtreffer' },
  { variant: 'label', label: 'label · 13/18 · 500', sample: 'Fuer offline laden' },
  { variant: 'caption', label: 'caption · 12/16 · 500', sample: 'vor 3 Tagen · 240 KB' },
  { variant: 'overline', label: 'overline · 11/14 · 600', sample: 'Alle Dokumente' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" tone="tertiary" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function SwatchRow({ item, showChip }: { item: Swatch; showChip?: boolean }) {
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatchBox, { backgroundColor: item.value }]} />
      <View style={styles.swatchText}>
        <Text variant="label">{item.token}</Text>
        {item.note ? (
          <Text variant="caption" tone="secondary">
            {item.note}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone="tertiary" numeric>
        {showChip ? '' : item.value}
      </Text>
    </View>
  );
}

export function TokenSheet() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space['16'], paddingBottom: insets.bottom + space['48'] },
      ]}
    >
      <Text variant="display">Tokens</Text>
      <Text variant="body" tone="secondary" style={styles.intro}>
        Abnahmeblatt des Theme-Moduls. Alle Werte stammen aus dem Handoff-Dokument.
      </Text>

      <Section title="Flaechen">
        {surfaces.map((item) => (
          <SwatchRow key={item.token} item={item} />
        ))}
      </Section>

      <Section title="Linien">
        {lines.map((item) => (
          <SwatchRow key={item.token} item={item} />
        ))}
      </Section>

      <Section title="Text">
        {textTokens.map((item) => (
          <SwatchRow key={item.token} item={item} />
        ))}
      </Section>

      <Section title="Akzent — Mint">
        {accentTokens.map((item) => (
          <SwatchRow key={item.token} item={item} />
        ))}
      </Section>

      <Section title="Semantik">
        {semanticTokens.map((item) => (
          <SwatchRow key={item.token} item={item} />
        ))}
      </Section>

      <Section title="Tag-Palette">
        <View style={styles.chipWrap}>
          {(Object.keys(tagPalette) as (keyof typeof tagPalette)[]).map((name) => (
            <View
              key={name}
              style={[styles.tagChip, { backgroundColor: tagSurface(tagPalette[name]) }]}
            >
              <View style={[styles.tagDot, { backgroundColor: tagPalette[name] }]} />
              <Text variant="label" style={{ color: tagPalette[name] }}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Typografie — Inter">
        {typeSamples.map((item) => (
          <View key={item.variant} style={styles.typeRow}>
            <Text variant="caption" tone="tertiary">
              {item.label}
            </Text>
            <Text variant={item.variant}>{item.sample}</Text>
          </View>
        ))}
        <View style={styles.typeRow}>
          <Text variant="caption" tone="tertiary">
            Tabellenziffern
          </Text>
          <Text variant="body" numeric>
            1 240 KB · 0123456789
          </Text>
        </View>
      </Section>

      <Section title="Abstaende">
        <View style={styles.spacingWrap}>
          {spacingScale.map((value) => (
            <View key={value} style={styles.spacingItem}>
              <View style={[styles.spacingBar, { width: value }]} />
              <Text variant="caption" tone="secondary" numeric>
                {value}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Radien">
        <View style={styles.chipWrap}>
          {(Object.keys(radius) as (keyof typeof radius)[]).map((key) => (
            <View key={key} style={styles.radiusItem}>
              <View style={[styles.radiusBox, { borderRadius: radius[key] }]} />
              <Text variant="caption" tone="secondary">
                {key}
              </Text>
              <Text variant="caption" tone="tertiary" numeric>
                {radius[key]}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Icons — Phosphor">
        <View style={styles.iconRow}>
          <Books size={iconSize.lg} color={text.primary} weight="regular" />
          <Folder size={iconSize.lg} color={accent.base} weight="fill" />
          <MagnifyingGlass size={iconSize.md} color={text.secondary} weight="regular" />
          <Star size={iconSize.md} color={accent.base} weight="fill" />
          <Table size={iconSize.sm} color={text.secondary} weight="regular" />
          <ChartBar size={iconSize.sm} color={text.secondary} weight="regular" />
        </View>
        <Text variant="caption" tone="tertiary" numeric>
          Groessen {iconSize.sm} / {iconSize.md} / {iconSize.lg} · regular und fill
        </Text>
      </Section>

      <Section title="Bewegung">
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            micro
          </Text>
          <Text variant="label" numeric>
            {duration.micro} ms
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            standard
          </Text>
          <Text variant="label" numeric>
            {duration.standard} ms
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            exit
          </Text>
          <Text variant="label" numeric>
            {duration.exit} ms
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            Druckfeedback
          </Text>
          <Text variant="label" numeric>
            {pressScale} in {duration.press} ms
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            Listen-Versatz
          </Text>
          <Text variant="label" numeric>
            {stagger.step} ms, max. {stagger.maxItems}
          </Text>
        </View>
      </Section>

      <Section title="Feste Masse">
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            Beruehrungsflaeche
          </Text>
          <Text variant="label" numeric>
            {size.touchTarget} dp
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            Kachel in der Zeile
          </Text>
          <Text variant="label" numeric>
            {size.tileSmall} dp
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            FAB
          </Text>
          <Text variant="label" numeric>
            {size.fab} dp
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Text variant="label" tone="secondary">
            Listenrand unten
          </Text>
          <Text variant="label" numeric>
            {size.listBottomPadding} dp
          </Text>
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  content: {
    paddingHorizontal: size.screenPadding,
  },
  intro: {
    marginTop: space['8'],
  },
  section: {
    marginTop: space['32'],
  },
  sectionTitle: {
    marginBottom: space['12'],
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.rowHeight,
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  swatchBox: {
    width: size.tileSmall,
    height: size.tileSmall,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  swatchText: {
    flex: 1,
    gap: space['2'],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['8'],
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    height: size.tagChipHeight,
    paddingHorizontal: space['12'],
    borderRadius: radius.pill,
  },
  tagDot: {
    width: size.tagDot,
    height: size.tagDot,
    borderRadius: radius.pill,
  },
  typeRow: {
    gap: space['4'],
    paddingVertical: space['12'],
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  spacingWrap: {
    gap: space['8'],
  },
  spacingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: space['20'],
  },
  spacingBar: {
    height: space['8'],
    borderRadius: radius.xs,
    backgroundColor: accent.base,
  },
  radiusItem: {
    alignItems: 'center',
    gap: space['4'],
    width: space['48'] + space['16'],
  },
  radiusBox: {
    width: size.tileSmall,
    height: size.tileSmall,
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.strong,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['20'],
    marginBottom: space['8'],
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: space['32'],
  },
});
