import { ErrorHandler, inject, Injectable, type Provider } from '@angular/core';
import { AppNotices } from './app-notices';

/** Distinct errors remembered as logged; older ones may be logged again after this many. */
const REMEMBERED_ERRORS = 50;

/**
 * The app's `ErrorHandler`: where every error no code handled ends up, whether it was thrown in a
 * template, an effect, an event handler or (through `provideBrowserGlobalErrorListeners`) a timer
 * or a rejected promise.
 *
 * It logs each distinct error once, with its stack, so a fault that repeats (in an animation frame,
 * say) does not flood the console, and raises an `unexpected-error` notice so the user hears that
 * something went wrong. The notice is generic on purpose: messages and stack traces are for the
 * console, not the screen.
 */
@Injectable()
export class GlassyErrorHandler implements ErrorHandler {
  private readonly notices = inject(AppNotices);
  private readonly logged = new Set<string>();

  handleError(error: unknown): void {
    if (this.firstTime(error)) console.error('Glassy: unexpected error', error);
    this.notices.raise('unexpected-error');
  }

  /** Whether `error` has not been logged yet, and remembers it. */
  private firstTime(error: unknown): boolean {
    const signature = signatureOf(error);
    if (this.logged.has(signature)) return false;
    if (this.logged.size >= REMEMBERED_ERRORS) {
      // Sets iterate in insertion order, so the first entry is the oldest.
      const oldest = this.logged.values().next().value;
      if (oldest !== undefined) this.logged.delete(oldest);
    }
    this.logged.add(signature);
    return true;
  }
}

/** What makes two errors the same one: type, message and where it was thrown. */
function signatureOf(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ''}`;
  try {
    return `${typeof error}: ${String(error)}`;
  } catch {
    return typeof error;
  }
}

/** Makes {@link GlassyErrorHandler} the app's `ErrorHandler`. */
export function provideGlassyErrorHandler(): Provider {
  return { provide: ErrorHandler, useClass: GlassyErrorHandler };
}
