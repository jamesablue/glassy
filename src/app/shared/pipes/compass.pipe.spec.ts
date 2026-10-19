import { CompassPipe } from './compass.pipe';

describe('CompassPipe', () => {
  const pipe = new CompassPipe();

  it('names the nearest compass point', () => {
    expect(pipe.transform(0)).toBe('N');
    expect(pipe.transform(100)).toBe('E');
    expect(pipe.transform(202.5)).toBe('SSW');
  });

  it('shows a dash for a missing bearing', () => {
    expect(pipe.transform(NaN)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });
});
