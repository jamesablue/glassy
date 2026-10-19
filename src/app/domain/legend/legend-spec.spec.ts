import { contrastRatio, INK_COLORS, inkFor, mixRgb } from '../color/contrast';
import { colorAt, PALETTES } from '../color/palettes';
import { LAYER_IDS, type UnitSettings } from '../models';
import { legendSpec } from './legend-spec';
import { LEGEND_TICKS } from './legend-ticks';

describe('legendSpec', () => {
  const imperial: UnitSettings = { height: 'ft', speed: 'kt', temperature: 'f' };
  const metric: UnitSettings = { height: 'm', speed: 'kmh', temperature: 'c' };

  it('labels wind ticks in the chosen speed unit and colours them in m/s', () => {
    const legend = legendSpec('wind', imperial);
    expect(legend.kind).toBe('gradient');
    expect(legend.unit).toBe('kt');
    expect(legend.cells.map((cell) => cell.label)).toEqual(
      LEGEND_TICKS.speed.kt.map((tick) => String(tick)),
    );
    expect(legend.cells[1]?.from).toEqual(colorAt(PALETTES.wind, 5 / 1.943844));
  });

  it('shades each cell toward the next tick', () => {
    const cells = legendSpec('wind', metric).cells;
    expect(legendSpec('wind', metric).unit).toBe('km/h');
    cells.slice(0, -1).forEach((cell, i) => {
      expect(cell.to).toEqual(cells[i + 1]?.from);
    });
  });

  it('ends on a solid cell', () => {
    const last = legendSpec('waves', imperial).cells.at(-1);
    expect(last?.to).toEqual(last?.from);
  });

  it('labels wave and swell ticks in the chosen height unit', () => {
    const feet = legendSpec('waves', imperial);
    expect(feet.unit).toBe('ft');
    expect(feet.cells[3]).toMatchObject({ label: '3', from: colorAt(PALETTES.waves, 3 / 3.28084) });

    const meters = legendSpec('swell', metric);
    expect(meters.unit).toBe('m');
    expect(meters.cells.map((cell) => cell.label)).toEqual(
      LEGEND_TICKS.height.m.map((tick) => String(tick)),
    );
    expect(meters.cells[4]?.from).toEqual(colorAt(PALETTES.waves, 1.5));
  });

  it('labels period ticks in seconds whatever the units', () => {
    const legend = legendSpec('period', metric);
    expect(legend.unit).toBe('s');
    expect(legend.cells.map((cell) => cell.label)).toEqual(
      LEGEND_TICKS.period.map((tick) => String(tick)),
    );
    expect(legend.cells[4]?.from).toEqual(colorAt(PALETTES.period, 10));
  });

  it('picks the text colour that reads best across the middle of each cell', () => {
    for (const cell of legendSpec('waves', metric).cells) {
      const middle = [0.3, 0.5, 0.7].map((share) => mixRgb(cell.from, cell.to, share));
      expect(cell.ink).toBe(inkFor(...middle));
    }
  });

  it('keeps every label at about 4.4:1 or better under the label, in every layer and unit', () => {
    for (const layer of LAYER_IDS) {
      for (const units of [metric, imperial]) {
        for (const cell of legendSpec(layer, units).cells) {
          const ink = INK_COLORS[cell.ink];
          const middle = [0.3, 0.5, 0.7].map((share) => mixRgb(cell.from, cell.to, share));
          const lowest = Math.min(...middle.map((colour) => contrastRatio(ink, colour)));
          expect(lowest, `${layer} ${cell.label}`).toBeGreaterThanOrEqual(4.4);
        }
      }
    }
  });

  describe('depth', () => {
    it('shows one solid cell per depth class', () => {
      const legend = legendSpec('depth', metric);
      expect(legend.kind).toBe('classes');
      expect(legend.cells).toHaveLength(12);
      for (const cell of legend.cells) expect(cell.to).toEqual(cell.from);
    });

    it('labels each class with its shallow edge in metres', () => {
      expect(legendSpec('depth', metric).unit).toBe('m');
      expect(legendSpec('depth', metric).cells.map((cell) => cell.label)).toEqual([
        '0',
        '1',
        '2',
        '3',
        '5',
        '8',
        '12',
        '20',
        '30',
        '50',
        '100',
        '500',
      ]);
    });

    it('labels each class in whole feet', () => {
      expect(legendSpec('depth', imperial).unit).toBe('ft');
      expect(legendSpec('depth', imperial).cells.map((cell) => cell.label)).toEqual([
        '0',
        '3',
        '7',
        '10',
        '16',
        '26',
        '39',
        '66',
        '98',
        '164',
        '328',
        '1640',
      ]);
    });

    it('uses dark text on the pale shallows and light text on deep water', () => {
      const cells = legendSpec('depth', imperial).cells;
      expect(cells[0]?.ink).toBe('dark');
      expect(cells.at(-1)?.ink).toBe('light');
    });
  });
});
