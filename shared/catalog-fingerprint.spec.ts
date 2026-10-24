import { catalogFingerprint } from './catalog-fingerprint';
import { OAHU_SPOTS, type Spot } from './spots';

describe('catalogFingerprint', () => {
  const [first, second] = OAHU_SPOTS as readonly [Spot, Spot, ...Spot[]];

  it('is eight hex digits and stable for the same catalog', () => {
    expect(catalogFingerprint(OAHU_SPOTS)).toMatch(/^[0-9a-f]{8}$/);
    expect(catalogFingerprint([...OAHU_SPOTS])).toBe(catalogFingerprint(OAHU_SPOTS));
  });

  it('changes with the order of the spots', () => {
    expect(catalogFingerprint([second, first])).not.toBe(catalogFingerprint([first, second]));
  });

  it.each(['id', 'lat', 'lon', 'facing'] as const)('changes with a spot’s %s', (field) => {
    const changed = { ...first, [field]: field === 'id' ? 'other' : first[field] + 0.001 };
    expect(catalogFingerprint([changed])).not.toBe(catalogFingerprint([first]));
  });

  it('ignores what does not affect the forecast, such as the notes', () => {
    expect(catalogFingerprint([{ ...first, notes: 'Changed' }])).toBe(catalogFingerprint([first]));
  });
});
