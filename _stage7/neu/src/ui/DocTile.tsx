/**
 * DocTile — die generierte Vorschau eines Dokuments.
 *
 * Aufbau in drei Schichten:
 *   1. Verlauf, Farbton deterministisch aus der Dokument-ID
 *   2. abstraktes Muster des erkannten Dokumenttyps
 *   3. Typ-Icon unten links (nur in der grossen Variante)
 *
 * Zwei Groessen:
 *   `row`  — 44 x 44 fuer Listenzeilen, ohne Typ-Icon: es kollidiert bei dieser
 *            Groesse mit dem Muster. Muster und Innenabstaende sind kleiner,
 *            die Deckkraft dafuer leicht erhoeht.
 *   `card` — 16:10 fuer Karten und Ergebnislisten, mit Typ-Icon.
 *
 * Verlauf und Muster liegen in EINEM SVG mit fester viewBox (160x100 bzw.
 * 44x44). Damit skaliert die Kachel exakt mit ihrer Breite — anders als eine
 * Komposition aus Views mit Prozenthoehen, die in einer Box mit aspectRatio
 * nicht zuverlaessig aufloest.
 *
 * Die Zahlen in TILE_SPEC sind aus dem Design-Prototyp (Blatt 1b) in die
 * viewBox umgerechnet. Sie sind Binnengeometrie der Kachel und folgen deshalb
 * nicht der Abstands-Skala der App.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { border, radius, size, text as textColor } from '../theme';
import {
  hueFromId,
  patternColor,
  tileGradient,
  tileGradientEnd,
  tileGradientStart,
  type DocType,
  type TileState,
} from '../theme/tile';
import { Article, Calculator, ChartBar, ListDashes, Table } from './icons';

export type DocTileVariant = 'row' | 'card';

export interface DocTileProps {
  /** Dokument-ID — bestimmt den Farbton. */
  id: string;
  /** Beim Import erkannter Typ — bestimmt das Muster. */
  type: DocType;
  variant?: DocTileVariant;
  state?: TileState;
  /** Typ-Icon in der grossen Variante: 16 auf dem Kachelblatt, 14 auf der Karte. */
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}

const typeIcon = {
  table: Table,
  chart: ChartBar,
  text: Article,
  calculator: Calculator,
  list: ListDashes,
} as const;

const TILE_SPEC = {
  card: {
    width: 160,
    height: 100,
    table: {
      columns: [30.4, 61.8, 93.1, 124.5, 155.8],
      columnWidth: 1,
      rows: [22, 45, 68, 91],
      rowHeight: 1,
      lineAlpha: 0.16,
      headerHeight: 22,
      headerAlpha: 0.09,
    },
    chart: {
      x: 14,
      width: 132,
      baselineY: 74,
      areaHeight: 58,
      bars: [38, 64, 48, 88, 56, 72],
      gap: 5,
      barAlpha: 0.22,
      barRadius: 2,
      baselineAlpha: 0.2,
    },
    body: {
      x: 14,
      width: 132,
      top: 16,
      gap: 6,
      heading: { height: 4, widthRatio: 0.42, alpha: 0.3, radius: 2 },
      lineHeight: 2,
      lineAlpha: 0.17,
      lineRatios: [1, 0.94, 1, 0.66],
    },
    calculator: {
      x: 35.2,
      width: 89.6,
      top: 14,
      height: 60,
      gap: 4,
      displayHeight: 8,
      displayAlpha: 0.26,
      keyAlpha: 0.16,
      cornerRadius: 2,
    },
    list: {
      x: 16,
      width: 128,
      top: 18,
      rowGap: 9,
      rows: 4,
      dotRadius: 2,
      dotAlpha: 0.34,
      dotGap: 8,
      lineHeight: 2,
      lineAlpha: 0.17,
      lastLineRatio: 0.6,
    },
  },
  row: {
    width: 44,
    height: 44,
    table: {
      columns: [10.6, 21.8, 33],
      columnWidth: 0.7,
      rows: [11.9, 24.6, 37.4],
      rowHeight: 0.9,
      lineAlpha: 0.18,
      headerHeight: 11.9,
      headerAlpha: 0.1,
    },
    chart: {
      x: 7,
      width: 30,
      baselineY: 35,
      areaHeight: 25,
      bars: [40, 70, 52, 90],
      gap: 2,
      barAlpha: 0.24,
      barRadius: 1,
      baselineAlpha: null,
    },
    body: {
      x: 8,
      width: 28,
      top: 10,
      gap: 4,
      heading: { height: 3, widthRatio: 0.6, alpha: 0.32, radius: 2 },
      lineHeight: 2,
      lineAlpha: 0.18,
      lineRatios: [1, 0.88, 0.7],
    },
    calculator: {
      x: 11,
      width: 22,
      top: 9,
      height: 26,
      gap: 2,
      displayHeight: 5,
      displayAlpha: 0.28,
      keyAlpha: 0.18,
      cornerRadius: 1,
    },
    list: {
      x: 8,
      width: 28,
      top: 11,
      rowGap: 6,
      rows: 3,
      dotRadius: 1.5,
      dotAlpha: 0.36,
      dotGap: 5,
      lineHeight: 2,
      lineAlpha: 0.18,
      lastLineRatio: null,
    },
  },
} as const;

