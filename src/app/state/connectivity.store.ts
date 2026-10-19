import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * Whether the browser thinks it is online, following its `online` and `offline` events.
 *
 * `navigator.onLine` is only a hint: `false` reliably means no network, while `true` may still mean
 * a captive portal or a dead connection. So the app uses it to explain and to retry at the right
 * moment, never to skip a request.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityStore {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly state = signal(this.window?.navigator.onLine ?? true);

  /** `false` while the browser reports no network connection. */
  readonly online = this.state.asReadonly();

  constructor() {
    const window = this.window;
    if (!window) return;
    const follow = (): void => this.state.set(window.navigator.onLine);
    window.addEventListener('online', follow);
    window.addEventListener('offline', follow);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', follow);
      window.removeEventListener('offline', follow);
    });
  }
}
