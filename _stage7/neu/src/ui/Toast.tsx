/**
 * 16 · Toast.
 *
 * `bg/overlay`, `radius md`, 1 px `border/strong`, Hoehe 56, Icon 20 links,
 * Text `body`, "Rueckgaengig" als Mint-Textbutton rechts. Standzeit 5 s.
 *
 * Der Toast ersetzt den Bestaetigungsdialog: Aktionen wirken sofort, die
 * Absicherung liegt im Rueckweg. Deshalb hat er den einzigen Schatten neben
 * Sheets, Menue und Viewer-Balken.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import {
  bg,
  border,
  duration,
  easingNative,
  floatingShadow,
  iconSize,
  radius,
  size,
  space,
  text as textColor,
} from '../theme';
import { useReduceMotion } from '../theme/useReduceMotion';
import { TextButton } from './Button';
import type { Icon } from './icons';
import { Text } from './Text';

/** Standzeit aus dem Komponenten-Inventar. */
export const TOAST_DURATION = 5000;

export interface ToastProps {
  message: string;
  icon?: Icon;
  /** In der Regel "Rueckgaengig". */
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Die reine Flaeche — ohne Ein- und Ausblenden, fuer Blatt 2a und Tests. */
export function ToastSurface({ message, icon: LeadingIcon, actionLabel, onAction, style }: ToastProps) {
  return (
    <View style={[styles.toast, style]} accessibilityRole="alert" accessibilityLabel={message}>
      {LeadingIcon ? (
        <LeadingIcon size={iconSize.md} color={textColor.secondary} weight="regular" />
      ) : null}
      <Text variant="body" style={styles.message} numberOfLines={1}>
        {message}
      </Text>
      {actionLabel ? (
        <TextButton label={actionLabel} onPress={onAction} compact style={styles.action} />
      ) : null}
    </View>
  );
}

export interface ToastHostProps extends ToastProps {
  visible: boolean;
  onHide?: () => void;
  /** Standzeit in ms; 0 haelt den Toast offen. */
  autoHideAfter?: number;
}

/**
 * Blendet den Toast ueber der Tab-Bar ein. Die Bewegung ist eine reine
 * Deckkraft-Aenderung — ein Hineinschieben wuerde die Liste darunter
 * scheinbar verschieben.
 */
export function Toast({
  visible,
  onHide,
  autoHideAfter = TOAST_DURATION,
  style,
  ...rest
}: ToastHostProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(visible ? 1 : 0);
    } else {
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? duration.standard : duration.exit,
        easing: visible ? easingNative.standard : easingNative.exit,
        useNativeDriver: true,
      }).start();
    }

    if (!visible || !autoHideAfter) return;
    const timer = setTimeout(() => onHide?.(), autoHideAfter);
    return () => clearTimeout(timer);
  }, [visible, autoHideAfter, onHide, opacity, reduceMotion]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.host, { opacity }, style]} pointerEvents="box-none">
      <ToastSurface {...rest} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: size.screenPadding,
    right: size.screenPadding,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space['12'],
    height: size.toastHeight,
    paddingLeft: size.screenPadding - 2,
    paddingRight: space['8'],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: border.strong,
    backgroundColor: bg.overlay,
    ...floatingShadow,
  },
  message: {
    flex: 1,
  },
  action: {
    height: size.toastActionHeight,
    paddingHorizontal: space['12'],
  },
});