type PatternProps = { variant: DocTileVariant; state: TileState };

function TablePattern({ variant, state }: PatternProps) {
  const box = TILE_SPEC[variant];
  const spec = box.table;
  const line = patternColor(spec.lineAlpha, state);

  return (
    <>
      <Rect
        x={0}
        y={0}
        width={box.width}
        height={spec.headerHeight}
        fill={patternColor(spec.headerAlpha, state)}
      />
      {spec.columns.map((x) => (
        <Rect key={`c${x}`} x={x} y={0} width={spec.columnWidth} height={box.height} fill={line} />
      ))}
      {spec.rows.map((y) => (
        <Rect key={`r${y}`} x={0} y={y} width={box.width} height={spec.rowHeight} fill={line} />
      ))}
    </>
  );
}

function ChartPattern({ variant, state }: PatternProps) {
  const spec = TILE_SPEC[variant].chart;
  const barWidth = (spec.width - spec.gap * (spec.bars.length - 1)) / spec.bars.length;
  const fill = patternColor(spec.barAlpha, state);

  return (
    <>
      {spec.bars.map((percent, index) => {
        const height = (percent / 100) * spec.areaHeight;
        return (
          <Rect
            key={index}
            x={spec.x + index * (barWidth + spec.gap)}
            y={spec.baselineY - height}
            width={barWidth}
            height={height}
            rx={spec.barRadius}
            fill={fill}
          />
        );
      })}
      {spec.baselineAlpha !== null ? (
        <Rect
          x={spec.x}
          y={spec.baselineY}
          width={spec.width}
          height={1}
          fill={patternColor(spec.baselineAlpha, state)}
        />
      ) : null}
    </>
  );
}

function BodyPattern({ variant, state }: PatternProps) {
  const spec = TILE_SPEC[variant].body;
  let y = spec.top;

  return (
    <>
      <Rect
        x={spec.x}
        y={y}
        width={spec.width * spec.heading.widthRatio}
        height={spec.heading.height}
        rx={spec.heading.radius}
        fill={patternColor(spec.heading.alpha, state)}
      />
      {spec.lineRatios.map((ratio, index) => {
        y += (index === 0 ? spec.heading.height : spec.lineHeight) + spec.gap;
        return (
          <Rect
            key={index}
            x={spec.x}
            y={y}
            width={spec.width * ratio}
            height={spec.lineHeight}
            fill={patternColor(spec.lineAlpha, state)}
          />
        );
      })}
    </>
  );
}

