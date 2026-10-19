/** A trail segment drawn by `moveTo` followed by `lineTo`. */
export type Segment = readonly [x0: number, y0: number, x1: number, y1: number];

/**
 * A canvas 2D context that records what is drawn. jsdom has no canvas, and the renderers only need
 * the handful of calls below.
 */
export class FakeContext2D {
  globalCompositeOperation = 'source-over';
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  transform: readonly number[] = [1, 0, 0, 1, 0, 0];
  /** Segments of the path being built, cleared by `beginPath`. */
  path: Segment[] = [];
  /** Every path that was stroked. */
  readonly strokes: Segment[][] = [];
  readonly fills: { readonly style: string; readonly operation: string }[] = [];
  readonly putImages: ImageData[] = [];
  clears = 0;
  private pen: readonly [number, number] = [0, 0];

  createImageData(width: number, height: number): ImageData {
    return { data: new Uint8ClampedArray(width * height * 4), width, height } as ImageData;
  }

  putImageData(image: ImageData): void {
    this.putImages.push(image);
  }

  clearRect(): void {
    this.clears++;
  }

  fillRect(): void {
    this.fills.push({ style: this.fillStyle, operation: this.globalCompositeOperation });
  }

  setTransform(...matrix: number[]): void {
    this.transform = matrix;
  }

  beginPath(): void {
    this.path = [];
  }

  moveTo(x: number, y: number): void {
    this.pen = [x, y];
  }

  lineTo(x: number, y: number): void {
    this.path.push([...this.pen, x, y]);
    this.pen = [x, y];
  }

  stroke(): void {
    this.strokes.push(this.path);
  }
}

/** A canvas whose `getContext('2d')` returns a {@link FakeContext2D}. */
export function fakeCanvas(): { canvas: HTMLCanvasElement; context: FakeContext2D } {
  const canvas = document.createElement('canvas');
  const context = new FakeContext2D();
  Object.defineProperty(canvas, 'getContext', { value: () => context });
  return { canvas, context };
}

/**
 * Makes every canvas created from now on hand out a {@link FakeContext2D}, for components that
 * create their own canvases. Returns the contexts in creation order and a function that undoes it.
 */
export function installFakeCanvas(): { contexts: FakeContext2D[]; restore: () => void } {
  const prototype = HTMLCanvasElement.prototype;
  const original = Object.getOwnPropertyDescriptor(prototype, 'getContext');
  const contexts: FakeContext2D[] = [];
  const byCanvas = new WeakMap<HTMLCanvasElement, FakeContext2D>();
  Object.defineProperty(prototype, 'getContext', {
    configurable: true,
    value(this: HTMLCanvasElement) {
      let context = byCanvas.get(this);
      if (!context) {
        context = new FakeContext2D();
        byCanvas.set(this, context);
        contexts.push(context);
      }
      return context;
    },
  });
  return {
    contexts,
    restore: () => {
      if (original) Object.defineProperty(prototype, 'getContext', original);
    },
  };
}
