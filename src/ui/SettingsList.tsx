/**
 * Die gruppierte Liste der Einstellungen (Blaetter `3i` und `6b`).
 *
 * Gruppen sind `bg/surface`-Bloecke mit `radius md` und 1 px `border/subtle`,
 * innen durch dieselbe Linie getrennt; Zeilenhoehe 56, Innenabstand 14,
 * Gruppenueberschrift als `overline`.
 *
 * Drei Formen von Zeile, mehr braucht es nicht:
 *
 *   navigation   Beschriftung, optional ein Wert, `caret-right`
 *   action       Beschriftung in `accent` — "Jetzt synchronisieren",
 *                "Cache leeren". Aktionen sind Mint-**Text**, keine Buttons,
 *                damit die Liste eine Liste bleibt.
 *   static       nicht bedienbar, alles in `text/tertiary`. Das Blatt verlangt
 *                sie ausdruecklich fuer "Farbschema / Dunkel — einziger
 *                Modus": niemand soll einen Schalter suchen, den es nicht gibt.
 *
 * Alles andere — Schalter, Segmente, Regler — steht als `right` bzw. `below`
 * in der Zeile. Wo gar keine Beschriftung gebraucht wird (der Speicherbalken
 * traegt seine Zahlen selbst), nimmt `SettingsBlock` den Inhalt auf: eine
 * Zeile mit leerem Text haette dort nur eine leere Zeile Hoehe erzeugt.
 *
 * Diese Datei kennt keine Einstellung, nur ihre Form.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, border, radius, size, space, text as textColor } from '../theme';
import { CaretRight, type Icon } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface SettingsGroupProps {
  /** Gruppenueberschrift; drei Einzelziele brauchen keine drei Ueberschriften. */
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SettingsGroup({ title, children, style }: SettingsGroupProps) {
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={style}>
      {title ? (
        <Text variant="overline" tone="tertiary" style={styles.groupTitle}>
          {title}
        </Text>
      ) : null}
      <View style={styles.group}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.divider} /> : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Freier Inhalt innerhalb der Gruppenflaeche, mit demselben Innenabstand. */
export function SettingsBlock({ children }: { children: React.ReactNode }) {
  return <View style={styles.block}>{children}</View>;
}

export interface SettingsRowProps {
  label: string;
  /** Zweite Zeile unter der Beschriftung. */
  note?: string;
  /** Wert am rechten Rand, etwa "12" oder "110 %". */
  value?: string;
  icon?: Icon;
  /** Eigene Farbe fuer das Icon — die Statuszeile faerbt es nach Zustand. */
  iconColor?: string;
  /** Mint-Textzeile statt Beschriftung in `text/primary`. */
  action?: boolean;
  /** Nicht bedienbar — alles in `text/tertiary`, kein Chevron. */
  inert?: boolean;
  chevron?: boolean;
  /** Schalter oder Segment am rechten Rand. */
  right?: React.ReactNode;
  /** Regler oder Vorschau unter der Zeile, innerhalb derselben Flaeche. */
  below?: React.ReactNode;
  onPress?: () => void;
}

export function SettingsRow({
  label,
  note,
  value,
  icon: LeadingIcon,
  iconColor,
  action = false,
  inert = false,
  chevron = false,
  right,
  below,
  onPress,
}: SettingsRowProps) {
  const tint = inert ? textColor.tertiary : action ? accent.base : textColor.primary;

  const body = (
    <>
      <View style={styles.row}>
        {LeadingIcon ? (
          <LeadingIcon
            size={20}
            color={iconColor ?? tint}
            weight={iconColor === undefined ? 'regular' : 'fill'}
          />
        ) : null}
        <View style={styles.labels}>
          <Text variant="body" numberOfLines={1} style={{ color: tint }}>
            {label}
          </Text>
          {note ? (
            <Text variant="caption" tone={inert ? 'tertiary' : 'secondary'} numberOfLines={2}>
              {note}
            </Text>
          ) : null}
        </View>
        {value ? (
          <Text variant="body" tone={inert ? 'tertiary' : 'secondary'} numeric>
            {value}
          </Text>
        ) : null}
        {right}
        {chevron && !inert ? (
          <CaretRight size={18} color={textColor.tertiary} weight="regular" />
        ) : null}
      </View>
      {below ? <View style={styles.below}>{below}</View> : null}
    </>
  );

  if (onPress === undefined || inert) {
    return <View style={styles.static}>{body}</View>;
  }

  return (
    <PressableScale
      style={styles.static}
      pressedStyle={styles.pressed}
      scaleOnPress={false}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={note ? `${label}. ${note}` : label}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    marginBottom: space['8'],
    paddingHorizontal: space['4'],
  },
  group: {
    backgroundColor: bg.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: border.subtle,
    overflow: 'hidden',
  },
  static: {
    paddingHorizontal: size.cardPadding,
    paddingVertical: space['8'],
  },
  block: {
    paddingHorizontal: size.cardPadding,
    paddingVertical: size.cardPadding,
  },
  pressed: {
    backgroundColor: bg.raised,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    // 56 abzueglich der 8 oben und unten aus `static` — die Zeile bleibt bei
    // 56, waechst aber mit einer zweiten Textzeile mit.
    minHeight: size.settingsRowHeight - 2 * space['8'],
  },
  labels: {
    flex: 1,
    gap: space['2'],
  },
  below: {
    paddingBottom: space['8'],
  },
  divider: {
    height: 1,
    backgroundColor: border.subtle,
    marginLeft: size.cardPadding,
  },
});
