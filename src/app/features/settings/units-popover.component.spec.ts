import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { installFakePopover, type FakePopover } from '../../../testing/fake-popover';
import { SettingsStore } from '../../state';
import { UNITS_POPOVER_ID, UnitsPopoverComponent } from './units-popover.component';

describe('UnitsPopoverComponent', () => {
  let fake: FakePopover;
  let fixture: ComponentFixture<UnitsPopoverComponent>;
  let element: HTMLElement;
  let settings: SettingsStore;

  beforeEach(async () => {
    localStorage.clear();
    fake = installFakePopover();
    settings = TestBed.inject(SettingsStore);
    fixture = TestBed.createComponent(UnitsPopoverComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => fake.restore());

  const popover = (): HTMLElement => element.querySelector('glassy-popover') as HTMLElement;
  const group = (label: string): HTMLElement | undefined =>
    Array.from(element.querySelectorAll<HTMLElement>('[role="radiogroup"]')).find(
      (candidate) =>
        document.getElementById(candidate.getAttribute('aria-labelledby') ?? '')?.textContent ===
        label,
    );
  const option = (label: string, choice: string): HTMLButtonElement | undefined =>
    Array.from(group(label)?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === choice,
    );
  const checked = (label: string): string | undefined =>
    group(label)?.querySelector('[aria-checked="true"]')?.textContent?.trim();

  it('is the popover the Units button opens, titled Units', () => {
    expect(popover().id).toBe(UNITS_POPOVER_ID);
    expect(popover().querySelector('h2')?.textContent).toBe('Units');
  });

  it('shows the current units, each control named by its visible label', () => {
    expect(checked('Waves & depth')).toBe('ft');
    expect(checked('Wind')).toBe('kt');
    expect(checked('Temperature')).toBe('°F');
    expect(
      Array.from(group('Wind')?.querySelectorAll('button') ?? [], (b) => b.textContent?.trim()),
    ).toEqual(['kt', 'mph', 'km/h', 'm/s']);
  });

  it('changes the units everywhere', async () => {
    option('Waves & depth', 'm')?.click();
    option('Wind', 'km/h')?.click();
    option('Temperature', '°C')?.click();
    await fixture.whenStable();

    expect(settings.units()).toEqual({ height: 'm', speed: 'kmh', temperature: 'c' });
    expect(checked('Waves & depth')).toBe('m');
    expect(checked('Wind')).toBe('km/h');
    expect(checked('Temperature')).toBe('°C');
  });

  it('follows the browser as it opens and closes, including Escape', async () => {
    expect(fixture.componentInstance.isOpen()).toBe(false);
    popover().showPopover();
    expect(fixture.componentInstance.isOpen()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });
});
