/**
 * Shrinks a screenshot by converting it to an 8-bit palette PNG, the way pngquant does but with no
 * dependency beyond Node's zlib. The colours are picked by median cut over the image's own
 * histogram, so the large smooth areas (the forecast colours, the dark basemap) get most of the
 * palette, and colours that carry meaning (the rating colours) can be kept exactly. A full-colour
 * 2× screenshot of the map is about 3 MB; as a palette image it is a fraction of that, with no
 * visible change at README size.
 *
 * Only what Chromium's screenshots use is supported: 8-bit RGB or RGBA, not interlaced.
 */
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_PALETTE = 3;
const COLOR_TYPE_RGBA = 6;

/** Decoded pixels, three bytes (red, green, blue) per pixel, row by row. */
interface RgbImage {
  readonly width: number;
  readonly height: number;
  readonly rgb: Uint8Array;
}

/** One histogram bin: a colour (5 bits per channel) and how many pixels have it. */
interface Bin {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly count: number;
}

export interface PaletteOptions {
  /** Palette size, 2 to 256. */
  readonly colors?: number;
  /**
   * Colours that must come through exactly, as `#rrggbb`. Median cut favours colours that cover
   * many pixels, so a small, meaningful one (a rating colour on a map pin) could otherwise be
   * merged with its neighbour.
   */
  readonly keep?: readonly string[];
}

/**
 * The same image as a palette PNG with at most `colors` colours. Transparency is dropped, which is
 * fine for screenshots: they are opaque.
 */
export function toPalettePng(png: Buffer, options: PaletteOptions = {}): Buffer {
  const image = decodePng(png);
  const kept = new Uint8Array((options.keep ?? []).flatMap(parseHex));
  const colors = Math.max(2, Math.min(256, options.colors ?? 256));
  const picked = medianCut(histogram(image.rgb), Math.max(1, colors - kept.length / 3));
  const palette = new Uint8Array([...kept, ...picked]);
  const indices = mapToPalette(image.rgb, palette, kept.length / 3);
  return encodePalettePng(image.width, image.height, palette, indices);
}

function parseHex(color: string): number[] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) throw new Error(`Not a #rrggbb colour: ${color}`);
  return match.slice(1).map((pair) => parseInt(pair, 16));
}

function decodePng(png: Buffer): RgbImage {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG file');
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('latin1', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [bitDepth, colorType, , , interlace] = body.subarray(8, 13);
      if (bitDepth !== 8 || interlace !== 0) throw new Error('Unsupported PNG layout');
      if (colorType === COLOR_TYPE_RGB) channels = 3;
      else if (colorType === COLOR_TYPE_RGBA) channels = 4;
      else throw new Error(`Unsupported PNG colour type ${colorType}`);
    } else if (type === 'IDAT') {
      data.push(body);
    }
    offset += length + 12;
  }

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    unfilterRow(raw, y * (stride + 1), rows, y * stride, stride, channels);
  }

  const rgb = new Uint8Array(width * height * 3);
  for (let pixel = 0; pixel < width * height; pixel++) {
    rgb.set(rows.subarray(pixel * channels, pixel * channels + 3), pixel * 3);
  }
  return { width, height, rgb };
}

/** Undoes one row's PNG filter, writing the row's bytes into `out` at `at`. */
function unfilterRow(
  raw: Uint8Array,
  from: number,
  out: Uint8Array,
  at: number,
  stride: number,
  bpp: number,
): void {
  const filter = raw[from] ?? 0;
  for (let i = 0; i < stride; i++) {
    const value = raw[from + 1 + i] ?? 0;
    const left = i >= bpp ? (out[at + i - bpp] ?? 0) : 0;
    const up = at >= stride ? (out[at + i - stride] ?? 0) : 0;
    const upLeft = at >= stride && i >= bpp ? (out[at + i - stride - bpp] ?? 0) : 0;
    let predictor = 0;
    if (filter === 1) predictor = left;
    else if (filter === 2) predictor = up;
    else if (filter === 3) predictor = (left + up) >> 1;
    else if (filter === 4) predictor = paeth(left, up, upLeft);
    out[at + i] = (value + predictor) & 0xff;
  }
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const toLeft = Math.abs(estimate - left);
  const toUp = Math.abs(estimate - up);
  const toUpLeft = Math.abs(estimate - upLeft);
  if (toLeft <= toUp && toLeft <= toUpLeft) return left;
  return toUp <= toUpLeft ? up : upLeft;
}

