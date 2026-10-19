import type { LayerDefinition, LayerId } from '../models';

/** What each map layer draws: its field, colour ramp, particle vectors and unit. */
export const LAYERS: Readonly<Record<LayerId, LayerDefinition>> = {
  wind: { kind: 'field', field: 'windSpeed', palette: 'wind', vectors: 'wind', unit: 'speed' },
  waves: { kind: 'field', field: 'waveHeight', palette: 'waves', vectors: 'waves', unit: 'height' },
  swell: {
    kind: 'field',
    field: 'swellHeight',
    palette: 'waves',
    vectors: 'swell',
    unit: 'height',
  },
  period: {
    kind: 'field',
    field: 'swellPeriod',
    palette: 'period',
    vectors: 'swell',
    unit: 'period',
  },
  depth: { kind: 'depth' },
};
