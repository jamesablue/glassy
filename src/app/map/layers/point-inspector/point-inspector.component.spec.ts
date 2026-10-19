import { Component, signal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, type Observable } from 'rxjs';
import { recordedForecastBundle } from '../../../../testing/forecast-bundle';
import { renderMap } from '../../../../testing/map-harness';
import { provideFakeBathymetry, provideTestForecast } from '../../../../testing/state-providers';
import { MapUiStore, SettingsStore, TimelineStore } from '../../../state';
import { MapHostComponent } from '../../map-host/map-host.component';
import { PointInspectorComponent } from './point-inspector.component';

@Component({
  imports: [MapHostComponent, PointInspectorComponent],
  template: `
    <glassy-map>
      @if (shown()) {
        <glassy-point-inspector />
      }
    </glassy-map>
  `,
})
class HostComponent {
  readonly shown = signal(true);
}

describe('PointInspectorComponent', () => {
  /** 8:30 AM on the recorded forecast's first day in Honolulu. */
  const MORNING = Date.UTC(2026, 9, 18, 18, 30);
  /** Inside the recorded bundle's small test grid. */
  const POINT = { lat: 21, lon: -157.95 };
  const elevationAt = vi.fn<(lat: number, lon: number) => Observable<number>>();

  beforeEach(() => {
    localStorage.clear();
    elevationAt.mockReset().mockReturnValue(of(-8.5));
    TestBed.configureTestingModule({
      providers: [
        ...provideTestForecast(recordedForecastBundle(), MORNING),
        provideFakeBathymetry(elevationAt),
      ],
    });
  });

  async function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    const map = await renderMap(fixture);
    return { fixture, map, mapUi: TestBed.inject(MapUiStore) };
  }

  async function settle(fixture: ComponentFixture<HostComponent>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    TestBed.tick();
  }

  const popup = (): HTMLElement | null => document.querySelector('.leaflet-popup.picker');
  const readoutText = (): string =>
    popup()?.querySelector('glassy-point-readout')?.textContent ?? '';

  it('opens a readout at the inspected point', async () => {
    const { fixture, map, mapUi } = await setup();
    expect(popup()).toBeNull();

    mapUi.inspect(POINT);
    await settle(fixture);
    expect(map.getPane('popupPane')?.contains(popup())).toBe(true);
    expect(readoutText()).toContain('Wind');
    expect(readoutText()).toContain('28 ft');
    expect(elevationAt).toHaveBeenCalledWith(POINT.lat, POINT.lon);
  });

  it('moves to a newly inspected point', async () => {
    const { fixture, mapUi } = await setup();
    mapUi.inspect(POINT);
    await settle(fixture);
    mapUi.inspect({ lat: 21.05, lon: -157.9 });
    await settle(fixture);
    expect(document.querySelectorAll('.leaflet-popup.picker')).toHaveLength(1);
    expect(readoutText()).toContain('21.0500°, -157.9000°');
  });

  it('shows a loading depth until NOAA answers', async () => {
    elevationAt.mockReturnValue(NEVER);
    const { fixture, mapUi } = await setup();
    mapUi.inspect(POINT);
    fixture.detectChanges();
    TestBed.tick();
    expect(readoutText()).toContain('loading…');
  });

  it('follows the timeline and the units', async () => {
    const { fixture, mapUi } = await setup();
    mapUi.inspect(POINT);
    await settle(fixture);
    const before = readoutText();

    TestBed.inject(TimelineStore).step(1);
    await settle(fixture);
    expect(readoutText()).not.toBe(before);

    TestBed.inject(SettingsStore).setUnit('height', 'm');
    await settle(fixture);
    expect(readoutText()).toContain('8.5 m');
  });

  it('ends the inspection when the popup is closed', async () => {
    const { fixture, map, mapUi } = await setup();
    mapUi.inspect(POINT);
    await settle(fixture);

    map.closePopup();
    expect(mapUi.inspectedPoint()).toBeNull();
    expect(popup()).toBeNull();
  });

  it('closes the popup when the inspection is cleared elsewhere', async () => {
    const { fixture, mapUi } = await setup();
    mapUi.inspect(POINT);
    await settle(fixture);

    mapUi.clearInspection();
    await settle(fixture);
    expect(popup()).toBeNull();
  });

  it('removes the popup without touching the inspection when destroyed', async () => {
    const { fixture, mapUi } = await setup();
    mapUi.inspect(POINT);
    await settle(fixture);

    fixture.componentInstance.shown.set(false);
    await settle(fixture);
    expect(popup()).toBeNull();
    expect(mapUi.inspectedPoint()).toEqual(POINT);
  });
});
