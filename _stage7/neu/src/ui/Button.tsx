/**
 * 10 · Primaerer Button · 11 · Sekundaerer Button · 12 · Textbutton.
 *
 * Pro Screen gibt es genau EINE primaere Aktion. Alles andere ist sekundaer
 * oder Text — die Regel steht in den Abnahmekriterien und ist der Grund, warum
 * der sekundaere Button hier gleichberechtigt ausgebaut ist.
 *
 * Deaktiviert ist ein Farbwechsel auf `text/tertiary`, nie Deckkraft.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { accent, bg, border, iconSize, radius, semantic, size, space, text as textColor } from '../theme';
import type { Icon } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

interface BaseButtonProps {
  label: string;
  icon?: Icon;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** 10 · Hoehe 52, `radius md`, Flaeche `accent`, Text in `on-accent`. */
export function PrimaryButton({ label, icon: LeadingIcon, disabled, onPress, style }: BaseButtonProps) {
  const tint = disabled ? textColor.tertiary : accent.on;

  return (
    <PressableScale
      style={[styles.button, disabled ? styles.primaryDisabled : styles.primary, style]}
      pressedStyle={styles.primaryPressed}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {LeadingIcon ? <LeadingIcon size={iconSize.md} color={tint} weight="regular" /> : null}
      <Text variant="button" style={{ color: tint }}>
        {label}
      </Text>
    </PressableScale>
  );
}

export interface SecondaryButtonProps extends BaseButtonProps {
  /** 44 statt 52 — fuer die kompakten Aktionszeilen im Ordner-Detail. */
  compact?: boolean;
  /** Unumkehrbare Aktion: Icon und Text in `danger`, die Flaeche bleibt neutral. */
  danger?: boolean;
}

/** 11 · Hoehe 52 (44 kompakt), `bg/raised`, 1 px `border/strong`. */
export function SecondaryButton({
  label,
  icon: LeadingIcon,
  disabled,
  compact = false,
  danger = false,
  onPress,
  style,
}: SecondaryButtonProps) {
  const tint = disabled ? textColor.tertiary : danger ? semantic.danger : textColor.primary;

  return (
    <PressableScale
      style={[
        styles.button,
        styles.secondary,
        compact && styles.buttonCompact,
        disabled && styles.secondaryDisabled,
        style,
      ]}
      pressedStyle={styles.secondaryPressed}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {/*
        Die kompakte Zeile traegt `label` 13/500 und ein 18er Icon (Blatt `3b`):
        zwei Aktionen nebeneinander muessen in 393 dp nebeneinander passen,
        ohne dass eine umbricht.
      */}
      {LeadingIcon ? (
        <LeadingIcon size={compact ? 18 : iconSize.md} color={tint} weight="regular" />
      ) : null}
      <Text variant={compact ? 'label' : 'button'} numberOfLines={1} style={{ color: tint }}>
        {label}
      </Text>
    </PressableScale>
  );
}

export interface TextButtonProps extends BaseButtonProps {
  /**
   * Ohne eigene 48-dp-Hoehe — nur dort erlaubt, wo die umgebende Zeile das
   * Beruehrungsziel bereits stellt (Sektionskopf, Toast).
   */
  compact?: boolean;
  danger?: boolean;
}

