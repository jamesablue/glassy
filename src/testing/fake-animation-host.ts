import type { AnimationHost } from '../app/map/renderers/particle-system';

type Listener = () => void;

/** A media query whose `matches` a test can flip, notifying listeners like the real one. */
class FakeMediaQuery {
  private readonly listeners = new Set<Listener>();
  private value = false;

  get matches(): boolean {
    return this.value;
  }

  set(matches: boolean): void {
    this.value = matches;
    this.listeners.forEach((listener) => listener());
  }

  addEventListener(_type: string, listener: Listener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: Listener): void {
    this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

/** The page as the particle animation sees it, with frames that only run when a test says so. */
export class FakeAnimationHost implements AnimationHost {
  devicePixelRatio = 1;
  readonly reducedMotion = new FakeMediaQuery();
  readonly document = new FakePageVisibility();
  private readonly frames = new Map<number, FrameRequestCallback>();
  private nextHandle = 1;

  requestAnimationFrame(callback: FrameRequestCallback): number {
    const handle = this.nextHandle++;
    this.frames.set(handle, callback);
    return handle;
  }

  cancelAnimationFrame(handle: number): void {
    this.frames.delete(handle);
  }

  matchMedia(): FakeMediaQuery {
    return this.reducedMotion;
  }

  /** Frames waiting to run. */
  get pendingFrames(): number {
    return this.frames.size;
  }

  /** Runs the frames scheduled so far, `count` times over. */
  runFrames(count = 1): void {
    for (let i = 0; i < count; i++) {
      const due = [...this.frames.values()];
      this.frames.clear();
      due.forEach((callback) => callback(0));
    }
  }
}

/** `document.hidden` and its `visibilitychange` event. */
class FakePageVisibility {
  hidden = false;
  private readonly listeners = new Set<Listener>();

  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.listeners.forEach((listener) => listener());
  }

  addEventListener(_type: string, listener: Listener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: Listener): void {
    this.listeners.delete(listener);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}
