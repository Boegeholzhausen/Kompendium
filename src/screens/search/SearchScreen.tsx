/**
 * Screens 8, 9 und 10 — Suche (Blaetter `3c`, `3d`, `3e`).
 *
 * Ein Screen, drei Zustaende. Sie werden abgeleitet, nicht gespeichert: ohne
 * abgeschickten Begriff steht "Zuletzt gesucht" da, mit Treffern die Liste,
 * ohne Treffer die Leerdarstellung. Zwei Quellen fuer dieselbe Aussage waeren
 * eine Fehlerquelle.
 *
 * Der Screen liegt als Push-Screen **ohne Tab-Bar** ueber dem Rahmen: die
 * Tastatur belegt die untere Haelfte, eine Navigationsleiste darunter waere nur
 * verdeckte Flaeche.
 *
 * Aufbau von oben: Zurueck-Pfeil und Suchfeld in einer Zeile, darunter die
 * Filterzeile (erst wenn gesucht wurde), dann der jeweilige Zustand.
 *
 * Die Leerdarstellung nennt Ursache und Trefferzahl ohne Filter — "Nichts
 * gefunden" allein liesse offen, ob das Dokument fehlt oder der Filter zu eng
 * ist. "Filter zuruecksetzen" ist dort die einzige primaere Aktion.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  bestSingleTerm,
  countWithoutFilters,
  searchDocuments,
  type SearchInput,
} from '../../data/search';
import { useGuardedPush } from '../../navigation/useGuardedPush';
import { useDocumentStore } from '../../state/documents';
import { useFolderStore } from '../../state/folders';
import {
  activeFilterCount,
  periodLabels,
  useSearchStore,
  type PeriodKey,
} from '../../state/search';
import {
  bg,
  border,
  iconSize,
  radius,
  size,
  space,
  text as textColor,
} from '../../theme';
import { PrimaryButton, TextButton } from '../../ui/Button';
import { ChoiceSheet, type ChoiceOption } from '../../ui/ChoiceSheet';
import { FilterChip } from '../../ui/FilterChip';
import {
  ArrowLeft,
  CalendarBlank,
  ClockCounterClockwise,
  Folder,
  MagnifyingGlass,
} from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { PressableScale } from '../../ui/press';
import { SearchField } from '../../ui/SearchField';
import { SectionHeader } from '../../ui/SectionHeader';
import { Text } from '../../ui/Text';
import { ResultRow } from './ResultRow';

type OpenSheet = null | 'folder' | 'period';

/** Chip aus Blatt `3c`: Hoehe 40, Uhr-Icon 16 und der Begriff in `body`. */
function RecentChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale
      style={styles.recentChip}
      pressedStyle={styles.recentChipPressed}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Erneut suchen nach ${label}`}
      hitSlop={{
        top: (size.touchTarget - size.filterChipHeight) / 2,
        bottom: (size.touchTarget - size.filterChipHeight) / 2,
      }}
    >
      <ClockCounterClockwise size={iconSize.sm} color={textColor.tertiary} weight="regular" />
      <Text variant="body">{label}</Text>
    </PressableScale>
  );
}

export function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const push = useGuardedPush();

  const query = useSearchStore((state) => state.query);
  const submitted = useSearchStore((state) => state.submitted);
  const recentQueries = useSearchStore((state) => state.recentQueries);
  const filters = useSearchStore((state) => state.filters);
  const setQuery = useSearchStore((state) => state.setQuery);
  const submit = useSearchStore((state) => state.submit);
  const clear = useSearchStore((state) => state.clear);
  const clearRecent = useSearchStore((state) => state.clearRecent);
  const setFolderFilter = useSearchStore((state) => state.setFolderFilter);
  const setPeriod = useSearchStore((state) => state.setPeriod);
  const resetFilters = useSearchStore((state) => state.resetFilters);

  const documents = useDocumentStore((state) => state.documents);
  const folders = useFolderStore((state) => state.folders);

  const [sheet, setSheet] = useState<OpenSheet>(null);

  const input: SearchInput = useMemo(
    () => ({ query: submitted, filters, documents }),
    [submitted, filters, documents]
  );

  const results = useMemo(() => searchDocuments(input), [input]);
  const unfilteredCount = useMemo(() => countWithoutFilters(input), [input]);
  /**
   * Nur fuer die Leerdarstellung: bei mehreren Begriffen ist die Frage
   * "welches Wort war zu viel?" — deshalb erst rechnen, wenn nichts gefunden
   * wurde.
   */
  const singleTerm = useMemo(
    () => (results.length === 0 ? bestSingleTerm(input) : null),
    [input, results.length]
  );

  const filterCount = activeFilterCount(filters);
  const hasQuery = submitted.trim().length > 0;

  /** Der Satz, der die Ursache benennt (Screen 10). */
  const reason = useMemo(() => {
    if (filterCount === 0) {
      return 'Kein Dokument enthält diesen Begriff — weder im Titel noch im Text.';
    }
    const which = filterCount === 1 ? 'Ein Filter ist aktiv' : `${filterCount} Filter sind aktiv`;
    const found =
      unfilteredCount === 1 ? 'gibt es 1 Treffer' : `gibt es ${unfilteredCount} Treffer`;
    return `${which}. Ohne Filter ${found}.`;
  }, [filterCount, unfilteredCount]);

  const folderOptions: ChoiceOption[] = folders.map((folder) => ({
    key: folder.name,
    label: folder.name,
    dotColor: folder.color,
  }));

  const periodOptions: ChoiceOption[] = (Object.keys(periodLabels) as PeriodKey[]).map((key) => ({
    key,
    label: periodLabels[key],
  }));

  /**
   * Der Begriff faehrt als Adressparameter mit: der Viewer sucht ihn nach dem
   * Laden noch einmal und springt zur ersten Fundstelle, statt den Nutzer oben
   * im Dokument abzusetzen (D3). Als Objekt statt als Zeichenkette, weil
   * `typedRoutes` in `app.json` die Route sonst nicht mehr kennt.
   */
  const openDocument = (id: string) =>
    push({ pathname: '/dokument/[id]', params: { id, suche: submitted } });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.searchRow}>
        <IconButton
          icon={ArrowLeft}
          onPress={() => router.back()}
          accessibilityLabel="Zurück zur Bibliothek"
          style={styles.back}
        />
        <SearchField
          value={query}
          onChangeText={setQuery}
          onSubmit={() => submit()}
          onClear={() => clear()}
          autoFocus
          style={styles.field}
        />
      </View>

      {hasQuery ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          // Ohne festen Platz nimmt sich die waagerechte Leiste die ganze
          // Resthoehe und schiebt die Treffer an den unteren Rand.
          style={styles.filterBar}
          contentContainerStyle={styles.filterRow}
          keyboardShouldPersistTaps="handled"
        >
          <FilterChip
            label={filters.folderName ?? 'Ordner'}
            icon={Folder}
            active={filters.folderName !== null}
            dropdown={filters.folderName === null}
            removable={filters.folderName !== null}
            onPress={() =>
              filters.folderName === null ? setSheet('folder') : setFolderFilter(null)
            }
          />
          <FilterChip
            label={filters.period === null ? 'Zeitraum' : periodLabels[filters.period]}
            icon={CalendarBlank}
            active={filters.period !== null}
            dropdown={filters.period === null}
            removable={filters.period !== null}
            onPress={() => (filters.period === null ? setSheet('period') : setPeriod(null))}
          />
        </ScrollView>
      ) : null}

      {!hasQuery ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.suggestions}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {recentQueries.length > 0 ? (
            <>
              <Text variant="overline" tone="tertiary">
                Zuletzt gesucht
              </Text>
              <View style={styles.chips}>
                {recentQueries.map((entry) => (
                  <RecentChip
                    key={entry}
                    label={entry}
                    onPress={() => {
                      setQuery(entry);
                      submit(entry);
                    }}
                  />
                ))}
              </View>
              {/* Der Verlauf gehoert dem Nutzer: er muss ihn auch wieder
                  loswerden koennen. Kein Toast — die Chips verschwinden
                  sichtbar, das ist die Rueckmeldung. */}
              <TextButton
                label="Verlauf leeren"
                compact
                onPress={clearRecent}
                style={styles.clearRecent}
              />
            </>
          ) : null}
        </ScrollView>
      ) : results.length > 0 ? (
        <ScrollView
          style={styles.body}
          contentContainerStyle={{ paddingBottom: insets.bottom + size.screenPadding }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <SectionHeader
            title={results.length === 1 ? '1 Treffer' : `${results.length} Treffer`}
            hint="Relevanz"
            style={styles.resultsHeader}
          />
          {results.map((result, index) => (
            <ResultRow
              key={result.document.id}
              result={result}
              last={index === results.length - 1}
              onPress={() => openDocument(result.document.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyBox}>
            <MagnifyingGlass size={36} color={border.strong} weight="regular" />
          </View>
          <Text variant="title" style={styles.emptyTitle}>
            {`Keine Treffer für „${submitted}“`}
          </Text>
          <Text variant="body" tone="secondary" style={styles.emptyReason}>
            {reason}
          </Text>
          {/*
            Ein Satz, kein zweiter Zustand: bei mehreren Begriffen sagt er,
            welcher davon allein etwas gefunden haette. Damit ist klar, dass
            die Kombination zu eng war und nicht der Bestand zu duenn.
          */}
          {singleTerm !== null ? (
            <Text variant="body" tone="secondary" style={styles.emptyReason}>
              {`„${singleTerm.term}“ allein: ${
                singleTerm.count === 1 ? '1 Treffer' : `${singleTerm.count} Treffer`
              }`}
            </Text>
          ) : null}
          {filterCount > 0 ? (
            <PrimaryButton
              label="Filter zurücksetzen"
              onPress={resetFilters}
              style={styles.emptyAction}
            />
          ) : null}
        </View>
      )}

      <ChoiceSheet
        visible={sheet === 'folder'}
        title="Ordner"
        options={folderOptions}
        value={filters.folderName ?? ''}
        onSelect={(key) => setFolderFilter(key)}
        onClose={() => setSheet(null)}
      />
      <ChoiceSheet
        visible={sheet === 'period'}
        title="Zeitraum"
        options={periodOptions}
        value={filters.period ?? ''}
        onSelect={(key) => setPeriod(key as PeriodKey)}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: bg.base,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['4'],
    paddingTop: space['4'],
    paddingBottom: space['12'],
    paddingHorizontal: size.screenPadding,
  },
  back: {
    // Zieht das 48er Ziel bis an den Bildrand, ohne das Feld zu verschieben.
    marginLeft: -space['12'],
  },
  field: {
    flex: 1,
  },
  filterBar: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: space['8'],
    paddingHorizontal: size.screenPadding,
    paddingBottom: space['12'],
  },
  body: {
    flex: 1,
  },
  suggestions: {
    paddingHorizontal: size.screenPadding,
    paddingTop: space['8'],
    paddingBottom: space['24'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space['8'],
    marginTop: space['12'],
  },
  clearRecent: {
    alignSelf: 'flex-start',
    marginTop: space['8'],
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['8'],
    height: size.filterChipHeight,
    paddingHorizontal: size.cardPadding,
    borderRadius: radius.pill,
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.subtle,
  },
  recentChipPressed: {
    backgroundColor: bg.overlay,
    borderColor: border.strong,
  },
  resultsHeader: {
    paddingHorizontal: size.screenPadding,
    paddingBottom: space['8'],
    borderBottomWidth: 1,
    borderBottomColor: border.subtle,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['32'],
    gap: size.screenPadding,
  },
  emptyBox: {
    width: size.emptyIconBox,
    height: size.emptyIconBox,
    borderRadius: size.emptyIconRadius,
    backgroundColor: bg.surface,
    borderWidth: 1,
    borderColor: border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyReason: {
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: space['8'],
    paddingHorizontal: space['24'],
  },
});