/** 12 · Nur Text in `accent`, `label`/600 13. Beruehrungsflaeche mindestens 48 hoch. */
export function TextButton({
  label,
  icon: LeadingIcon,
  disabled,
  compact = false,
  danger = false,
  onPress,
  style,
}: TextButtonProps) {
  const tint = disabled ? textColor.tertiary : danger ? semantic.danger : accent.base;

  return (
    <PressableScale
      style={[styles.textButton, !compact && styles.textButtonTall, style]}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      // Auch die kompakte Variante bleibt mit 48 dp treffbar.
      hitSlop={compact ? space['12'] : undefined}
    >
      {LeadingIcon ? <LeadingIcon size={iconSize.sm} color={tint} weight="regular" /> : null}
      <Text variant="labelStrong" style={{ color: tint }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * Sekundaere Pille — Hoehe 40, `radius pill`, sonst wie der sekundaere Button.
 *
 * Keine eigene Nummer im Inventar, aber in Screen 11 genau beschrieben:
 * "+ Neuer Tag" sitzt als sekundaere Pille im Kopf, nicht als FAB — Tags
 * entstehen beim Zuweisen, und ein Mint-FAB gaebe diesem Screen falsches
 * Gewicht. Die 40 kommen ueber hitSlop auf die geforderten 48, ohne die
 * Kopfzeile hoeher zu machen.
 */
export function PillButton({ label, icon: LeadingIcon, disabled, onPress, style }: BaseButtonProps) {
  const tint = disabled ? textColor.tertiary : textColor.primary;

  return (
    <PressableScale
      style={[styles.pill, style]}
      pressedStyle={styles.secondaryPressed}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={{
        top: (size.touchTarget - size.filterChipHeight) / 2,
        bottom: (size.touchTarget - size.filterChipHeight) / 2,
      }}
    >
      {LeadingIcon ? <LeadingIcon size={iconSize.sm} color={tint} weight="regular" /> : null}
      <Text variant="label" style={{ color: tint }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * Zweier- oder Dreier-Segment (Darstellung, Ordner-Detail).
 * Aktiv: `accent/surface` + `accent/border` + `fill`-Icon.
 */
export interface SegmentOption {
  key: string;
  label: string;
  icon?: Icon;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  style,
}: {
  options: SegmentOption[];
  value: string;
  onChange?: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segmentGroup, style]}>
      {options.map((option) => {
        const isActive = option.key === value;
        const tint = isActive ? accent.base : textColor.secondary;
        const OptionIcon = option.icon;
        return (
          <PressableScale
            key={option.key}
            style={[styles.segment, isActive ? styles.segmentActive : styles.segmentIdle]}
            pressedStyle={styles.segmentPressed}
            onPress={() => onChange?.(option.key)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isActive }}
          >
            {OptionIcon ? (
              <OptionIcon size={iconSize.md} color={tint} weight={isActive ? 'fill' : 'regular'} />
            ) : null}
            <Text variant="label" style={{ color: tint }}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['8'],
    height: size.buttonHeight,
    borderRadius: radius.md,
    paddingHorizontal: size.screenPadding,
    // Der Rahmen ist immer da, im gefuellten Zustand nur durchsichtig — sonst
    // waechst der Button beim Deaktivieren um 2.
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonCompact: {
    height: size.buttonHeightCompact,
  },
  primary: {
    backgroundColor: accent.base,
  },
  primaryPressed: {
    backgroundColor: accent.pressed,
  },
  primaryDisabled: {
    backgroundColor: bg.raised,
    borderColor: border.subtle,
  },
  secondary: {
    backgroundColor: bg.raised,
    borderColor: border.strong,
  },
  secondaryPressed: {
    backgroundColor: bg.overlay,
  },
  secondaryDisabled: {
    borderColor: border.subtle,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['4'] + space['2'],
    height: size.filterChipHeight,
    paddingHorizontal: size.cardPadding,
    borderRadius: radius.pill,
    backgroundColor: bg.raised,
    borderWidth: 1,
    borderColor: border.strong,
  },
  textButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['4'] + space['2'],
  },
  textButtonTall: {
    minHeight: size.touchTarget,
    paddingHorizontal: space['4'],
  },
  segmentGroup: {
    flexDirection: 'row',
    gap: space['8'],
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['8'],
    height: size.buttonHeightCompact,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  segmentIdle: {
    backgroundColor: bg.raised,
    borderColor: border.subtle,
  },
  segmentActive: {
    backgroundColor: accent.surface,
    borderColor: accent.border,
  },
  segmentPressed: {
    backgroundColor: bg.overlay,
    borderColor: border.strong,
  },
});
