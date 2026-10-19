import { inputBinding, outputBinding, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NotificationToastComponent } from './notification-toast.component';

describe('NotificationToastComponent', () => {
  const message = signal('Something happened.');
  const actionLabel = signal<string | null>(null);
  const urgent = signal(false);
  const autoHideMs = signal<number | null>(null);
  let actions: number;
  let dismissals: number;
  let fixture: ComponentFixture<NotificationToastComponent>;
  let element: HTMLElement;

  function render(): void {
    actions = 0;
    dismissals = 0;
    fixture = TestBed.createComponent(NotificationToastComponent, {
      bindings: [
        inputBinding('message', message),
        inputBinding('actionLabel', actionLabel),
        inputBinding('urgent', urgent),
        inputBinding('autoHideMs', autoHideMs),
        outputBinding('action', () => actions++),
        outputBinding('dismiss', () => dismissals++),
      ],
    });
    element = fixture.nativeElement as HTMLElement;
    // Synchronous, so it works under fake timers too.
    fixture.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
    message.set('Something happened.');
    actionLabel.set(null);
    urgent.set(false);
    autoHideMs.set(null);
  });

  it('shows a polite status message', () => {
    render();
    expect(element.textContent?.trim()).toBe('Something happened.');
    expect(element.getAttribute('role')).toBe('status');
    expect(element.querySelector('button')).toBeNull();
  });

  it('announces an urgent message at once and offers its action', () => {
    urgent.set(true);
    actionLabel.set('Retry');
    render();
    expect(element.getAttribute('role')).toBe('alert');
    const button = element.querySelector('button');
    expect(button?.textContent).toBe('Retry');
    button?.click();
    expect(actions).toBe(1);
  });

  it('asks to be dismissed after its time is up, counting again for a new message', () => {
    vi.useFakeTimers();
    autoHideMs.set(7000);
    render();

    vi.advanceTimersByTime(6000);
    message.set('Something else happened.');
    TestBed.tick();
    vi.advanceTimersByTime(6000);
    expect(dismissals).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(dismissals).toBe(1);
  });

  it('stays until acted on without a time limit', () => {
    vi.useFakeTimers();
    render();
    vi.advanceTimersByTime(60_000);
    expect(dismissals).toBe(0);
  });
});
