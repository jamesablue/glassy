import { calmSample, NO_WAVES, testSpot } from '../../../testing/domain-builders';
import type { Conditions, UnitSettings } from '../../domain/models';
import { assessConditions } from '../../domain/scoring';
import { conditionCells, type ConditionCell } from './condition-cells';

describe('conditionCells', () => {
  const IMPERIAL: UnitSettings = { height: 'ft', speed: 'kt', temperature: 'f' };
  const METRIC: UnitSettings = { height: 'm', speed: 'kmh', temperature: 'c' };

  /** A south-facing spot with a south swell, a little wind waves and an east wind. */
  const conditions: Conditions = assessConditions(
    testSpot(),
    calmSample({
      primarySwell: { height: 1.2, period: 13.4, direction: 185 },
      secondarySwell: { height: 0.05, period: 6, direction: 120 },
      windWaves: NO_WAVES,
      windSpeed: 6,
      windDirection: 90,
      windGust: 9,
      currentSpeed: 1.2,
      currentDirection: 250,
      seaSurfaceTemperature: 26.2,
      seaLevel: 0.25,
      seaLevelNextHour: 0.3,
      rainChance: 14.6,
    }),
  );

  const byLabel = (cells: readonly ConditionCell[], label: string): ConditionCell => {
    const cell = cells.find((candidate) => candidate.label === label);
    if (!cell) throw new Error(`No ${label} cell`);
    return cell;
  };
  /** A cell's value as it reads, for example "2.4 ft @ 13s". */
  const text = (cell: ConditionCell): string =>
    cell.value.map((part) => part.text + part.unit).join('');

  it('lists the readings in display order', () => {
    expect(conditionCells(conditions, IMPERIAL).map((cell) => cell.label)).toEqual([
      'Surf at spot',
      'Wind',
      'Primary swell',
      'Secondary swell',
      'Wind waves',
      'Water temp',
      'Current',
      'Sea level',
      'Rain chance',
    ]);
  });

  it('reads out each value in the chosen units', () => {
    const imperial = conditionCells(conditions, IMPERIAL);
    expect(imperial.map(text)).toEqual([
      expect.stringMatching(/^\d+–\d+ ft$/),
      '12 kt',
      '3.9 ft @ 13s',
      '—',
      '—',
      '79°F',
      '0.6 kt',
      '+0.8 ft',
      '15%',
    ]);
    const metric = conditionCells(conditions, METRIC);
    expect(text(byLabel(metric, 'Wind'))).toBe('22 km/h');
    expect(text(byLabel(metric, 'Primary swell'))).toBe('1.2 m @ 13s');
    expect(text(byLabel(metric, 'Water temp'))).toBe('26.2°C');
    expect(text(byLabel(metric, 'Sea level'))).toBe('+0.3 m');
  });

  it('describes the wind: its direction, how it meets the shore and its gusts', () => {
    const wind = byLabel(conditionCells(conditions, IMPERIAL), 'Wind');
    expect(wind.arrowFrom).toBe(90);
    expect(wind.detail).toBe('E · cross-shore · gusts 17');
  });

  it('says where each swell comes from and how much of it reaches the spot', () => {
    const swell = byLabel(conditionCells(conditions, IMPERIAL), 'Primary swell');
    expect(swell.detail).toMatch(/^from S 185° · \d+% hits spot$/);
    expect(swell.detailArrowFrom).toBe(185);
  });

  it('calls a tiny swell negligible and a missing one not in the model', () => {
    const cells = conditionCells(conditions, IMPERIAL);
    expect(byLabel(cells, 'Secondary swell').detail).toBe('negligible');
    expect(byLabel(cells, 'Wind waves').detail).toBe('not in model');
  });

  it('gives the current’s direction and whether the sea is rising or falling', () => {
    const cells = conditionCells(conditions, IMPERIAL);
    expect(byLabel(cells, 'Current').detail).toBe('toward WSW');
    expect(byLabel(cells, 'Sea level').detail).toBe('rising');

    const ebbing = { ...conditions, sample: { ...conditions.sample, seaLevelNextHour: 0.1 } };
    expect(byLabel(conditionCells(ebbing, IMPERIAL), 'Sea level').detail).toBe('falling');
  });

  it('spans the rain chance across the grid', () => {
    const cells = conditionCells(conditions, IMPERIAL);
    expect(cells.filter((cell) => cell.wide).map((cell) => cell.label)).toEqual(['Rain chance']);
  });

  it('shows a dash for anything the forecast has no data for', () => {
    const empty: Conditions = {
      ...conditions,
      sample: {
        ...conditions.sample,
        windSpeed: NaN,
        currentDirection: NaN,
        seaSurfaceTemperature: NaN,
        seaLevel: NaN,
        rainChance: NaN,
      },
    };
    const cells = conditionCells(empty, IMPERIAL);
    for (const label of ['Wind', 'Water temp', 'Sea level', 'Rain chance']) {
      expect(text(byLabel(cells, label))).toBe('—');
    }
    expect(byLabel(cells, 'Wind').detail).toBeNull();
    expect(byLabel(cells, 'Current').detail).toBeNull();
  });

  it('leaves out what the last forecast hour cannot know', () => {
    const last: Conditions = {
      ...conditions,
      components: [
        { ...conditions.components[0], period: NaN },
        conditions.components[1],
        conditions.components[2],
      ],
      sample: { ...conditions.sample, seaLevelNextHour: NaN, windGust: NaN },
    };
    const cells = conditionCells(last, IMPERIAL);
    expect(text(byLabel(cells, 'Primary swell'))).toBe('3.9 ft');
    expect(byLabel(cells, 'Sea level').detail).toBeNull();
    expect(byLabel(cells, 'Wind').detail).toBe('E · cross-shore');
  });
});
