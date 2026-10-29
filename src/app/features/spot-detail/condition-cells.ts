import type {
  AssessedWaveComponent,
  Conditions,
  HeightUnit,
  UnitSettings,
  WaveComponentKind,
} from '../../domain/models';
import {
  compassPoint,
  FEET_PER_METER,
  formatHeight,
  formatPeriod,
  formatSignedHeight,
  formatSpeed,
  formatTemperature,
  NO_VALUE,
  SPEED_LABELS,
  surfText,
} from '../../domain/units';

/**
 * A number and its unit, which is set smaller. The text carries any space before the unit, so
 * "3.3 ft" and "@ 12s" both read naturally. `unit` is empty for a value without one.
 */
export interface ValuePart {
  readonly text: string;
  readonly unit: string;
}

/** One cell of the conditions grid. */
export interface ConditionCell {
  readonly label: string;
  readonly value: readonly ValuePart[];
  /** Where the value's arrow points from (a forecast direction), or `null` for no arrow. */
  readonly arrowFrom: number | null;
  /** A second line, such as the direction and how the wind meets the shore. */
  readonly detail: string | null;
  /** Where the second line's arrow points from, or `null` for no arrow. */
  readonly detailArrowFrom: number | null;
  /** Spans both columns. */
  readonly wide: boolean;
}

const WAVE_LABELS: Readonly<Record<WaveComponentKind, string>> = {
  primarySwell: 'Primary swell',
  secondarySwell: 'Secondary swell',
  windWaves: 'Wind waves',
};

/** Wave components smaller than this (feet) are not worth a reading. */
const NEGLIGIBLE_WAVE_FEET = 0.3;

/**
 * The grid of readings in the spot detail, in the user's units: surf, wind, the three wave
 * components, water temperature, current, sea level and rain. A reading the forecast has no data
 * for shows "—".
 */
export function conditionCells(conditions: Conditions, units: UnitSettings): ConditionCell[] {
  const { sample } = conditions;
  return [
    cell('Surf at spot', [plain(surfText(conditions.surf, units.height))], {
      detail: 'estimated full-face breaking height',
    }),
    windCell(conditions, units),
    ...conditions.components.map((component) => waveCell(component, units.height)),
    cell('Water temp', [
      plain(
        finite(sample.seaSurfaceTemperature)
          ? formatTemperature(sample.seaSurfaceTemperature, units.temperature)
          : NO_VALUE,
      ),
    ]),
    cell('Current', [measure(conditions.currentKnots.toFixed(1), 'kt')], {
      detail: finite(sample.currentDirection)
        ? `toward ${compassPoint(sample.currentDirection)}`
        : null,
    }),
    seaLevelCell(conditions, units.height),
    cell(
      'Rain chance',
      [plain(finite(sample.rainChance) ? `${Math.round(sample.rainChance)}%` : NO_VALUE)],
      {
        wide: true,
      },
    ),
  ];
}

function windCell({ sample, windKind }: Conditions, units: UnitSettings): ConditionCell {
  if (!finite(sample.windSpeed)) return cell('Wind', [plain(NO_VALUE)]);
  const direction = compassPoint(sample.windDirection);
  const gusts = finite(sample.windGust)
    ? `gusts ${formatSpeed(sample.windGust, units.speed)}`
    : null;
  return cell(
    'Wind',
    [measure(formatSpeed(sample.windSpeed, units.speed), SPEED_LABELS[units.speed])],
    {
      arrowFrom: finite(sample.windDirection) ? sample.windDirection : null,
      detail: [direction, windKind, gusts].filter(Boolean).join(' · '),
    },
  );
}

function waveCell(component: AssessedWaveComponent, unit: HeightUnit): ConditionCell {
  const label = WAVE_LABELS[component.kind];
  if (!component.available) return cell(label, [plain(NO_VALUE)], { detail: 'not in model' });
  if (component.height * FEET_PER_METER < NEGLIGIBLE_WAVE_FEET) {
    return cell(label, [plain(NO_VALUE)], { detail: 'negligible' });
  }
  const height = measure(formatHeight(component.height, unit), unit);
  const period: ValuePart[] = finite(component.period)
    ? [{ text: ` @ ${formatPeriod(component.period)}`, unit: 's' }]
    : [];
  const from = `from ${compassPoint(component.direction)} ${Math.round(component.direction)}°`;
  return cell(label, [height, ...period], {
    detail: `${from} · ${Math.round(component.exposure * 100)}% hits spot`,
    detailArrowFrom: component.direction,
  });
}

function seaLevelCell({ sample }: Conditions, unit: HeightUnit): ConditionCell {
  if (!finite(sample.seaLevel)) return cell('Sea level', [plain(NO_VALUE)]);
  const value = measure(formatSignedHeight(sample.seaLevel, unit), unit);
  // The last forecast hour has nothing after it to compare with.
  if (!finite(sample.seaLevelNextHour)) return cell('Sea level', [value]);
  return cell('Sea level', [value], {
    detail: sample.seaLevelNextHour > sample.seaLevel ? 'rising' : 'falling',
  });
}

function cell(
  label: string,
  value: readonly ValuePart[],
  extra: Partial<Omit<ConditionCell, 'label' | 'value'>> = {},
): ConditionCell {
  return {
    label,
    value,
    arrowFrom: null,
    detail: null,
    detailArrowFrom: null,
    wide: false,
    ...extra,
  };
}

/** A number followed by its unit: "3.3 ft". */
function measure(value: string, unit: string): ValuePart {
  return { text: `${value} `, unit };
}

/** Text with no unit, such as "Flat" or "80°F". */
function plain(text: string): ValuePart {
  return { text, unit: '' };
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}
