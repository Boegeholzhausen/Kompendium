/**
 * Masse des Viewers.
 *
 * Die Kopfzeile ist auf Blatt `2b` 80 hoch — darin steckt die Statusleiste,
 * die in den Mockups als 28-dp-Platzhalter gezeichnet ist. Auf dem Geraet
 * liefert die Safe Area den echten Wert, also bleibt von den 80 die Zeile
 * selbst uebrig und der Rest kommt von oben dazu.
 */
import { size, space } from '../../theme';

/** Statusleiste, wie sie in den Mockups gezeichnet ist — nur Rechenhilfe. */
export const STATUS_BAR_PLACEHOLDER = space['24'] + space['4'];

/** Kopfzeile ohne Statusleiste: 80 minus die gezeichneten 28. */
export const HEADER_ROW = size.viewerHeaderHeight - STATUS_BAR_PLACEHOLDER;

/**
 * Der Aktionsbalken traegt vier Spalten zu 64 plus 8 Innenabstand links und
 * rechts — die Pille ist damit so breit wie ihr Inhalt und nicht breiter.
 */
export const ACTION_BAR_WIDTH = 4 * size.viewerActionBarColumn + 2 * space['8'];

/** Info-Sheet: "Hoehe 639 (etwa 75 %)" — als Anteil, damit es auf jedem Geraet passt. */
export const INFO_SHEET_RATIO = 0.75;

/**
 * Tag-Sheet: hoeher, weil darunter die Tastatur steht (Blatt `4e`, Schritt 4)
 * und Suchfeld, Trefferliste und die gesetzten Tags gleichzeitig sichtbar
 * bleiben muessen.
 */
export const TAG_SHEET_RATIO = 0.88;
