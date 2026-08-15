/**
 * Raster, Radien, feste Masse und Icon-Groessen.
 * Alle Werte stammen aus dem Handoff-Dokument; freie Zahlen sind in Komponenten
 * nur fuer Flex-Verhaeltnisse erlaubt, nicht fuer Abstaende.
 */

/** Abstands-Skala: 2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 */
export const space = {
  '2': 2,
  '4': 4,
  '8': 8,
  '12': 12,
  '16': 16,
  '20': 20,
  '24': 24,
  '32': 32,
  '40': 40,
  '48': 48,
} as const;

/** Fuer den Token-Linter und die Token-Uebersicht. */
export const spacingScale = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48] as const;

export const radius = {
  xs: 6,
  sm: 10,
  /** Karten, Felder, Buttons */
  md: 14,
  /** FAB */
  lg: 20,
  /** Sheets, nur oben */
  xl: 28,
  pill: 999,
} as const;

/** Icon-Groessen als Token: 16 / 20 / 24. */
export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
} as const;

/** Feste Masse aus dem Komponenten-Inventar. */
export const size = {
  /** Seitenrand, durchgehend */
  screenPadding: 16,
  /** Mindest-Beruehrungsflaeche */
  touchTarget: 48,
  /** Mindestabstand zwischen zwei Beruehrungsflaechen */
  touchGap: 8,

  /** Dokumentzeile */
  rowHeight: 64,
  /** Kachel in der Zeile */
  tileSmall: 44,
  /** Kachel in Karten und Ergebnislisten */
  tileAspect: 16 / 10,
  /** Die gedrueckte Zeile zieht ihre Flaeche 8 ueber den Seitenrand hinaus. */
  rowOverhang: 8,

  /** Dokumentkarte: Titel zwei Zeilen `label`, feste Hoehe gegen Zeilensprung */
  cardTitleHeight: 36,
  /** Ordner-Chip unter dem Kartentitel */
  folderChipHeight: 24,

  /** Ordner-Kachel und Kontextmenue */
  cardPadding: 14,
  menuPadding: 6,
  menuItemHeight: 48,

  /** Anzahl-Badge im Sektionskopf */
  badgeHeight: 20,

  /** Buttons */
  buttonHeight: 52,
  buttonHeightCompact: 44,

  /** Chips */
  tagChipHeight: 28,
  tagChipHeightSheet: 32,
  filterChipHeight: 40,
  filterChipHeightCollapsed: 36,

  /** Suchfeld */
  searchFieldHeight: 48,

  /** FAB: 56 x 56, 16 vom rechten Rand, 112 ueber der Unterkante */
  fab: 56,
  fabInset: 16,
  fabBottom: 112,

  /**
   * Tab-Bar ohne Safe Area: 8 oben + Icon 24 + gap 4 + Zeilenhoehe `caption`
   * 16 + 8 unten. Der FAB braucht den Wert, weil seine 112 von der Unterkante
   * des Bildschirms zaehlen, er selbst aber ueber der Tab-Bar haengt.
   */
  tabBarHeight: 60,

  /** Kopfzeilen */
  headerCompactHeight: 56,
  viewerHeaderHeight: 80,

  /** Streifen */
  syncIndicatorHeight: 2,
  noticeStripHeight: 36,

  /** Schwebender Aktionsbalken im Viewer */
  viewerActionBarHeight: 60,
  viewerActionBarColumn: 64,
  viewerActionBarInset: 16,

  /** Toast */
  toastHeight: 56,
  /** "Rueckgaengig" im Toast — eigene Beruehrungsflaeche innerhalb der 56 */
  toastActionHeight: 40,

  /** Skelett-Platzhalter: Balken fuer Titel und Metazeile */
  skeletonTitleBar: 14,
  skeletonMetaBar: 10,

  /** Sheet-Griff */
  sheetHandleWidth: 36,
  sheetHandleHeight: 4,

  /** Schalter */
  switchWidth: 48,
  switchHeight: 28,
  switchKnob: 22,
  switchPadding: 3,

  /** Auswahl-Kaestchen */
  checkbox: 24,

  /** Tag-Punkt in der Dokumentzeile */
  tagDot: 6,
  /** Farbpunkt in der Tag-Verwaltung */
  tagDotLarge: 10,

  /** Unterer Innenabstand aller Listen: FAB + Tab-Bar */
  listBottomPadding: 88,

  /** Einstellungen (Blatt `3i`): Zeilenhoehe 56-60, Innenabstand 14 */
  settingsRowHeight: 56,
  /** Speicherbalken: 8 hoch, `radius pill` */
  storageBarHeight: 8,
  /** Legendenpunkt neben dem Speicherbalken */
  legendDot: 8,

  /** Regler "Textgroesse im Viewer" (Blatt `6b`) */
  sliderTrack: 4,
  sliderKnob: 24,
  /** Ring des Knopfs in `bg/surface` */
  sliderKnobRing: 3,

  /** Leerdarstellungen */
  emptyIconBox: 88,
  /**
   * Radius der Leerdarstellungs-Flaeche. 24 steht so im Handoff-Dokument
   * (Screen 10) und liegt zwischen `lg 20` und `xl 28` — bei 88 dp Kantenlaenge
   * wirkt `lg` eckig und `xl` schon wie ein Kreisausschnitt.
   */
  emptyIconRadius: 24,
} as const;

/**
 * Einziger erlaubter Schlagschatten: Bottom-Sheets, Kontextmenue, Toast und der
 * schwebende Aktionsbalken. Ueberall sonst entsteht Tiefe aus Flaeche + Linie.
 */
export const floatingShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: -8 },
  shadowOpacity: 0.45,
  shadowRadius: 32,
  elevation: 16,
} as const;

/** Feste Rahmenstaerken. */
export const hairline = 1;
export const focusRing = 2;
