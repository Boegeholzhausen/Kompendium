/**
 * Screen 16 — Darstellung (Blatt `6b`), erreichbar aus den Einstellungen.
 *
 * Drei Gruppen:
 *
 *   Bibliothek   "Standardansicht" als Zweier-Segment, "Sortierung" als
 *                Vierer-Segment
 *   Lesen        "Textgröße im Viewer" mit Prozentwert, Regler, Skalenenden
 *                und **echter Vorschau** auf hellem Papier; dann "Dokumente
 *                abdunkeln" und "Bildschirm anlassen"
 *   App          "Farbschema" als nicht bedienbare Zeile, "Bewegung
 *                reduzieren" als Auskunft ueber die Systemeinstellung
 *
 * Die Vorschau ist der Kern dieses Screens: "der Regler wirkt in fremden
 * Dokumenten, nicht in der App, deshalb ist die Prozentzahl allein nicht
 * aussagekraeftig". Sie steht auf `sampleDocument.paper` in Georgia — das ist
 * Beispielinhalt und ausdruecklich nicht Teil des Designsystems.
 *
 * "Standardansicht" und "Sortierung" aendern denselben Zustand, den die
 * Bibliothek gerade benutzt (siehe `state/library.ts`). Eine Voreinstellung
 * daneben, die erst beim naechsten Start gilt, waere fuer niemanden
 * nachvollziehbar.
 *
 * **Abweichung:** "Bewegung reduzieren" ist ein Schalter im Blatt, folgt aber
 * laut Untertitel der Systemeinstellung. Beides zusammen geht nicht — ein
 * Schalter, der sich beim naechsten Systemwechsel von selbst umstellt, ist
 * kaputt. Die Zeile zeigt deshalb den gelesenen Zustand als Wert und ist nicht
 * bedienbar, so wie das Farbschema darueber.
 */
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sampleDocument } from '../../theme/colors';
import { sampleDocumentPreview } from '../../theme/typography';
import {
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  TEXT_SCALE_STEP,
  useAppearanceStore,
} from '../../state/appearance';
import { sortShortLabels, useLibraryStore, type SortKey } from '../../state/library';
import { useReduceMotion } from '../../theme/useReduceMotion';
import { bg, radius, size, space } from '../../theme';
import { SegmentedControl } from '../../ui/Button';
import { Moon, Rows, SquaresFour } from '../../ui/icons';
import { CompactHeader } from '../../ui/ScreenHeader';
import { SettingsGroup, SettingsRow } from '../../ui/SettingsList';
import { Slider } from '../../ui/Slider';
import { Switch } from '../../ui/Switch';
import { Text } from '../../ui/Text';

const sortKeys: SortKey[] = ['recent', 'title', 'size', 'opened'];

/**
 * Die Vorschau. Georgia 17/27 auf hellem Papier, mit dem Faktor multipliziert.
 *
 * Schrift und Farbe kommen aus dem Theme, aber aus dessen Beispielinhalt-Teil
 * (`sampleDocumentPreview`, `sampleDocument`) — nicht aus den Tokens. Was hier
 * steht, gehoert zum gezeigten Dokument, nicht zur App.
 */
function Preview({ scale }: { scale: number }) {
  return (
    <View style={styles.paper}>
      <Text style={[styles.paperText, sampleDocumentPreview(scale)]}>
        Die Restschuld sinkt in den ersten Jahren langsamer, als die Rate
        vermuten lässt — der Zinsanteil überwiegt.
      </Text>
    </View>
  );
}

export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const viewMode = useLibraryStore((state) => state.viewMode);
  const setViewMode = useLibraryStore((state) => state.setViewMode);
  const sort = useLibraryStore((state) => state.sort);
  const setSort = useLibraryStore((state) => state.setSort);

  const textScale = useAppearanceStore((state) => state.viewerTextScale);
  const setTextScale = useAppearanceStore((state) => state.setTextScale);
  const dimDocuments = useAppearanceStore((state) => state.dimDocuments);
  const setDimDocuments = useAppearanceStore((state) => state.setDimDocuments);
  const keepScreenOn = useAppearanceStore((state) => state.keepScreenOn);
  const setKeepScreenOn = useAppearanceStore((state) => state.setKeepScreenOn);

  const percent = `${Math.round(textScale * 100)} %`;

  return (
    <View style={styles.screen}>
      <View style={{ paddingTop: insets.top }}>
        <CompactHeader title="Darstellung" onBack={onBack} raised />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: size.screenPadding + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsGroup title="Bibliothek">
          <SettingsRow
            label="Standardansicht"
            below={
              <SegmentedControl
                options={[
                  { key: 'list', label: 'Liste', icon: Rows },
                  { key: 'grid', label: 'Kacheln', icon: SquaresFour },
                ]}
                value={viewMode}
                onChange={(key) => setViewMode(key === 'grid' ? 'grid' : 'list')}
              />
            }
          />
          <SettingsRow
            label="Sortierung"
            below={
              <SegmentedControl
                options={sortKeys.map((key) => ({ key, label: sortShortLabels[key] }))}
                value={sort}
                onChange={(key) => setSort(key as SortKey)}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup title="Lesen" style={styles.group}>
          <SettingsRow
            label="Textgröße im Viewer"
            value={percent}
            below={
              <View>
                <Slider
                  value={textScale}
                  min={TEXT_SCALE_MIN}
                  max={TEXT_SCALE_MAX}
                  step={TEXT_SCALE_STEP}
                  onChange={setTextScale}
                  accessibilityLabel="Textgröße im Viewer"
                  accessibilityValueText={percent}
                />
                <View style={styles.scale}>
                  <Text variant="caption" tone="tertiary" numeric>
                    {`${Math.round(TEXT_SCALE_MIN * 100)} %`}
                  </Text>
                  <Text variant="caption" tone="tertiary" numeric>
                    {`${Math.round(TEXT_SCALE_MAX * 100)} %`}
                  </Text>
                </View>
                <Preview scale={textScale} />
              </View>
            }
          />
          <SettingsRow
            label="Dokumente abdunkeln"
            note="Helle Seiten leicht dämpfen"
            right={
              <Switch
                value={dimDocuments}
                onValueChange={setDimDocuments}
                accessibilityLabel="Dokumente abdunkeln"
              />
            }
          />
          <SettingsRow
            label="Bildschirm anlassen"
            note="Beim Lesen nicht sperren"
            right={
              <Switch
                value={keepScreenOn}
                onValueChange={setKeepScreenOn}
                accessibilityLabel="Bildschirm beim Lesen anlassen"
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup title="App" style={styles.group}>
          <SettingsRow label="Farbschema" note="Dunkel — einziger Modus" icon={Moon} inert />
          <SettingsRow
            label="Bewegung reduzieren"
            note="Folgt der Systemeinstellung"
            value={reduceMotion ? 'An' : 'Aus'}
            inert
          />
        </SettingsGroup>
      </ScrollView>
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
    paddingTop: space['20'],
  },
  group: {
    marginTop: space['24'],
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space['4'],
  },
  paper: {
    marginTop: space['16'],
    borderRadius: radius.sm,
    backgroundColor: sampleDocument.paper,
    padding: size.cardPadding,
  },
  paperText: {
    color: sampleDocument.inkSoft,
  },
});
