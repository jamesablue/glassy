import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ConnectivityStore } from './connectivity.store';

describe('ConnectivityStore', () => {
  let onLine: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    onLine = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(true);
  });

  afterEach(() => onLine.mockRestore());

  /** The browser loses its connection, or gets it back. */
  function connection(online: boolean): void {
    onLine.mockReturnValue(online);
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  }

  it('starts with what the browser reports', () => {
    onLine.mockReturnValue(false);
    expect(TestBed.inject(ConnectivityStore).online()).toBe(false);
  });

  it('follows the browser going offline and back online', () => {
    const store = TestBed.inject(ConnectivityStore);
    expect(store.online()).toBe(true);

    connection(false);
    expect(store.online()).toBe(false);
    connection(true);
    expect(store.online()).toBe(true);
  });

  it('stops listening when the app is destroyed', () => {
    const store = TestBed.inject(ConnectivityStore);
    TestBed.resetTestingModule();

    connection(false);
    expect(store.online()).toBe(true);
  });

  it('assumes a connection where there is no window', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: null } }],
    });
    expect(TestBed.inject(ConnectivityStore).online()).toBe(true);
  });
});
