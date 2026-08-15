/**
 * Masse des Bibliothek-Kopfs.
 *
 * Der kollabierende Header hat eine Eigenschaft, die man nur mit Zahlen
 * hinbekommt: die Filterleiste muss beim Scrollen exakt so schnell nach oben
 * wandern wie der Inhalt, bis sie oben klebt — sonst rutscht sie sichtbar
 * gegen die Liste. Deshalb stehen alle Hoehen hier einmal beisammen und werden
 * sowohl vom schwebenden Kopf als auch vom Platzhalter im Inhalt benutzt.
 *
 * Alle Werte sind aus den Tokens gerechnet.
 */
import { size, space } from '../../theme';

/** Kopfzeile ausgeklappt: 8 oben + 48 Beruehrungsflaeche + 12 unten. */
export const TITLE_BAR_EXPANDED = space['8'] + size.touchTarget + space['12'];

/** Kopfzeile kollabiert — 56 aus dem Handoff-Dokument. */
export const TITLE_BAR_COLLAPSED = size.headerCompactHeight;

/** Suchfeld mit seinem Abstand nach oben. */
export const SEARCH_BLOCK = size.screenPadding + size.searchFieldHeight;

/** Abstand zwischen Suchfeld und Filterleiste. */
export const CHIPS_GAP = space['12'];

/**
 * Innenabstand der Filterleiste. Oben bleibt er in beiden Zustaenden gleich —
 * sonst huepfen die Chips beim Umschalten von 40 auf 36 zusaetzlich nach oben.
 * Unten waechst er, damit die geklebte Leiste wie auf Blatt `1d` Luft ueber
 * ihrer Trennlinie hat.
 */
export const CHIPS_PAD_TOP = space['4'];
export const CHIPS_PAD_BOTTOM_EXPANDED = space['4'];
export const CHIPS_PAD_BOTTOM_COLLAPSED = space['8'] + space['2'];

/** Platzhalter im Inhalt, den die schwebende Filterleiste ueberdeckt. */
export const CHIPS_SPACER =
  CHIPS_GAP + CHIPS_PAD_TOP + size.filterChipHeight + CHIPS_PAD_BOTTOM_EXPANDED;

/** Ausgangsversatz der Filterleiste gegenueber ihrer geklebten Position. */
export const CHIPS_OFFSET = SEARCH_BLOCK + CHIPS_GAP;

/**
 * Scrollweg bis zum vollstaendig kollabierten Kopf.
 *
 * Er setzt sich aus Suchfeld samt Abstand und dem zusammen, was die Kopfzeile
 * selbst schrumpft. Nur mit dieser Summe stimmt die Rechnung: die Leiste sitzt
 * bei Fortschritt t auf
 *   (TITLE_BAR_EXPANDED - 12t) + Sync + CHIPS_OFFSET (1 - t)
 * und das ist fuer jedes t genau die Stelle, an der der mitgescrollte Inhalt
 * stuende. Die Leiste klebt also, ohne unterwegs zu springen.
 */
export const COLLAPSE_DISTANCE =
  CHIPS_OFFSET + (TITLE_BAR_EXPANDED - TITLE_BAR_COLLAPSED);

/** Oberer Innenabstand der Liste: Kopfzeile plus Sync-Leiste. */
export const CONTENT_TOP = TITLE_BAR_EXPANDED + size.syncIndicatorHeight;

/**
 * Was der Hinweisstreifen (Blatt `4c`) zusaetzlich braucht. Er ERSETZT die
 * 2-px-Leiste, ist also nicht 36 hoeher, sondern 34 — sonst rutschte die Liste
 * beim Offlinegehen um zwei Pixel zu weit nach unten.
 *
 * Der Kollaps-Weg bleibt unberuehrt: der Streifen sitzt unter der Kopfzeile
 * und schrumpft nicht mit, also wandert die Filterleiste weiterhin genau
 * `COLLAPSE_DISTANCE` weit.
 */
export const NOTICE_EXTRA = size.noticeStripHeight - size.syncIndicatorHeight;

/** Oberer Innenabstand der Liste, je nachdem ob ein Streifen steht. */
export function contentTop(hasNotice: boolean): number {
  return CONTENT_TOP + (hasNotice ? NOTICE_EXTRA : 0);
}

/**
 * Breite der Karten in der Sektion "Neu" (Blatt `1c`). Feste Breite, weil die
 * Karten waagerecht scrollen — die dritte ragt als Anschnitt in den Rand und
 * zeigt damit, dass es weitergeht.
 */
export const NEW_CARD_WIDTH = 148;
