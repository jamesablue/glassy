import { TestBed } from '@angular/core/testing';
import type { UnitSettings } from '../../../domain/models';
import type { PointReading } from '../../../state';
import { PointReadoutComponent } from './point-readout.component';

describe('PointReadoutComponent', () => {
  const UNITS: UnitSettings = { height: 'ft', speed: 'kt', temperature: 'f' };
  const READING: PointReading = {
    point: { lat: 21.2, lon: -157.7 },
    time: undefined,
    forecast: {
      status: 'ready',
      sample: {
        windSpeed: 5,
        windDirection: 90,
        waveHeight: 1,
        wavePeriod: 9,
        waveDirection: 180,
        swellHeight: 0.5,
        swellPeriod: 14,
        swellDirection: 315,
      },
    },
    elevation: { status: 'loading' },
  };

  function render(reading: PointReading | null, units = UNITS): HTMLElement {
    const fixture = TestBed.createComponent(PointReadoutComponent);
    fixture.componentRef.setInput('reading', reading);
    fixture.componentRef.setInput('units', units);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const rows = (element: HTMLElement): string[][] =>
    Array.from(element.querySelectorAll('.row'), (row) => [
      row.querySelector('dt')?.textContent?.trim() ?? '',
      row.querySelector('dd')?.textContent?.trim() ?? '',
    ]);

  it('lists the forecast and the depth at the point', () => {
    const element = render(READING);
    expect(element.querySelector('.title')?.textContent).toBe('21.2000°, -157.7000°');
    expect(rows(element)).toEqual([
      ['Wind', '10 kt E'],
      ['Waves', '3.3 ft · 9s'],
      ['Swell', '1.6 ft · 14s'],
      ['Depth', 'loading…'],
    ]);
  });

  it('points each arrow the way the wind or waves travel', () => {
    const arrows = render(READING).querySelectorAll<SVGElement>('.arrow');
    expect(Array.from(arrows, (arrow) => arrow.style.transform)).toEqual([
      'rotate(270deg)',
      'rotate(0deg)',
      'rotate(135deg)',
    ]);
  });

  it('highlights the depth and announces it when it arrives', () => {
    const element = render(READING);
    expect(element.querySelector('.row.depth dt')?.textContent).toBe('Depth');
    expect(element.querySelector('dl')?.getAttribute('aria-live')).toBe('polite');
  });

  it('is empty without a reading', () => {
    expect(render(null).textContent?.trim()).toBe('');
  });
});
