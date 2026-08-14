/**
 * Kachel-System (Referenz `1b`) — Abnahmeblatt fuer DocTile.
 *
 * Fuenf Typ-Muster in je drei Farbtoenen, darunter die 44-dp-Variante und die
 * beiden Sonderzustaende: gedaempft im Papierkorb, entsaettigt wenn offline
 * nicht geladen.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { border, hueFromId, size, space, type DocType } from '../theme';
import { DocTile } from '../ui/DocTile';
import { Text } from '../ui/Text';

/** Drei Beispiel-Ausweise, die weit auseinanderliegende Farbtoene ergeben. */
const sampleIds = ['doc-quartal-2026', 'doc-marktbericht-juli', 'doc-einkaufsliste'];

const types: { type: DocType; label: string }[] = [
  { type: 'table', label: 'Tabelle' },
  { type: 'chart', label: 'Diagramm' },
  { type: 'text', label: 'Fliesstext' },
  { type: 'calculator', label: 'Rechner' },
  { type: 'list', label: 'Liste' },
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

export function TileSheet() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space['16'], paddingBottom: insets.bottom + space['48'] },
      ]}
    >
      <Text variant="display">Kacheln</Text>
      <Text variant="body" tone="secondary" style={styles.intro}>
        Farbton deterministisch aus der Dokument-ID, Muster aus dem erkannten Typ, Typ-Icon unten
        links.
      </Text>

      <View style={styles.hueRow}>
        <View style={styles.labelColumn} />
        {sampleIds.map((id) => (
          <View key={id} style={styles.hueLabel}>
            <Text variant="caption" tone="tertiary" numeric>
              {hueFromId(id)}
            </Text>
          </View>
        ))}
      </View>

      {types.map(({ type, label }) => (
        <View key={type} style={styles.typeRow}>
          <View style={styles.labelColumn}>
            <Text variant="label">{label}</Text>
          </View>
          {sampleIds.map((id) => (
            <View key={id} style={styles.tileCell}>
              <DocTile id={id} type={type} variant="card" />
            </View>
          ))}
        </View>
      ))}

      <Section title="44 dp — in Listenzeilen">
        <View style={styles.smallRow}>
          {types.map(({ type }) => (
            <DocTile key={type} id={sampleIds[0]} type={type} variant="row" />
          ))}
        </View>
        <Text variant="bodySm" tone="secondary" style={styles.note}>
          Auf 44 dp traegt nur das Muster; das Typ-Icon entfaellt, weil es bei dieser Groesse mit dem
          Muster kollidiert.
        </Text>
      </Section>

      <Section title="Papierkorb — gedaempft">
        <View style={styles.smallRow}>
          {types.map(({ type }) => (
            <DocTile key={type} id={sampleIds[1]} type={type} variant="row" state="trashed" />
          ))}
        </View>
        <Text variant="bodySm" tone="secondary" style={styles.note}>
          Saettigung und Muster zurueckgenommen — wiedererkennbar, aber sichtbar ausser Dienst.
        </Text>
      </Section>

      <Section title="Offline nicht geladen — entsaettigt">
        <View style={styles.smallRow}>
          {types.map(({ type }) => (
            <DocTile key={type} id={sampleIds[2]} type={type} variant="row" state="unavailable" />
          ))}
        </View>
      </Section>

      <Section title="Derselbe Ausweis, dieselbe Farbe">
        <View style={styles.smallRow}>
          {[0, 1, 2, 3, 4].map((index) => (
            <DocTile key={index} id={sampleIds[0]} type="table" variant="row" />
          ))}
        </View>
        <Text variant="bodySm" tone="secondary" style={styles.note}>
          Der Farbton wird nicht gespeichert, sondern jedes Mal aus der ID gerechnet.
        </Text>
      </Section>
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
  section: {
    marginTop: space['32'],
    borderTopWidth: 1,
    borderTopColor: border.subtle,
    paddingTop: space['20'],
  },
  sectionTitle: {
    marginBottom: space['12'],
  },
  hueRow: {
    flexDirection: 'row',
    gap: space['12'],
    marginTop: space['24'],
  },
  hueLabel: {
    flex: 1,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    marginTop: space['12'],
  },
  labelColumn: {
    width: space['48'] + space['24'],
  },
  tileCell: {
    flex: 1,
  },
  smallRow: {
    flexDirection: 'row',
    gap: space['12'],
  },
  note: {
    marginTop: space['12'],
  },
});
