import { DEPTH_BINS } from '../bathymetry/depth-classes';
import { LAYERS } from '../color/layer-catalog';
import { inkFor } from '../color/lut';
import { colorAt, PALETTES } from '../color/palettes';
import type { FieldLayer, FieldUnit, HeightUnit, Ink, LayerId, Rgb, UnitSettings } from '../models';
import { FEET_PER_METER, HEIGHT_FACTORS, SPEED_FACTORS, SPEED_LABELS } from '../units/conversions';
import { LEGEND_TICKS } from './legend-ticks';

/** One labelled cell of the legend bar, shaded from `from` to `to`. */
export interface LegendCell {
  readonly label: string;
  readonly from: Rgb;
  readonly to: Rgb;
  /** Text colour that reads well on `from`. */
  readonly ink: Ink;
}

export interface LegendSpec {
  /** `gradient` cells blend into the next tick; `classes` cells are solid depth bands. */
  readonly kind: 'gradient' | 'classes';
  readonly unit: string;
  readonly cells: readonly LegendCell[];
}

interface TickScale {
  readonly ticks: readonly number[];
  readonly unitLabel: string;
  /** Multiply a native value by this to get the display unit. */
  readonly factor: number;
}

/** The legend for a map layer in the user's units. */
export function legendSpec(layerId: LayerId, units: UnitSettings): LegendSpec {
  const layer = LAYERS[layerId];
  return layer.kind === 'depth' ? depthLegend(units.height) : fieldLegend(layer, units);
}

/** Each depth band labelled with its shallow edge. */
function depthLegend(unit: HeightUnit): LegendSpec {
  return {
    kind: 'classes',
    unit,
    cells: DEPTH_BINS.map(({ min, color }) => ({
      label: String(unit === 'ft' ? Math.round(min * FEET_PER_METER) : min),
      from: color,
      to: color,
      ink: inkFor(color),
    })),
  };
}

/** Ticks in the display unit, coloured by converting each back to the palette's native unit. */
function fieldLegend(layer: FieldLayer, units: UnitSettings): LegendSpec {
  const { ticks, unitLabel, factor } = tickScale(layer.unit, units);
  const palette = PALETTES[layer.palette];
  const colorFor = (tick: number): Rgb => colorAt(palette, tick / factor);
  return {
    kind: 'gradient',
    unit: unitLabel,
    cells: ticks.map((tick, i) => {
      const from = colorFor(tick);
      return { label: String(tick), from, to: colorFor(ticks[i + 1] ?? tick), ink: inkFor(from) };
    }),
  };
}

function tickScale(unit: FieldUnit, units: UnitSettings): TickScale {
  switch (unit) {
    case 'speed':
      return {
        ticks: LEGEND_TICKS.speed[units.speed],
        unitLabel: SPEED_LABELS[units.speed],
        factor: SPEED_FACTORS[units.speed],
      };
    case 'height':
      return {
        ticks: LEGEND_TICKS.height[units.height],
        unitLabel: units.height,
        factor: HEIGHT_FACTORS[units.height],
      };
    case 'period':
      return { ticks: LEGEND_TICKS.period, unitLabel: 's', factor: 1 };
  }
}
