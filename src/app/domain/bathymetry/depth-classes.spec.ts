import { inkFor } from '../color/contrast';
import { DEPTH_BINS } from './depth-classes';

describe('DEPTH_BINS', () => {
  it('has 12 classes from the shoreline to 12,000 m', () => {
    expect(DEPTH_BINS).toHaveLength(12);
    expect(DEPTH_BINS[0]?.min).toBe(0);
    expect(DEPTH_BINS.at(-1)?.max).toBe(12000);
  });

  it('leaves no gaps or overlaps between classes', () => {
    DEPTH_BINS.slice(1).forEach((bin, i) => {
      expect(bin.min).toBe(DEPTH_BINS[i]?.max);
      expect(bin.max).toBeGreaterThan(bin.min);
    });
  });

  it('keeps the classes narrow at snorkel depths', () => {
    const shallow = DEPTH_BINS.filter((bin) => bin.max <= 12);
    expect(shallow).toHaveLength(6);
  });

  it('runs from pale shallows to dark deep water', () => {
    expect(inkFor(DEPTH_BINS[0]?.color ?? [0, 0, 0])).toBe('dark');
    expect(inkFor(DEPTH_BINS.at(-1)?.color ?? [255, 255, 255])).toBe('light');
  });
});