function CalculatorPattern({ variant, state }: PatternProps) {
  const spec = TILE_SPEC[variant].calculator;
  // Anzeigefeld, darunter ein 3x3-Tastenraster; vier Abstaende dazwischen.
  const keyHeight = (spec.height - spec.displayHeight - spec.gap * 3) / 3;
  const keyWidth = (spec.width - spec.gap * 2) / 3;
  const gridTop = spec.top + spec.displayHeight + spec.gap;
  const fill = patternColor(spec.keyAlpha, state);

  return (
    <>
      <Rect
        x={spec.x}
        y={spec.top}
        width={spec.width}
        height={spec.displayHeight}
        rx={spec.cornerRadius}
        fill={patternColor(spec.displayAlpha, state)}
      />
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((column) => (
          <Rect
            key={`${row}-${column}`}
            x={spec.x + column * (keyWidth + spec.gap)}
            y={gridTop + row * (keyHeight + spec.gap)}
            width={keyWidth}
            height={keyHeight}
            rx={spec.cornerRadius}
            fill={fill}
          />
        ))
      )}
    </>
  );
}

function ListPattern({ variant, state }: PatternProps) {
  const spec = TILE_SPEC[variant].list;
  const rowHeight = spec.dotRadius * 2;
  const lineX = spec.x + rowHeight + spec.dotGap;
  const lineWidth = spec.width - rowHeight - spec.dotGap;
  const dot = patternColor(spec.dotAlpha, state);
  const line = patternColor(spec.lineAlpha, state);

  return (
    <>
      {Array.from({ length: spec.rows }, (_, index) => {
        const top = spec.top + index * (rowHeight + spec.rowGap);
        const isLast = index === spec.rows - 1;
        const width = isLast && spec.lastLineRatio ? lineWidth * spec.lastLineRatio : lineWidth;
        return (
          <React.Fragment key={index}>
            <Circle
              cx={spec.x + spec.dotRadius}
              cy={top + spec.dotRadius}
              r={spec.dotRadius}
              fill={dot}
            />
            <Rect
              x={lineX}
              y={top + (rowHeight - spec.lineHeight) / 2}
              width={width}
              height={spec.lineHeight}
              fill={line}
            />
          </React.Fragment>
        );
      })}
    </>
  );
}

const patterns = {
  table: TablePattern,
  chart: ChartPattern,
  text: BodyPattern,
  calculator: CalculatorPattern,
  list: ListPattern,
} as const;

export function DocTile({
  id,
  type,
  variant = 'row',
  state = 'default',
  iconSize = 16,
  style,
}: DocTileProps) {
  const Pattern = patterns[type];
  const Icon = typeIcon[type];
  const box = TILE_SPEC[variant];
  const [from, to] = tileGradient(id, state);
  // Verlaufs-Ausweise sind im Dokument global. Farbton und Zustand gehoeren
  // deshalb in den Namen, sonst teilen sich alle Kacheln denselben Verlauf.
  const gradientId = `tile-${variant}-${hueFromId(id)}-${state}`;

  return (
    <View
      style={[variant === 'row' ? styles.rowTile : styles.cardTile, style]}
      // Die Kachel ist Dekoration; die Vorlesefunktion nimmt den Titel der Zeile.
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${box.width} ${box.height}`}>
        <Defs>
          <LinearGradient
            id={gradientId}
            x1={tileGradientStart.x}
            y1={tileGradientStart.y}
            x2={tileGradientEnd.x}
            y2={tileGradientEnd.y}
          >
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={box.width} height={box.height} fill={`url(#${gradientId})`} />
        <Pattern variant={variant} state={state} />
      </Svg>
      {variant === 'card' ? (
        <Icon size={iconSize} color={textColor.secondary} weight="regular" style={styles.icon} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowTile: {
    width: size.tileSmall,
    height: size.tileSmall,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: border.subtle,
    overflow: 'hidden',
  },
  cardTile: {
    width: '100%',
    aspectRatio: size.tileAspect,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: border.subtle,
    overflow: 'hidden',
  },
  icon: {
    position: 'absolute',
    left: 10,
    bottom: 8,
  },
});
