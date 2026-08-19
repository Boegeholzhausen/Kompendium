/**
 * 08 · Bottom-Sheet.
 *
 * `bg/overlay`, `radius xl` nur oben, 1 px `border/strong` oben, Schatten
 * `0 -8 32 rgba(0,0,0,0.45)` ueber einem Scrim von `rgba(0,0,0,0.55)`.
 * Griff 36 x 4 zentriert, Titelzeile `title` mit `x` als 48 x 48-Ziel rechts,
 * Innenabstand seitlich 16.
 *
 * Oeffnen federt (damping 22, stiffness 260), der Scrim blendet in 220 ms ein.
 * Schliessen ueber `x`, Scrim-Tap oder System-Zurueck.
 *
 * `SheetSurface` ist die reine Huelle ohne Modal — das Komponenten-Blatt zeigt
 * sie, und Screens, die ihr Sheet selbst positionieren, verwenden sie direkt.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  bg,
  border,
  duration,
  easingNative,
  floatingShadow,
  iconSize,
  overlay,
  radius,
  size,
  space,
  springSheet,
  text as textColor,
} from '../theme';
import { useReduceMotion } from '../theme/useReduceMotion';
import { X } from './icons';
import { PressableScale } from './press';
import { Text } from './Text';

export interface SheetSurfaceProps {
  title?: string;
  onClose?: () => void;
  children?: React.ReactNode;
  /**
   * Steht ausserhalb des scrollenden Bereichs — dort gehoert alles hin, was
   * nie unter den Daumen rutschen darf (etwa "In den Papierkorb").
   */
  footer?: React.ReactNode;
  /** Ohne Griff, wenn das Sheet nicht zu wischen ist. */
  handle?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SheetSurface({
  title,
  onClose,
  children,
  footer,
  handle = true,
  style,
}: SheetSurfaceProps) {
  return (
    <View style={[styles.surface, style]}>
      {handle ? (
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>
      ) : null}

      {title ? (
        <View style={styles.titleRow}>
          <Text variant="title" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {onClose ? (
            <PressableScale
              style={styles.closeTarget}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Schliessen"
            >
              <X size={iconSize.md} color={textColor.secondary} weight="regular" />
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      {children}
      {footer}
    </View>
  );
}

export interface BottomSheetProps extends SheetSurfaceProps {
  visible: boolean;
  /** Feste Hoehe, etwa 75 % fuer das Info-Sheet. Ohne Angabe waechst das Sheet mit dem Inhalt. */
  height?: number;
}

export function BottomSheet({ visible, height, onClose, style, ...rest }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    if (visible) {
      Animated.spring(progress, {
        toValue: 1,
        damping: springSheet.damping,
        stiffness: springSheet.stiffness,
        mass: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: duration.exit,
        easing: easingNative.exit,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, progress, reduceMotion]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight || size.listBottomPadding, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: progress }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Sheet schliessen"
          />
        </Animated.View>

        <Animated.View
          style={[styles.sheet, { transform: [{ translateY }] }]}
          onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
        >
          <SheetSurface
            {...rest}
            onClose={onClose}
            style={[
              height !== undefined ? { height } : null,
              { paddingBottom: insets.bottom + size.screenPadding },
              style,
            ]}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Dieselbe Huelle, aber als Ebene **innerhalb** eines Screens statt als Modal.
 *
 * Der Viewer braucht das: "Das Suchen-Sheet legt sich ueber das Info-Sheet,
 * ersetzt es nicht." Zwei gestapelte Modals lassen ihre Reihenfolge nicht
 * zuverlaessig steuern, und der Toast muesste ueber beiden liegen — ueber
 * Modal-Grenzen hinweg geht das nicht. Als absolute Ebenen im selben Screen
 * ist die Reihenfolge schlicht die Reihenfolge im JSX.
 *
 * Die Ebene bleibt waehrend des Ausblendens montiert und verschwindet erst
 * danach, sonst wirkt das Schliessen abgeschnitten.
 */
export interface SheetLayerProps extends SheetSurfaceProps {
  visible: boolean;
  /** Feste Hoehe, etwa 75 % fuer das Info-Sheet. */
  height?: number;
}

export function SheetLayer({ visible, height, onClose, style, ...rest }: SheetLayerProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);

    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      if (!visible) setMounted(false);
      return;
    }

    if (visible) {
      Animated.spring(progress, {
        toValue: 1,
        damping: springSheet.damping,
        stiffness: springSheet.stiffness,
        mass: 1,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: duration.exit,
        easing: easingNative.exit,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress, reduceMotion]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight || size.listBottomPadding, 0],
  });

  if (!mounted) return null;

  return (
    <View style={styles.layer} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.scrim, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Sheet schliessen"
        />
      </Animated.View>

      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
        onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
      >
        <SheetSurface
          {...rest}
          onClose={onClose}
          style={[
            height !== undefined ? { height } : null,
            { paddingBottom: insets.bottom + size.screenPadding },
            style,
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: overlay.scrim,
  },
  sheet: {
    width: '100%',
  },
  surface: {
    backgroundColor: bg.overlay,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 1,
    borderTopColor: border.strong,
    paddingHorizontal: size.screenPadding,
    paddingBottom: size.screenPadding,
    ...floatingShadow,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: space['12'],
    paddingBottom: space['12'],
  },
  handle: {
    width: size.sheetHandleWidth,
    height: size.sheetHandleHeight,
    borderRadius: radius.pill,
    backgroundColor: border.strong,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: space['12'],
  },
  title: {
    flex: 1,
  },
  closeTarget: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
    // Zieht das Ziel bis an den Seitenrand, ohne den Titel zu verschieben.
    marginRight: -space['12'],
    marginVertical: -space['12'],
  },
});
