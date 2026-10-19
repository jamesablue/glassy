import { DEPTH_BINS, type DepthBin } from '../../domain/bathymetry';

/**
 * An ArcGIS raster function, sent as the `renderingRule` of an ImageServer request so NOAA's server
 * renders the elevation data into the image we want. No client-side raster processing is needed.
 * https://developers.arcgis.com/rest/services-reference/enterprise/raster-function-objects/
 */
export interface RasterFunction {
  readonly rasterFunction: string;
  readonly rasterFunctionArguments: Readonly<Record<string, RasterFunctionArgument>>;
  readonly outputPixelType?: 'U8';
}

export type RasterFunctionArgument =
  number | readonly number[] | readonly (readonly number[])[] | RasterFunction;

/**
 * Cells above this elevation (metres) count as land. It sits a little above mean sea level so wet
 * sand and reef flats stay in the water layer instead of turning into hillshaded land.
 */
export const SHORELINE_ELEVATION_M = 0.3;

/** Higher than any land on Earth: the open upper end of "everything above the shoreline". */
const ABOVE_ALL_LAND_M = 10_000;

/** Shaded relief of the land only, drawn over the field colours so the island keeps its shape. */
export const LAND_RULE: RasterFunction = {
  rasterFunction: 'Hillshade',
  rasterFunctionArguments: {
    Azimuth: 315,
    Altitude: 45,
    ZFactor: 1,
    Raster: {
      rasterFunction: 'Mask',
      rasterFunctionArguments: {
        IncludedRanges: [SHORELINE_ELEVATION_M, ABOVE_ALL_LAND_M],
        NoDataInterpretation: 0,
      },
    },
  },
};

/**
 * Colours water by depth class: `Remap` turns each elevation into its bin's class number (1-based,
 * because 0 is the 8-bit image's "no data"), then `Colormap` paints each class in its bin's colour.
 * Land is remapped to no data and stays transparent. Built from the domain's depth bins so the
 * tiles and the legend always agree.
 */
export function depthRule(bins: readonly DepthBin[] = DEPTH_BINS): RasterFunction {
  return {
    rasterFunction: 'Colormap',
    rasterFunctionArguments: {
      Colormap: bins.map((bin, index) => [index + 1, ...bin.color]),
      Raster: {
        rasterFunction: 'Remap',
        rasterFunctionArguments: {
          // Remap ranges are [from, to) in elevation, and elevation is minus depth: a bin covers
          // depths over `min` up to and including `max`. The shallowest also takes the shoreline.
          InputRanges: bins.flatMap((bin) => [
            -bin.max,
            bin.min === 0 ? SHORELINE_ELEVATION_M : -bin.min,
          ]),
          OutputValues: bins.map((_, index) => index + 1),
          NoDataRanges: [SHORELINE_ELEVATION_M, ABOVE_ALL_LAND_M],
        },
        outputPixelType: 'U8',
      },
    },
    outputPixelType: 'U8',
  };
}

export const DEPTH_RULE: RasterFunction = depthRule();
