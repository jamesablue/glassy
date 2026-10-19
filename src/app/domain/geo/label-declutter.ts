import { valueAt } from '../math/value-at';

/** How much of a spot pin's label fits: surf height and name, surf height only, or a bare dot. */
export type LabelMode = 'full' | 'height-only' | 'dot';

/** A spot pin on screen and the widths its label would take. */
export interface PinLabel {
  /** Pin centre in screen pixels. */
  readonly x: number;
  readonly y: number;
  /** Width of the surf-height tag, pixels. */
  readonly heightWidth: number;
  /** Extra width the spot name adds after the tag, pixels. */
  readonly nameWidth: number;
}

/** Spot names only appear from this map zoom level up; below it there is no room. */
export const SHOW_NAMES_MIN_ZOOM = 11.25;

const PIN_RADIUS = 9;
const LABEL_HALF_HEIGHT = 10;

/** Screen rectangle: left, top, right, bottom. */
type Box = readonly [number, number, number, number];

/**
 * Label widths estimated from text length, so placement needs no DOM measurement: about 7 px per
 * character of the bold height tag plus 16 px for the pin and padding, and about 6.1 px per
 * character of the smaller name plus a 6 px gap.
 */
export function labelWidths(
  heightText: string,
  name: string,
): Pick<PinLabel, 'heightWidth' | 'nameWidth'> {
  return { heightWidth: heightText.length * 7 + 16, nameWidth: name.length * 6.1 + 6 };
}

/**
 * The order labels claim space in: the selected spot first, then the best scores, so the spots
 * people care about keep their full labels. Equal scores keep catalog order.
 *
 * @param scores each spot's score at the hour shown
 */
export function labelPriority(scores: ArrayLike<number>, selectedIndex: number | null): number[] {
  return Array.from({ length: scores.length }, (_, index) => index).sort(
    (a, b) =>
      Number(b === selectedIndex) - Number(a === selectedIndex) ||
      valueAt(scores, b) - valueAt(scores, a),
  );
}

/**
 * Places spot labels without overlaps. Labels claim space in priority order, each taking the
 * widest mode that fits: name and height (only when names are shown), then height alone. A label
 * with no room shrinks to a dot, which still reserves the pin's own space.
 *
 * @param labels one entry per spot
 * @param priority spot indices in the order they claim space (see {@link labelPriority})
 * @returns the mode for each spot, indexed like `labels`
 */
export function placeLabels(
  labels: readonly PinLabel[],
  priority: readonly number[],
  showNames: boolean,
): LabelMode[] {
  const modes = labels.map((): LabelMode => 'dot');
  const placed: Box[] = [];
  const isFree = (box: Box): boolean => !placed.some((other) => overlaps(box, other));

  for (const index of priority) {
    const label = labels[index];
    if (!label) continue;
    const options: readonly (readonly [LabelMode, number])[] = showNames
      ? [
          ['full', label.heightWidth + label.nameWidth],
          ['height-only', label.heightWidth],
        ]
      : [['height-only', label.heightWidth]];

    const fit = options.find(([, width]) => isFree(tagBox(label, width)));
    if (fit) {
      placed.push(tagBox(label, fit[1]));
      modes[index] = fit[0];
    } else {
      placed.push(dotBox(label));
    }
  }
  return modes;
}

/** A label starts at the pin's left edge and extends right. */
function tagBox({ x, y }: PinLabel, width: number): Box {
  return [x - PIN_RADIUS, y - LABEL_HALF_HEIGHT, x + width, y + LABEL_HALF_HEIGHT];
}

function dotBox({ x, y }: PinLabel): Box {
  return [x - PIN_RADIUS, y - PIN_RADIUS, x + PIN_RADIUS, y + PIN_RADIUS];
}

/** Boxes that only touch along an edge do not overlap. */
function overlaps(a: Box, b: Box): boolean {
  return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}
