/** The icons {@link IconComponent} can draw. */
export const ICON_NAMES = [
  'wind',
  'waves',
  'swell',
  'period',
  'depth',
  'particles',
  'spots',
  'units',
  'about',
  'play',
  'pause',
  'back',
  'chevron',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * One part of an icon on a 24 × 24 grid, as the attributes of its `<path>`: an outline drawn with a
 * pen (`stroke`), or a filled shape. `null` leaves an attribute off.
 */
export interface IconShape {
  readonly d: string;
  readonly fill: 'currentColor' | 'none';
  readonly stroke: 'currentColor' | null;
  /** Pen width for outlines, in grid units. */
  readonly strokeWidth: number | null;
}

const stroke = (d: string, strokeWidth = 2): IconShape => ({
  d,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
});
const fill = (d: string): IconShape => ({
  d,
  fill: 'currentColor',
  stroke: null,
  strokeWidth: null,
});

/** A circle as path data, so every shape renders through the same `<path>`. */
function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

/** Line icons drawn in `currentColor`, so they take the colour of the text around them. */
export const ICONS: Readonly<Record<IconName, readonly IconShape[]>> = {
  wind: [stroke('M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8')],
  waves: [
    stroke(
      'M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2' +
        'M6 11c0-3 2.5-6 6-6 2 0 3.5 1 4 2.5-1.5-.5-4 0-4 3',
    ),
  ],
  swell: [stroke('M2 14c3 0 4-6 7-6s4 6 7 6 4-4 6-4M2 19c3 0 4-3 7-3s4 3 7 3 4-2 6-2')],
  period: [stroke(circle(12, 13, 8)), stroke('M12 9v4l3 2M9 2h6')],
  depth: [stroke('M3 5h18M5 9h14M7 13h10M9 17h6M11 21h2')],
  particles: [stroke('M4 7h7M8 12h10M3 17h9M15 7h2M15 17h4')],
  spots: [
    stroke('M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z'),
    fill(circle(12, 9.5, 2.5)),
  ],
  units: [
    stroke('M4 7h10M18 7h2M4 17h4M12 17h8'),
    stroke(circle(16, 7, 2)),
    stroke(circle(10, 17, 2)),
  ],
  about: [stroke(circle(12, 12, 9)), stroke('M12 11v6M12 7.5v.5', 2.4)],
  play: [fill('M8 5l11 7-11 7z')],
  pause: [fill('M7 5h4v14H7zM13 5h4v14h-4z')],
  back: [stroke('M15 6l-6 6 6 6', 2.2)],
  chevron: [stroke('M6 15l6-6 6 6', 2.2)],
};
