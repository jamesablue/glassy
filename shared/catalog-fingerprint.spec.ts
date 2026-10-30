import { catalogFingerprint, catalogFingerprintV1 } from './catalog-fingerprint';
import { OAHU_SPOTS, type Spot } from './spots';

describe('catalogFingerprint', () => {
  const [first, second] = OAHU_SPOTS as readonly [Spot, Spot, ...Spot[]];
  const { sample, ...withoutSample } = first;

  it('is eight hex digits and stable for the same catalog', () => {
    expect(catalogFingerprint(OAHU_SPOTS)).toMatch(/^[0-9a-f]{8}$/);
    expect(catalogFingerprint([...OAHU_SPOTS])).toBe(catalogFingerprint(OAHU_SPOTS));
  });

  it('changes with the order of the spots', () => {
    expect(catalogFingerprint([second, first])).not.toBe(catalogFingerprint([first, second]));
  });

  it.each(['id', 'lat', 'lon'] as const)('changes with a spot’s %s', (field) => {
    const changed = { ...first, [field]: field === 'id' ? 'other' : first[field] + 0.001 };
    expect(catalogFingerprint([changed])).not.toBe(catalogFingerprint([first]));
  });

  it('changes with a spot’s sample point', () => {
    const moved = { lat: sample!.lat + 0.001, lon: sample!.lon };
    expect(catalogFingerprint([{ ...first, sample: moved }])).not.toBe(catalogFingerprint([first]));
  });

  it('ignores facing and window once the spot sets a sample point', () => {
    const retuned = { ...first, facing: first.facing + 15, window: 120 };
    expect(catalogFingerprint([retuned])).toBe(catalogFingerprint([first]));
  });

  it('follows facing for a spot without a sample point, whose sampling point follows it', () => {
    const turned = { ...withoutSample, facing: first.facing + 15 };
    expect(catalogFingerprint([turned])).not.toBe(catalogFingerprint([withoutSample]));
  });

  it('ignores what does not affect the forecast, such as the notes', () => {
    expect(catalogFingerprint([{ ...first, notes: 'Changed' }])).toBe(catalogFingerprint([first]));
  });
});

describe('catalogFingerprintV1', () => {
  const [first] = OAHU_SPOTS as readonly [Spot, ...Spot[]];

  it('is the value version 1 snapshots carry, unchanged by sample points', () => {
    // What the version 1 ingest computed for this catalog (catalog-fingerprint.ts before #63).
    expect(catalogFingerprintV1(OAHU_SPOTS)).toBe('3a38c753');
  });

  it('changes with a spot’s facing', () => {
    expect(catalogFingerprintV1([{ ...first, facing: first.facing + 1 }])).not.toBe(
      catalogFingerprintV1([first]),
    );
  });
});
