/**
 * Beispiel-Bestand — die **Erstbefuellung** der lokalen Datenbank.
 *
 * Bis Schritt 6 rendere die Bibliothek direkt aus diesem Modul. Seit Schritt 7
 * ist expo-sqlite die Wahrheitsquelle (Handoff-Dokument: "lokale Datenbank ist
 * die Wahrheitsquelle"), und dieser Bestand wird beim allerersten Start einmal
 * hineingeschrieben. Danach liest ihn niemand mehr: alles, was die Screens
 * zeigen, kommt aus der Datenbank.
 *
 * Der Bestand hat bewusst die 247 Dokumente aus dem Prototyp: erst bei dieser
 * Zahl zeigt sich, ob die Liste virtualisiert bleibt und ob der kollabierende
 * Header beim langen Blaettern ruhig steht. Die ersten Eintraege sind die
 * Dokumente aus den Blaettern `1c` und `1d`, damit sich der Screenshot direkt
 * gegen den Prototyp halten laesst; der Rest wird deterministisch erzeugt.
 */
import type { DocType } from '../theme/tile';
import { tagPalette } from '../theme/colors';
import type { LibraryDocument, LibraryFolder, LibraryTag, StoredDocument } from './library';

export type {
  DocumentSource,
  LibraryDocument,
  LibraryFolder,
  LibraryTag,
  StoredDocument,
} from './library';

export const libraryTags: LibraryTag[] = [
  { id: 'finanzen', name: 'Finanzen', color: tagPalette.sky },
  { id: 'recht', name: 'Recht', color: tagPalette.violet },
  { id: 'steuer', name: 'Steuer', color: tagPalette.amber },
  { id: 'reisen', name: 'Reisen', color: tagPalette.teal },
  { id: 'haushalt', name: 'Haushalt', color: tagPalette.lime },
  { id: 'technik', name: 'Technik', color: tagPalette.rose },
];

/**
 * Die Filter-Chip-Zeile zeigt laut Handoff-Dokument "die meistgenutzten Tags".
 * Bis es echte Nutzungszahlen gibt, stehen hier die beiden aus Blatt `1c`.
 */
export const topFilterTagIds = ['finanzen', 'recht'];

/**
 * Ordnerfarben der Erstbefuellung. Sie tragen laut Handoff-Dokument nur das
 * `folder`-Icon, nie eine Flaeche — sonst konkurrieren sie mit den
 * Dokumentkacheln. Blatt `3a` zeigt "Finanzen" in `sky`, der Rest folgt der
 * Reihenfolge der sechs Ordnerfarben.
 */
const folderColors: Record<string, string> = {
  Finanzen: tagPalette.sky,
  Recht: tagPalette.violet,
  Reisen: tagPalette.teal,
  Haushalt: tagPalette.lime,
  Technik: tagPalette.rose,
  Studium: tagPalette.mint,
};

