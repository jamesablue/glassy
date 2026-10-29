import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { renderMap, resizeMap } from '../../../../testing/map-harness';
import { PREFERS_REDUCED_MOTION } from '../../../core/reduced-motion';
import { OAHU_SPOTS } from '../../../domain/spots';
import { SettingsStore, type SpotPin } from '../../../state';
import { panelInsets } from '../../map-host/frame-oahu';
import { MapHostComponent } from '../../map-host/map-host.component';
import { visibleArea } from '../../map-host/visible-area';
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
        <glassy-spot-markers
          [pins]="pins()"
          [hoveredId]="hoveredId()"
          (pinSelect)="selected.push($event)"
          (pinHover)="hovers.push($event)"
        />
      }
    </glassy-map>
  `,
})
class HostComponent {
  readonly shown = signal(true);
  readonly pins = signal<readonly SpotPin[]>(PINS);
  readonly hoveredId = signal<string | null>(null);
  readonly selected: string[] = [];
  readonly hovers: (string | null)[] = [];
}

describe('SpotMarkersComponent', () => {
  const reducedMotion = signal(false);

  beforeEach(() => {
    localStorage.clear();
    reducedMotion.set(false);
    TestBed.configureTestingModule({
      providers: [{ provide: PREFERS_REDUCED_MOTION, useValue: reducedMotion }],
    });
  });

  async function setup(width = 1280, height = 800) {
    const fixture = TestBed.createComponent(HostComponent);
    const map = await renderMap(fixture);
    resizeMap(fixture, width, height);
    return { fixture, map, host: fixture.componentInstance };
  }

  const HANAUMA = L.latLng(21.2693, -157.694);
  /** Where a point sits on screen, rounded to whole pixels. */
  const screenPoint = (map: L.Map, point: L.LatLng): [number, number] => {
    const { x, y } = map.latLngToContainerPoint(point);
    return [Math.round(x), Math.round(y)];
  };
  /**
   * Where `point` lands on screen once the map is centred on `centre` at `zoom`. Worked out from
   * the arguments rather than read off the map, because Leaflet in jsdom rounds zooms to whole
   * levels (it only snaps to quarter levels where CSS 3D transforms work).
   */
  const landing = (map: L.Map, point: L.LatLng, centre: L.LatLng, zoom: number) => {
    const { x, y } = map
      .project(point, zoom)
      .subtract(map.project(centre, zoom))
      .add(map.getSize().divideBy(2));
    return [Math.round(x), Math.round(y)];
  };
  /** The middle of what the panels leave uncovered while a spot is open. */
  const visibleMiddle = (map: L.Map): [number, number] => {
    const size = map.getSize();
    const { x, y } = visibleArea(size, panelInsets(size.x, size.y, true)).getCenter();
    return [Math.round(x), Math.round(y)];
  };

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
    expect(after.querySelector('.surf')?.textContent).toBe('6–8 ft');
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

  it('reports the spot whose pin the pointer is over', async () => {
    const { host } = await setup();
    pinButton('Hanauma Bay').dispatchEvent(new MouseEvent('mouseenter'));
    pinButton('Hanauma Bay').dispatchEvent(new MouseEvent('mouseleave'));
    expect(host.hovers).toEqual(['hanauma', null]);
  });

  it('highlights the hovered spot’s pin and lifts it above its neighbours', async () => {
    const { fixture, host } = await setup();
    const marker = (name: string): HTMLElement | null =>
      pinButton(name).closest<HTMLElement>('.leaflet-marker-icon');
    const zIndex = (name: string): number => Number(marker(name)?.style.zIndex);
    const resting = zIndex('Hanauma Bay');

    host.hoveredId.set('hanauma');
    update(fixture);
    expect(pinButton('Hanauma Bay').classList.contains('hovered')).toBe(true);
    expect(pinButton('Kaimana').classList.contains('hovered')).toBe(false);
    expect(zIndex('Hanauma Bay')).toBe(resting + 1000);

    host.hoveredId.set('kaimana');
    update(fixture);
    expect(pinButton('Hanauma Bay').classList.contains('hovered')).toBe(false);
    expect(zIndex('Hanauma Bay')).toBe(resting);
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
    const selectHanauma = (fixture: ComponentFixture<HostComponent>, host: HostComponent): void => {
      host.pins.set(PINS.map((pin) => ({ ...pin, selected: pin.id === 'hanauma' })));
      update(fixture);
    };

    it('flies a selected spot beside the side panel, not behind it', async () => {
      const { fixture, host, map } = await setup();
      map.setView([21.5, -158], 9, { animate: false });
      const flyTo = vi.spyOn(map, 'flyTo').mockReturnThis();
      selectHanauma(fixture, host);

      expect(flyTo).toHaveBeenCalledExactlyOnceWith(expect.any(L.LatLng), 11.5, { duration: 0.8 });
      const [centre] = flyTo.mock.calls[0] as [L.LatLng];
      const [x, y] = landing(map, HANAUMA, centre, 11.5);
      expect([x, y]).toEqual(visibleMiddle(map));
      // Right of the side panel, so right of the map's own middle.
      expect(x).toBeGreaterThan(640);
    });

    it('lands the spot above the details sheet on a phone', async () => {
      const { fixture, host, map } = await setup(390, 800);
      map.setView([21.5, -158], 9, { animate: false });
      const flyTo = vi.spyOn(map, 'flyTo').mockReturnThis();
      selectHanauma(fixture, host);

      const [centre] = flyTo.mock.calls[0] as [L.LatLng];
      const [, y] = landing(map, HANAUMA, centre, 11.5);
      expect(y).toBe(visibleMiddle(map)[1]);
      expect(y).toBeLessThan(800 - Math.round(800 * 0.46) - 96);
    });

    it('moves at once instead of flying when the user prefers reduced motion', async () => {
      reducedMotion.set(true);
      const { fixture, host, map } = await setup();
      map.setView([21.5, -158], 9, { animate: false });
      const flyTo = vi.spyOn(map, 'flyTo');
      const setView = vi.spyOn(map, 'setView');
      selectHanauma(fixture, host);

      expect(flyTo).not.toHaveBeenCalled();
      expect(setView).toHaveBeenCalledExactlyOnceWith(
        expect.any(L.LatLng),
        11.5,
        expect.objectContaining({ animate: false }),
      );
      const [centre] = setView.mock.calls[0] as [L.LatLng];
      expect(landing(map, HANAUMA, centre, 11.5)).toEqual(visibleMiddle(map));
    });

    it('stays put when the selected spot is already in view up close', async () => {
      const { fixture, host, map } = await setup();
      map.setView([21.2693, -157.67], 12, { animate: false });
      const flyTo = vi.spyOn(map, 'flyTo').mockReturnThis();
      selectHanauma(fixture, host);
      expect(flyTo).not.toHaveBeenCalled();
    });

    it('moves a spot that is up close but behind the side panel', async () => {
      const { fixture, host, map } = await setup();
      // Up close, with Hanauma Bay 150 px from the left edge: under the side panel.
      map.setView(HANAUMA, 12, { animate: false });
      map.panBy([490, 0], { animate: false });
      expect(screenPoint(map, HANAUMA)).toEqual([150, 400]);

      const flyTo = vi.spyOn(map, 'flyTo').mockReturnThis();
      selectHanauma(fixture, host);
      expect(flyTo).toHaveBeenCalled();
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

  describe('keyboard focus', () => {
    const focusPin = (name: string): void => {
      const button = pinButton(name);
      vi.spyOn(button, 'matches').mockReturnValue(true);
      button.dispatchEvent(new FocusEvent('focus'));
    };

    it('brings a pin into view, clear of the panels', async () => {
      const { map } = await setup();
      const panInside = vi.spyOn(map, 'panInside').mockReturnThis();
      focusPin('Hanauma Bay');
      expect(panInside).toHaveBeenCalledWith([21.2693, -157.694], {
        paddingTopLeft: L.point(344 + 48, 12 + 48),
        paddingBottomRight: L.point(160 + 48, 90 + 48),
        animate: true,
      });
    });

    it('gives a short phone screen less room around the pin, and does not animate', async () => {
      reducedMotion.set(true);
      const { map } = await setup(390, 300);
      const panInside = vi.spyOn(map, 'panInside').mockReturnThis();
      focusPin('Hanauma Bay');
      // 300 px tall: 56 px under the brand, 156 px for the folded sheet and the timeline.
      expect(panInside).toHaveBeenCalledWith([21.2693, -157.694], {
        paddingTopLeft: L.point(8 + 22, 56 + 22),
        paddingBottomRight: L.point(52 + 22, 156 + 22),
        animate: false,
      });
    });
  });

  it('removes every marker and pin component when destroyed', async () => {
    const { fixture, host, map } = await setup();
    host.shown.set(false);
    update(fixture);
    expect(pinButtons()).toEqual([]);
    expect(map.getPane('markerPane')?.children).toHaveLength(0);
  });
});
