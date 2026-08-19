/**
 * Die Bedienung des Viewers: Kopfzeile oben, schwebender Aktionsbalken unten
 * (Blaetter `2b` und `2c`).
 *
 * Beide liegen ueber dem Dokument, nicht darin — das Dokument bringt seine
 * eigene Farbwelt mit, deshalb Blur statt Flaeche. Und beide verschwinden
 * beim Runterscrollen **vollstaendig**: eine halbtransparente Restleiste
 * ueber einem hellen Dokument waere ein dunkler Streifen, der bleibt.
 *
 * Weil sie schweben, aendert das Ein- und Ausblenden kein Layout: die Flaechen
 * fahren aus dem Bild und werden dabei durchsichtig.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

import {
  accent,
  blurIntensity,
  border,
  duration,
  easingNative,
  floatingShadow,
  iconSize,
  overlay,
  radius,
  size,
  space,
  text as textColor,
} from '../../theme';
import { useReduceMotion } from '../../theme/useReduceMotion';
import {
  Archive,
  ArrowLeft,
  DotsThreeVertical,
  Info,
  ShareNetwork,
  Star,
  type Icon,
} from '../../ui/icons';
import { PressableScale } from '../../ui/press';
import { Text } from '../../ui/Text';
import { ACTION_BAR_WIDTH, HEADER_ROW } from './metrics';

interface ChromeProps {
  visible: boolean;
  children: React.ReactNode;
  /** Fahrtrichtung beim Verschwinden. */
  direction: 'up' | 'down';
  distance: number;
  style?: React.ComponentProps<typeof Animated.View>['style'];
}

/** Gemeinsames Ein- und Ausblenden: Standard herein, `exit` hinaus. */
function ChromeLayer({ visible, children, direction, distance, style }: ChromeProps) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? duration.standard : duration.exit,
      easing: visible ? easingNative.standard : easingNative.exit,
      useNativeDriver: true,
    }).start();
  }, [visible, progress, reduceMotion]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [direction === 'up' ? -distance : distance, 0],
  });

  return (
    <Animated.View
      style={[style, { opacity: progress, transform: [{ translateY }] }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {children}
    </Animated.View>
  );
}

export interface ViewerHeaderProps {
  title: string;
  visible: boolean;
  top: number;
  onBack: () => void;
  onOverflow: () => void;
}

/**
 * Kopfzeile: 80 hoch inklusive Statusleiste, `rgba(14,16,18,0.72)` mit Blur 14
 * und 1 px Trennlinie unten. Titel einzeilig mit Ellipse — zwei Zeilen wuerden
 * die Hoehe springen lassen, sobald ein Dokument einen langen Namen hat.
 */
export function ViewerHeader({ title, visible, top, onBack, onOverflow }: ViewerHeaderProps) {
  return (
    <ChromeLayer visible={visible} direction="up" distance={top + HEADER_ROW} style={styles.header}>
      <BlurView intensity={blurIntensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[styles.headerTint, { paddingTop: top }]}>
        <View style={styles.headerRow}>
          <PressableScale
            style={styles.headerTarget}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Zurueck zur Bibliothek"
          >
            <ArrowLeft size={iconSize.lg} color={textColor.primary} weight="regular" />
          </PressableScale>

          <Text variant="title" numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>

          <PressableScale
            style={styles.headerTarget}
            onPress={onOverflow}
            accessibilityRole="button"
            accessibilityLabel="Weitere Aktionen"
          >
            <DotsThreeVertical size={iconSize.lg} color={textColor.primary} weight="regular" />
          </PressableScale>
        </View>
      </View>
    </ChromeLayer>
  );
}

interface ActionProps {
  icon: Icon;
  label: string;
  active?: boolean;
  onPress: () => void;
}

function BarAction({ icon: ActionIcon, label, active = false, onPress }: ActionProps) {
  const tint = active ? accent.base : textColor.primary;
  return (
    <PressableScale
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <ActionIcon size={22} color={tint} weight={active ? 'fill' : 'regular'} />
      <Text variant="labelSm" tone={active ? 'accent' : 'secondary'}>
        {label}
      </Text>
    </PressableScale>
  );
}

export interface ViewerActionBarProps {
  visible: boolean;
  bottom: number;
  favorite: boolean;
  onToggleFavorite: () => void;
  onArchive: () => void;
  /** Zustand der zweiten Achse — die Spalte zeigt ihn wie der Favorit an. */
  archived: boolean;
  onShare: () => void;
  onInfo: () => void;
}

/**
 * Schwebender Aktionsbalken: Hoehe 60, `radius pill`, 16 ueber der Safe Area
 * zentriert. Vier Spalten zu 64 — Favorit, Archiv, Teilen, Info.
 *
 * Die Beschriftungen unter den Icons sind eine Abweichung vom sonst
 * icon-only-Muster und ausdruecklich gewollt: vier Symbole ohne Text sind im
 * Dunkeln Ratearbeit. Favorit zeigt seinen Zustand doppelt — gefuellter Stern
 * **und** Mint, nie Farbe allein.
 */
export function ViewerActionBar({
  visible,
  bottom,
  favorite,
  onToggleFavorite,
  onArchive,
  archived,
  onShare,
  onInfo,
}: ViewerActionBarProps) {
  return (
    <ChromeLayer
      visible={visible}
      direction="down"
      distance={bottom + size.viewerActionBarHeight}
      style={[styles.bar, { bottom }]}
    >
      <BlurView intensity={blurIntensity} tint="dark" style={styles.barBlur} />
      <View style={styles.barRow}>
        <BarAction
          icon={Star}
          label="Favorit"
          active={favorite}
          onPress={onToggleFavorite}
        />
        <BarAction icon={Archive} label="Archiv" active={archived} onPress={onArchive} />
        <BarAction icon={ShareNetwork} label="Teilen" onPress={onShare} />
        <BarAction icon={Info} label="Info" onPress={onInfo} />
      </View>
    </ChromeLayer>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    // Der Blur liegt darunter; die Kante ist die einzige Linie.
    borderBottomWidth: 1,
    borderBottomColor: overlay.viewerHeaderBorder,
    overflow: 'hidden',
  },
  headerTint: {
    backgroundColor: overlay.viewerHeader,
  },
  headerRow: {
    height: HEADER_ROW,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTarget: {
    width: size.touchTarget,
    height: size.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
  },
  bar: {
    position: 'absolute',
    alignSelf: 'center',
    width: ACTION_BAR_WIDTH,
    height: size.viewerActionBarHeight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: border.strong,
    backgroundColor: overlay.viewerActionBar,
    overflow: 'hidden',
    ...floatingShadow,
  },
  barBlur: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    // Der Blur darf die Pille nicht ueberlaufen.
    borderRadius: radius.pill,
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: space['8'],
  },
  action: {
    width: size.viewerActionBarColumn,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['2'],
  },
});
