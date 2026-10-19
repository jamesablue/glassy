import { DEPTH_BINS, type DepthBin } from '../../domain/bathymetry';
import {
  DEPTH_RULE,
  depthRule,
  LAND_RULE,
  SHORELINE_ELEVATION_M,
  type RasterFunction,
  type RasterFunctionArgument,
} from './raster-functions';

function isRasterFunction(
  argument: RasterFunctionArgument | undefined,
): argument is RasterFunction {
  return typeof argument === 'object' && 'rasterFunction' in argument;
}

function inner(rule: RasterFunction): RasterFunction {
  const raster = rule.rasterFunctionArguments['Raster'];
  if (!isRasterFunction(raster)) throw new Error(`${rule.rasterFunction} has no inner raster`);
  return raster;
}

function numbers(argument: RasterFunctionArgument | undefined): readonly number[] {
  if (!Array.isArray(argument)) throw new Error('Expected a list of numbers');
  return argument.flat();
}

/**
 * What NOAA's server does with the depth rule for one elevation: Remap finds the first
 * [from, to) input range holding it and outputs that range's class; no-data ranges win.
 */
function depthClassAt(rule: RasterFunction, elevation: number): number | 'no data' {
  const remap = inner(rule).rasterFunctionArguments;
  const [noDataFrom = NaN, noDataTo = NaN] = numbers(remap['NoDataRanges']);
  if (elevation >= noDataFrom && elevation < noDataTo) return 'no data';
  const ranges = numbers(remap['InputRanges']);
  const outputs = numbers(remap['OutputValues']);
  for (let i = 0; i < outputs.length; i++) {
    const from = ranges[2 * i] ?? NaN;
    const to = ranges[2 * i + 1] ?? NaN;
    if (elevation >= from && elevation < to) return outputs[i] ?? NaN;
  }
  return 'no data';
}

function colorOfClass(rule: RasterFunction, depthClass: number): readonly number[] | undefined {
  const colormap = rule.rasterFunctionArguments['Colormap'];
  if (!Array.isArray(colormap)) return undefined;
  const entry = colormap.find((row: readonly number[]) => row[0] === depthClass);
  return entry?.slice(1);
}

describe('DEPTH_RULE', () => {
  // A depth on a boundary belongs to the shallower bin.
  const binFor = (depth: number): DepthBin | undefined =>
    DEPTH_BINS.find((bin) => depth > bin.min && depth <= bin.max);

  it('colours each class in its depth bin colour', () => {
    expect(DEPTH_RULE.rasterFunction).toBe('Colormap');
    DEPTH_BINS.forEach((bin, index) => {
      expect(colorOfClass(DEPTH_RULE, index + 1)).toEqual(bin.color);
    });
  });

  it.each([0.5, 1, 1.5, 4, 7.9, 12, 25, 99, 250, 4000])(
    'puts water %s m deep in its depth bin',
    (depth) => {
      const depthClass = depthClassAt(DEPTH_RULE, -depth);
      expect(typeof depthClass).toBe('number');
      expect(colorOfClass(DEPTH_RULE, Number(depthClass))).toEqual(binFor(depth)?.color);
    },
  );

  it('counts the wet shoreline band as the shallowest water', () => {
    expect(depthClassAt(DEPTH_RULE, 0)).toBe(1);
    expect(depthClassAt(DEPTH_RULE, 0.2)).toBe(1);
  });

  it('leaves land transparent', () => {
    expect(depthClassAt(DEPTH_RULE, SHORELINE_ELEVATION_M)).toBe('no data');
    expect(depthClassAt(DEPTH_RULE, 1200)).toBe('no data');
  });

  it('renders 8-bit classes, leaving 0 for no data', () => {
    expect(DEPTH_RULE.outputPixelType).toBe('U8');
    expect(inner(DEPTH_RULE).outputPixelType).toBe('U8');
    expect(numbers(inner(DEPTH_RULE).rasterFunctionArguments['OutputValues'])).toEqual(
      DEPTH_BINS.map((_, index) => index + 1),
    );
  });

  it('follows whatever bins it is given', () => {
    const rule = depthRule([
      { min: 0, max: 10, color: [1, 2, 3] },
      { min: 10, max: 100, color: [4, 5, 6] },
    ]);
    expect(numbers(inner(rule).rasterFunctionArguments['InputRanges'])).toEqual([
      -10,
      SHORELINE_ELEVATION_M,
      -100,
      -10,
    ]);
    expect(colorOfClass(rule, Number(depthClassAt(rule, -50)))).toEqual([4, 5, 6]);
  });
});

describe('LAND_RULE', () => {
  it('hillshades only cells above the shoreline', () => {
    expect(LAND_RULE.rasterFunction).toBe('Hillshade');
    expect(LAND_RULE.rasterFunctionArguments['Azimuth']).toBe(315);
    const mask = inner(LAND_RULE);
    expect(mask.rasterFunction).toBe('Mask');
    expect(numbers(mask.rasterFunctionArguments['IncludedRanges'])[0]).toBe(SHORELINE_ELEVATION_M);
  });
});
