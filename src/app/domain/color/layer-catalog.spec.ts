import { LAYER_IDS } from '../models';
import { LAYERS } from './layer-catalog';

describe('LAYERS', () => {
  it('describes every layer the picker lists, and no others', () => {
    expect(Object.keys(LAYERS).sort()).toEqual([...LAYER_IDS].sort());
  });

  it('draws bathymetry for the depth layer and a forecast field for the rest', () => {
    expect(LAYER_IDS.filter((id) => LAYERS[id].kind === 'depth')).toEqual(['depth']);
  });
});
