import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { UnitSettings } from '../../domain/models';
import {
  CompassPipe,
  DepthPipe,
  HeightPipe,
  HstTimePipe,
  SpeedPipe,
  SurfRangePipe,
  TemperaturePipe,
} from './index';

@Component({
  imports: [
    CompassPipe,
    DepthPipe,
    HeightPipe,
    HstTimePipe,
    SpeedPipe,
    SurfRangePipe,
    TemperaturePipe,
  ],
  template: `
    <p class="height">{{ 1 | height: units().height }}</p>
    <p class="speed">{{ 10 | speed: units().speed }}</p>
    <p class="temperature">{{ 26 | temperature: units().temperature }}</p>
    <p class="depth">{{ 8.5 | depth: units().height }}</p>
    <p class="compass">{{ 100 | compass }}</p>
    <p class="surf">{{ 1 | surfRange: units().height }}</p>
    <p class="time">{{ time | hstTime: 'day' }}</p>
  `,
})
class HostComponent {
  readonly units = signal<UnitSettings>({ height: 'ft', speed: 'kt', temperature: 'f' });
  /** 3 PM on Sunday 18 October 2026 in Honolulu. */
  readonly time = Date.UTC(2026, 9, 19, 1) / 1000;
}

describe('the unit pipes in a template', () => {
  it('format values and follow a change of units, staying pure', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const read = (): Record<string, string> =>
      Object.fromEntries(
        Array.from(element.querySelectorAll('p'), (p) => [p.className, p.textContent ?? '']),
      );

    expect(read()).toEqual({
      height: '3.3',
      speed: '19',
      temperature: '79°F',
      depth: '28 ft',
      compass: 'E',
      surf: '2–4 ft',
      time: 'Sun 18',
    });

    fixture.componentInstance.units.set({ height: 'm', speed: 'kmh', temperature: 'c' });
    await fixture.whenStable();
    expect(read()).toMatchObject({
      height: '1.0',
      speed: '36',
      temperature: '26.0°C',
      depth: '8.5 m',
      surf: '0.8–1.2 m',
    });
  });
});