export function folderColor(name: string | null): string {
  if (name === null) return tagPalette.slate;
  return folderColors[name] ?? tagPalette.slate;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Fester Bezugspunkt beim Modulstart. Ohne ihn saehe jede Zeile in einer
 * langen Sitzung anders aus als beim Rendern der Nachbarzeile.
 */
const now = Date.now();

const folderNames = ['Finanzen', 'Recht', 'Reisen', 'Haushalt', 'Technik', 'Studium'];

/**
 * Die Dokumente aus den Prototyp-Blaettern. Reihenfolge wie dort, damit der
 * Screenshot vergleichbar bleibt — die vier nicht einsortierten stehen zugleich
 * in der Sektion "Neu" (Badge 4).
 */
const curated: LibraryDocument[] = [
  {
    id: 'doc-portfolio-q3',
    title: 'Portfolio-Analyse Q3 2026',
    docType: 'chart',
    folderName: 'Finanzen',
    tagIds: ['finanzen', 'steuer'],
    favorite: true,
    cached: true,
    sizeBytes: 245_760,
    updatedAt: now - 3 * DAY,
    importedAt: now - 40 * DAY,
    openCount: 12,
  },
  {
    id: 'doc-mietrecht-kuendigung',
    title: 'Mietrecht — Kündigungsfristen',
    docType: 'text',
    folderName: 'Recht',
    tagIds: ['recht'],
    favorite: false,
    cached: true,
    sizeBytes: 90_112,
    updatedAt: now - 6 * DAY,
    importedAt: now - 52 * DAY,
    openCount: 7,
  },
  {
    id: 'doc-zinsrechner-annuitaet',
    title: 'Zinsrechner Annuitätendarlehen',
    docType: 'calculator',
    folderName: 'Finanzen',
    tagIds: ['finanzen'],
    favorite: false,
    cached: true,
    sizeBytes: 159_744,
    updatedAt: now - 9 * DAY,
    importedAt: now - 120 * DAY,
    openCount: 21,
  },
  {
    id: 'doc-packliste-island',
    title: 'Packliste Islandreise',
    docType: 'list',
    folderName: 'Reisen',
    tagIds: ['reisen'],
    favorite: false,
    cached: true,
    sizeBytes: 43_008,
    updatedAt: now - 12 * DAY,
    importedAt: now - 200 * DAY,
    openCount: 4,
  },
  {
    id: 'doc-stromverbrauch',
    title: 'Stromverbrauch 2024–2026',
    docType: 'chart',
    folderName: 'Haushalt',
    tagIds: ['haushalt'],
    favorite: false,
    cached: true,
    sizeBytes: 317_440,
    updatedAt: now - 16 * DAY,
    importedAt: now - 210 * DAY,
    openCount: 9,
  },
  {
    id: 'doc-depot-august',
    title: 'Depot-Auswertung August',
    docType: 'chart',
    folderName: null,
    tagIds: ['finanzen'],
    favorite: false,
    cached: true,
    sizeBytes: 524_288,
    updatedAt: now - 2 * HOUR,
    importedAt: now - 2 * HOUR,
    openCount: 1,
  },
  {
    id: 'doc-cloud-vergleich',
    title: 'Vergleich Cloud-Anbieter',
    docType: 'table',
    folderName: null,
    tagIds: ['technik'],
    favorite: false,
    cached: true,
    sizeBytes: 98_304,
    updatedAt: now - 5 * HOUR,
    importedAt: now - 5 * HOUR,
    openCount: 2,
  },
  {
    id: 'doc-steuer-checkliste',
    title: 'Checkliste Steuererklärung 2026',
    docType: 'list',
    folderName: null,
    tagIds: ['steuer'],
    favorite: false,
    cached: true,
    sizeBytes: 65_536,
    updatedAt: now - 7 * HOUR,
    importedAt: now - 7 * HOUR,
    openCount: 1,
  },
  {
    id: 'doc-serverkosten',
    title: 'Serverkosten je Anbieter',
    docType: 'table',
    folderName: null,
    tagIds: ['technik'],
    favorite: false,
    cached: true,
    sizeBytes: 79_872,
    updatedAt: now - 10 * HOUR,
    importedAt: now - 10 * HOUR,
    openCount: 3,
  },
  {
    id: 'doc-haushaltsbudget',
    title: 'Haushaltsbudget laufendes Jahr',
    docType: 'table',
    folderName: 'Haushalt',
    tagIds: ['haushalt', 'finanzen'],
    favorite: true,
    cached: true,
    sizeBytes: 131_072,
    updatedAt: now - 2 * DAY,
    importedAt: now - 300 * DAY,
    openCount: 34,
  },
  {
    id: 'doc-arbeitsvertrag-notizen',
    title: 'Notizen zum Arbeitsvertrag',
    docType: 'text',
    folderName: 'Recht',
    tagIds: ['recht'],
    favorite: false,
    // Offline nicht geladen — zeigt den deaktivierten Zustand der Zeile.
    cached: false,
    sizeBytes: 51_200,
    updatedAt: now - 21 * DAY,
    importedAt: now - 160 * DAY,
    openCount: 5,
  },
  {
    id: 'doc-lesenotizen-statistik',
    title: 'Lesenotizen Statistik-Vorlesung',
    docType: 'text',
    folderName: 'Studium',
    tagIds: [],
    favorite: false,
    cached: true,
    sizeBytes: 184_320,
    updatedAt: now - 26 * DAY,
    importedAt: now - 180 * DAY,
    openCount: 8,
  },
];

/**
 * Bausteine fuer den erzeugten Rest. Ueberschrift + Zusatz ergeben Titel, die
 * in Laenge und Zeichensatz zu den echten passen — inklusive solcher, die auf
 * zwei Zeilen umbrechen.
 */
const stems = [
  'Quartalsbericht',
  'Reisekosten',
  'Wartungsplan Heizung',
  'Lieferantenvergleich',
  'Protokoll Eigentümerversammlung',
  'Kalkulation Umbau Bad',
  'Netzplan Wohnung',
  'Sparplan Auswertung',
  'Versicherungsübersicht',
  'Leseliste',
  'Rezeptsammlung',
  'Trainingsplan',
  'Umzugscheckliste',
  'Fahrtenbuch',
  'Nebenkostenabrechnung',
  'Gehaltsentwicklung',
  'Wetterdaten Auswertung',
  'Inventarliste Keller',
  'Zeiterfassung Projekt',
  'Vergleich Mobilfunktarife',
  'Notizen Steuerberatung',
  'Auswertung Photovoltaik',
  'Bücherregal Bestand',
  'Kostenaufstellung Garten',
];

/**
 * Zwoelf Zusaetze, nicht acht. Mit 24 Ueberschriften ergeben sich 288
 * Kombinationen — mehr als die 235 erzeugten Dokumente. Bei acht Zusaetzen
 * waren es 192, und die 43 ueberzaehligen bekamen denselben Titel wie ein
 * frueheres Dokument. In der langen Liste faellt das nicht auf; in jedem
 * Screen, der eine Auswahl daraus zeigt (etwa "Offline behalten"), stand
 * derselbe Titel dann sechsmal untereinander.
 */
const suffixes = [
  '2021',
  '2022',
  '2023',
  '2024',
  '2025',
  '2026',
  'Entwurf',
  'alte Fassung',
  'überarbeitet',
  'Zusammenfassung',
  'Anhang',
  'Endfassung',
];
const types: DocType[] = ['table', 'chart', 'text', 'calculator', 'list'];

/** Gesamtzahl aus dem Prototyp — "Alle Dokumente" fuehrt mit dieser Zahl. */
const TOTAL = 247;

/**
 * Wie viele Dokumente beim ersten Start offline vorgehalten werden. Blatt `3i`
 * nennt "Offline behaltene Dokumente: 12"; getroffen werden die zwoelf am
 * haeufigsten geoeffneten — was oft aufgeschlagen wird, soll auch ohne Netz da
 * sein.
 */
const OFFLINE_SEED_COUNT = 12;

function generated(): LibraryDocument[] {
  const rest: LibraryDocument[] = [];

  for (let i = curated.length; i < TOTAL; i += 1) {
    // Laufende Nummer INNERHALB der erzeugten Dokumente. Ueberschrift laeuft
    // schnell, Zusatz erst nach jedem vollen Durchlauf — so ist jedes Paar
    // genau einmal dran, statt sich alle 24 Dokumente zu wiederholen.
    const n = i - curated.length;
    const stem = stems[n % stems.length];
    const suffix = suffixes[Math.floor(n / stems.length) % suffixes.length];
    // Der Schrittweite muss zur Zahl der Faecher teilerfremd sein, sonst
    // landet alles im selben Ordner: bei sechs Ordnern plus "nicht
    // einsortiert" sind das sieben Faecher, und ein Schritt von 7 traf bis
    // Schritt 6 immer die Null — 237 Dokumente in "Finanzen", "Technik" leer.
    const folderIndex = (i * 3) % (folderNames.length + 1);

    rest.push({
      id: `doc-${i.toString().padStart(3, '0')}`,
      title: `${stem} ${suffix}`,
      docType: types[(i * 3) % types.length],
      // Ein Rest bleibt nicht einsortiert, aber nicht neu — er darf nicht in
      // die Sektion "Neu" rutschen, deshalb liegt der Import Monate zurueck.
      folderName: folderIndex === folderNames.length ? null : folderNames[folderIndex],
      // Nur jedes dritte Dokument traegt einen Tag — und die Wahl richtet sich
      // nach der laufenden Nummer INNERHALB dieser Drittel. `i % 6` traefe
      // sonst nur zwei der sechs Tags, weil 3 und 6 nicht teilerfremd sind.
      tagIds: i % 3 === 0 ? [libraryTags[(i / 3) % libraryTags.length].id] : [],
      favorite: i % 17 === 0,
      cached: i % 23 !== 0,
      sizeBytes: 20_480 + ((i * 8191) % 900_000),
      updatedAt: now - (28 + i) * DAY,
      importedAt: now - (60 + i * 2) * DAY,
      // Die Schrittweite muss zur Zahl der Ueberschriften (24) teilerfremd
      // sein — sonst gehoert zu jedem Wert von "Geoeffnet" genau eine
      // Ueberschrift. Mit `% 24` standen in "Offline behalten", das die zwoelf
      // meistgeoeffneten zeigt, sechsmal "Kostenaufstellung Garten"
      // untereinander. 19 ist prim und teilt weder 24 noch 17 noch 23.
      openCount: (i * 11) % 19,
    });
  }

  return rest;
}

const seedDocuments: LibraryDocument[] = [...curated, ...generated()];

/** Die zwoelf meistgeoeffneten Dokumente, die im Cache liegen — siehe oben. */
const offlineSeedIds = new Set(
  [...seedDocuments]
    .filter((document) => document.cached)
    .sort((a, b) => b.openCount - a.openCount)
    .slice(0, OFFLINE_SEED_COUNT)
    .map((document) => document.id)
);

/**
 * Der Bestand als Datenbankzeilen. `cacheKey` bleibt `null`: diese Dokumente
 * haben keine eigene Datei, der Viewer erzeugt ihren Inhalt aus
 * `sampleDocumentHtml`. Erst importierte Dokumente bringen eine Datei mit.
 */
export const seedLibrary: StoredDocument[] = seedDocuments.map((document) => ({
  ...document,
  note: '',
  keepOffline: offlineSeedIds.has(document.id),
  trashedAt: null,
  source: 'sample',
  cacheKey: null,
}));

/** Die Ordner der Erstbefuellung, in der Reihenfolge ihres ersten Auftretens. */
export const seedFolders: LibraryFolder[] = (() => {
  const names: string[] = [];
  for (const document of seedDocuments) {
    if (document.folderName !== null && !names.includes(document.folderName)) {
      names.push(document.folderName);
    }
  }
  return names.map((name) => ({ name, color: folderColor(name), keepOffline: false }));
})();

/**
 * "Neu" heisst: seit dem letzten Tag importiert und noch keinem Ordner
 * zugeordnet. Genau diese Dokumente erzeugen Handlungsdruck — alles andere ist
 * bereits eingeraeumt.
 */
export function isNewDocument(
  document: { folderName: string | null; importedAt: number },
  at: number = Date.now()
): boolean {
  return document.folderName === null && at - document.importedAt < DAY;
}
