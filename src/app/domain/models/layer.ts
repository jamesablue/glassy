import type { ScalarFieldId, VectorFieldId } from './forecast';
import type { PaletteId } from './palette';

/** The map layers, in the order the layer picker lists them. */
export const LAYER_IDS = ['wind', 'waves', 'swell', 'period', 'depth'] as const;

export type LayerId = (typeof LAYER_IDS)[number];

/** The kind of unit a layer's values are shown in, which picks the legend ticks. */
export type FieldUnit = 'speed' | 'height' | 'period';

/** A forecast field drawn as a colour ramp with particles moving over it. */
export interface FieldLayer {
  readonly kind: 'field';
  readonly field: ScalarFieldId;
  readonly palette: PaletteId;
  readonly vectors: VectorFieldId;
  readonly unit: FieldUnit;
}

/** Bathymetry tiles instead of a forecast field. */
export interface DepthLayer {
  readonly kind: 'depth';
}

export type LayerDefinition = FieldLayer | DepthLayer;
