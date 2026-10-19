import { RATINGS } from '../scoring/rating';
import {
  contrastRatio,
  INK_COLORS,
  inkFor,
  MIN_TEXT_CONTRAST,
  mixRgb,
  relativeLuminance,
} from './contrast';

describe('relativeLuminance', () => {
  it('runs from black to white', () => {
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
  });

  it('weights green far above red and blue', () => {
    expect(relativeLuminance([0, 255, 0])).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance([255, 0, 0])).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance([0, 0, 255])).toBeCloseTo(0.0722, 4);
  });

  it('treats the darkest greys linearly', () => {
    expect(relativeLuminance([10, 10, 10])).toBeCloseTo(10 / 255 / 12.92, 10);
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 6);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBe(1);
    // #767676 is the lightest grey that passes on white.
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  it('does not care which colour is the text', () => {
    expect(contrastRatio([52, 211, 153], [17, 17, 17])).toBe(
      contrastRatio([17, 17, 17], [52, 211, 153]),
    );
  });
});

describe('inkFor', () => {
  it('uses dark text on light backgrounds and light text on dark ones', () => {
    expect(inkFor([255, 255, 255])).toBe('dark');
    expect(inkFor([255, 255, 0])).toBe('dark');
    expect(inkFor([0, 0, 0])).toBe('light');
    expect(inkFor([40, 40, 120])).toBe('light');
  });

  it('goes by luminance, so a saturated green takes dark text', () => {
    expect(inkFor([0, 255, 0])).toBe('dark');
    expect(inkFor([0, 0, 255])).toBe('light');
  });

  it('always reaches the WCAG minimum on a single colour', () => {
    for (let grey = 0; grey <= 255; grey += 5) {
      const background = [grey, grey, grey] as const;
      const ink = INK_COLORS[inkFor(background)];
      expect(contrastRatio(ink, background)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });

  it('picks the ink that holds up best across several colours', () => {
    // On its own a mid grey takes white text, but white would vanish on the pale end of a gradient.
    expect(inkFor([100, 100, 100])).toBe('light');
    expect(inkFor([100, 100, 100], [220, 220, 220])).toBe('dark');
    expect(inkFor([30, 30, 30], [130, 130, 130])).toBe('light');
  });

  it('gives the rating colours the dark text their badges and pills use', () => {
    for (const rating of RATINGS) {
      const [red, green, blue] = [1, 3, 5].map((at) =>
        parseInt(rating.color.slice(at, at + 2), 16),
      );
      expect(inkFor([red ?? 0, green ?? 0, blue ?? 0]), rating.label).toBe('dark');
    }
  });
});

describe('mixRgb', () => {
  it('blends channel by channel', () => {
    expect(mixRgb([0, 100, 200], [100, 200, 0], 0)).toEqual([0, 100, 200]);
    expect(mixRgb([0, 100, 200], [100, 200, 0], 0.5)).toEqual([50, 150, 100]);
    expect(mixRgb([0, 100, 200], [100, 200, 0], 1)).toEqual([100, 200, 0]);
  });
});
