import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { renderMap, resizeMap } from '../../../../testing/map-harness';
import { OAHU_SPOTS } from '../../../domain/spots';
import { SettingsStore, type SpotPin } from '../../../state';
import { MapHostComponent } from '../../map-host/map-host.component';
import { SpotMarkersComponent } from './spot-markers.component';

const PINS: readonly SpotPin[] = OAHU_SPOTS.map((spot, index) => ({
  id: spot.id,
  name: spot.name,
  lat: spot.lat,
  lon: spot.lon,
  score: 10 - index * 0.2,
  color: '#34d399',
  surf: 0.5,
  selected: false,
}));

@Component({
  imports: [MapHostComponent, SpotMarkersComponent],
  template: `
    <glassy-map>
      @if (shown()) {
        <glassy-spot-markers [pins]="pins()" (pinSelect)="selected.push($event)" />
      }
    </glassy-map>
  `,
})
class HostComponent {
  readonly shown = signal(true);
  readonly pins = signal<readonly SpotPin[]>(PINS);
  readonly selected: string[] = [];
}

describe('SpotMarkersComponent', () => {
  beforeEach(() => localStorage.clear());

  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    const map = await renderMap(fixture);
    resizeMap(fixture, 1280, 800);
    return { fixture, map, host: fixture.componentInstance };
  }

  function update(fixture: ComponentFixture<HostComponent>): void {
    fixture.detectChanges();
    TestBed.tick();
  }

  const pinButtons = (): HTMLButtonElement[] =>
    Array.from(document.querySelectorAll('.leaflet-marker-pane glassy-spot-pin button'));
  const pinButton = (name: string): HTMLButtonElement => {
    const button = pinButtons().find((pin) => pin.getAttribute('aria-label')?.startsWith(name));
    if (!button) throw new Error(`No pin for ${name}`);
    return button;
  };

  it('puts one pin component on the map for every spot', async () => {
    await setup();
    expect(pinButtons()).toHaveLength(OAHU_SPOTS.length);
    expect(pinButton('Hanauma Bay').querySelector('.surf')?.textContent).toBe('1–2 ft');
  });

  it('updates pins in place when the forecast hour changes', async () => {
    const { fixture, host } = await setup();
    const before = pinButton('Hanauma Bay');
    host.pins.set(PINS.map((pin) => ({ ...pin, surf: 2 })));
    update(fixture);

    const after = pinButton('Hanauma Bay');
    expect(after).toBe(before);
    expect(after.querySelector('.surf')?.textContent).toBe('5–8 ft');
  });

  it('adds and removes pins as the list changes', async () => {
    const { fixture, host } = await setup();
    host.pins.set(PINS.slice(0, 3));
    update(fixture);
    expect(pinButtons()).toHaveLength(3);

    host.pins.set(PINS.slice(0, 5));
    update(fixture);
    expect(pinButtons()).toHaveLength(5);
  });

  it('moves a pin whose spot moved', async () => {
    const { fixture, host } = await setup();
    const position = (): string | null | undefined =>
      pinButton('Hanauma Bay').closest('.spot-icon')?.getAttribute('style');
    const before = position();
    host.pins.set(PINS.map((pin) => (pin.id === 'hanauma' ? { ...pin, lat: pin.lat + 0.1 } : pin)));
    update(fixture);
    expect(position()).not.toBe(before);
  });

  it('marks the selected spot', async () => {
    const { fixture, host } = await setup();
    host.pins.set(PINS.map((pin) => ({ ...pin, selected: pin.id === 'hanauma' })));
    update(fixture);
    expect(pinButton('Hanauma Bay').classList.contains('selected')).toBe(true);
    expect(pinButton('Kaimana').classList.contains('selected')).toBe(false);
  });

  it('reports a pin click as a selection', async () => {
    const { host } = await setup();
    pinButton('Hanauma Bay').click();
    expect(host.selected).toEqual(['hanauma']);
  });

  it('shows the surf in the units the user picked', async () => {
    const { fixture } = await setup();
    TestBed.inject(SettingsStore).setUnit('height', 'm');
    update(fixture);
    expect(pinButton('Hanauma Bay').querySelector('.surf')?.textContent).toBe('0.4–0.6 m');
  });

  describe('labels', () => {
    const modes = (): { full: number; heightOnly: number; dots: number } => {
      const buttons = pinButtons();
      const dots = buttons.filter((pin) => pin.classList.contains('compact')).length;
      const named = buttons.filter((pin) => !pin.classList.contains('no-name')).length;
      return { full: named, heightOnly: buttons.length - named - dots, dots };
    };

    it('leaves names out when zoomed out and squeezes crowded labels to dots', async () => {
      await setup();
      const { full, heightOnly, dots } = modes();
      expect(full).toBe(0);
      expect(heightOnly).toBeGreaterThan(0);
      expect(dots).toBeGreaterThan(0);
    });

    it('names the spots that fit once zoomed in', async () => {
      const { map } = await setup();
      map.setView([21.3, -157.75], 13, { animate: false });
      TestBed.tick();
      expect(modes().full).toBeGreaterThan(0);
    });

    it('gives the selected spot its label first', async () => {
      const { fixture, host } = await setup();
      const squeezed = pinButtons().find((pin) => pin.classList.contains('compact'));
      const name = squeezed?.querySelector('.name')?.textContent ?? '';
      const id = PINS.find((pin) => pin.name === name)?.id;

      host.pins.set(PINS.map((pin) => ({ ...pin, selected: pin.id === id })));
      update(fixture);
      expect(pinButton(name).classList.contains('compact')).toBe(false);
    });
  });

  describe('selection', () => {
    it('flies to a selected spot while the map is zoomed out', async () => {
      const { fixture, host, map } = await setup();
      map.setView([21.5, -158], 9, { animate: false });
      const flyTo = vi.spyOn(map, 'flyTo').mockReturnThis();
      host.pins.set(PINS.map((pin) => ({ ...pin, selected: pin.id === 'hanauma' })));
      update(fixture);
      expect(flyTo).toHaveBeenCalledWith(
        expect.objectContaining({ lat: 21.2693, lng: -157.694 }),
        11.5,
        { duration: 0.8 },
      );
    });

    it('stays put when the selected spot is already in view up close', async () => {
      const { fixture, host, map } = await setup();
      map.setView([21.2693, -157.694], 12, { animate: false });
      const flyTo = vi.spyOn(map, 'flyTo').mockReturnThis();
      host.pins.set(PINS.map((pin) => ({ ...pin, selected: pin.id === 'hanauma' })));
      update(fixture);
      expect(flyTo).not.toHaveBeenCalled();
    });

    it('does not fly again when only the hour changes', async () => {
      const { fixture, host, map } = await setup();
      host.pins.set(PINS.map((pin) => ({ ...pin, selected: pin.id === 'hanauma' })));
      update(fixture);
      const flyTo = vi.spyOn(map, 'flyTo').mockReturnThis();
      host.pins.set(PINS.map((pin) => ({ ...pin, surf: 1, selected: pin.id === 'hanauma' })));
      update(fixture);
      expect(flyTo).not.toHaveBeenCalled();
    });
  });

  it('brings a pin into view when it gets keyboard focus', async () => {
    const { map } = await setup();
    const panInside = vi.spyOn(map, 'panInside').mockReturnThis();
    const button = pinButton('Hanauma Bay');
    vi.spyOn(button, 'matches').mockReturnValue(true);
    button.dispatchEvent(new FocusEvent('focus'));
    expect(panInside).toHaveBeenCalledWith([21.2693, -157.694], { padding: [48, 48] });
  });

  it('removes every marker and pin component when destroyed', async () => {
    const { fixture, host, map } = await setup();
    host.shown.set(false);
    update(fixture);
    expect(pinButtons()).toEqual([]);
    expect(map.getPane('markerPane')?.children).toHaveLength(0);
  });
});