/** The image's colours at 5 bits per channel, each with its pixel count and mean colour. */
function histogram(rgb: Uint8Array): Bin[] {
  const size = 1 << 15;
  const count = new Uint32Array(size);
  const sums = new Float64Array(size * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    const r = rgb[i] ?? 0;
    const g = rgb[i + 1] ?? 0;
    const b = rgb[i + 2] ?? 0;
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    count[key] = (count[key] ?? 0) + 1;
    sums[key * 3] = (sums[key * 3] ?? 0) + r;
    sums[key * 3 + 1] = (sums[key * 3 + 1] ?? 0) + g;
    sums[key * 3 + 2] = (sums[key * 3 + 2] ?? 0) + b;
  }
  const bins: Bin[] = [];
  count.forEach((n, key) => {
    if (n > 0) {
      bins.push({
        r: (sums[key * 3] ?? 0) / n,
        g: (sums[key * 3 + 1] ?? 0) / n,
        b: (sums[key * 3 + 2] ?? 0) / n,
        count: n,
      });
    }
  });
  return bins;
}

type Channel = 'r' | 'g' | 'b';

/**
 * Median cut: split the box of colours with the most pixels times the widest channel range at its
 * pixel-weighted median, until there are `colors` boxes; each box's mean colour is a palette entry.
 */
function medianCut(bins: Bin[], colors: number): Uint8Array {
  let boxes: Bin[][] = [bins];
  while (boxes.length < colors) {
    let best = -1;
    let bestScore = 0;
    boxes.forEach((box, index) => {
      if (box.length < 2) return;
      const score = population(box) * widest(box).range;
      if (score > bestScore) {
        bestScore = score;
        best = index;
      }
    });
    const box = boxes[best];
    if (!box) break;
    const { channel } = widest(box);
    box.sort((a, b) => a[channel] - b[channel]);
    const half = population(box) / 2;
    let seen = 0;
    let cut = 1;
    for (; cut < box.length - 1; cut++) {
      seen += box[cut - 1]?.count ?? 0;
      if (seen >= half) break;
    }
    boxes = [...boxes.slice(0, best), box.slice(0, cut), box.slice(cut), ...boxes.slice(best + 1)];
  }

  const palette = new Uint8Array(boxes.length * 3);
  boxes.forEach((box, index) => {
    const total = population(box);
    const mean = (channel: Channel): number =>
      Math.round(box.reduce((sum, bin) => sum + bin[channel] * bin.count, 0) / total);
    palette.set([mean('r'), mean('g'), mean('b')], index * 3);
  });
  return palette;
}

function population(box: readonly Bin[]): number {
  return box.reduce((sum, bin) => sum + bin.count, 0);
}

function widest(box: readonly Bin[]): { channel: Channel; range: number } {
  const range = (channel: Channel): number => {
    let low = Infinity;
    let high = -Infinity;
    for (const bin of box) {
      low = Math.min(low, bin[channel]);
      high = Math.max(high, bin[channel]);
    }
    return high - low;
  };
  const ranges = { r: range('r'), g: range('g'), b: range('b') };
  const channel = (['r', 'g', 'b'] as const).reduce((a, b) => (ranges[b] > ranges[a] ? b : a));
  return { channel, range: ranges[channel] };
}

/**
 * The nearest palette entry for every pixel, cached per colour at 6 bits per channel. The first
 * `keptCount` entries are the kept colours, which their exact pixels always map to.
 */
function mapToPalette(rgb: Uint8Array, palette: Uint8Array, keptCount: number): Uint8Array {
  const exact = new Map<number, number>();
  for (let index = 0; index < keptCount; index++) {
    const [r = 0, g = 0, b = 0] = palette.subarray(index * 3, index * 3 + 3);
    exact.set((r << 16) | (g << 8) | b, index);
  }
  const cache = new Int16Array(1 << 18).fill(-1);
  const indices = new Uint8Array(rgb.length / 3);
  for (let pixel = 0; pixel < indices.length; pixel++) {
    const r = rgb[pixel * 3] ?? 0;
    const g = rgb[pixel * 3 + 1] ?? 0;
    const b = rgb[pixel * 3 + 2] ?? 0;
    const kept = exact.get((r << 16) | (g << 8) | b);
    if (kept !== undefined) {
      indices[pixel] = kept;
      continue;
    }
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    let index = cache[key] ?? -1;
    if (index < 0) {
      index = nearest(palette, r, g, b);
      cache[key] = index;
    }
    indices[pixel] = index;
  }
  return indices;
}

function nearest(palette: Uint8Array, r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < palette.length / 3; index++) {
    const dr = (palette[index * 3] ?? 0) - r;
    const dg = (palette[index * 3 + 1] ?? 0) - g;
    const db = (palette[index * 3 + 2] ?? 0) - b;
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

function encodePalettePng(
  width: number,
  height: number,
  palette: Uint8Array,
  indices: Uint8Array,
): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, COLOR_TYPE_PALETTE, 0, 0, 0], 8);

  // Filter type 0 (none) on every row, which compresses palette images best.
  const rows = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    rows.set(indices.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('PLTE', Buffer.from(palette)),
    chunk('IDAT', deflateSync(rows, { level: 9, memLevel: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, crc]);
}
