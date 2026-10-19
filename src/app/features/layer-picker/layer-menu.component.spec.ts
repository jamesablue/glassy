import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { MapUiStore } from '../../state';
import { ABOUT_POPOVER_ID } from '../about/about-popover.component';
import { UNITS_POPOVER_ID } from '../settings/units-popover.component';
import { LayerMenuComponent } from './layer-menu.component';

describe('LayerMenuComponent', () => {
  let fixture: ComponentFixture<LayerMenuComponent>;
  let element: HTMLElement;
  let mapUi: MapUiStore;

  beforeEach(async () => {
    localStorage.clear();
    mapUi = TestBed.inject(MapUiStore);
    fixture = TestBed.createComponent(LayerMenuComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const button = (name: string): HTMLButtonElement | undefined =>
    Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.querySelector('.label')?.textContent === name,
    );
  const pressed = (group: string): string[] =>
    Array.from(
      element.querySelectorAll(`[aria-label="${group}"] button[aria-pressed="true"]`),
      (candidate) => candidate.querySelector('.label')?.textContent ?? '',
    );

  it('is a named navigation landmark', () => {
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Map controls');
  });

  it('offers every layer, with the active one pressed', () => {
    const layers = Array.from(
      element.querySelectorAll('[aria-label="Map layer"] button .label'),
      (label) => label.textContent,
    );
    expect(layers).toEqual(['Wind', 'Waves', 'Swell', 'Swell period', 'Depth']);
    expect(pressed('Map layer')).toEqual(['Waves']);
  });

  it('switches the layer', async () => {
    button('Depth')?.click();
    await fixture.whenStable();
    expect(mapUi.activeLayer()).toBe('depth');
    expect(pressed('Map layer')).toEqual(['Depth']);
    expect(button('Depth')?.classList.contains('active')).toBe(true);
  });

  it('turns the particles and spots off and on', async () => {
    expect(pressed('Map overlays')).toEqual(['Particles', 'Spots']);
    button('Particles')?.click();
    button('Spots')?.click();
    await fixture.whenStable();
    expect(mapUi.particlesOn()).toBe(false);
    expect(mapUi.spotsOn()).toBe(false);
    expect(pressed('Map overlays')).toEqual([]);

    button('Spots')?.click();
    await fixture.whenStable();
    expect(pressed('Map overlays')).toEqual(['Spots']);
  });

  it('opens the Units and About popovers natively', () => {
    expect(button('Units')?.getAttribute('popovertarget')).toBe(UNITS_POPOVER_ID);
    expect(button('About')?.getAttribute('popovertarget')).toBe(ABOUT_POPOVER_ID);
  });
});
