import { inputBinding, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { legendSpec, type LegendSpec } from '../../domain/legend';
import type { UnitSettings } from '../../domain/models';
import { LegendComponent } from './legend.component';

describe('LegendComponent', () => {
  const IMPERIAL: UnitSettings = { height: 'ft', speed: 'kt', temperature: 'f' };
  const METRIC: UnitSettings = { height: 'm', speed: 'kmh', temperature: 'c' };
  const spec = signal<LegendSpec>(legendSpec('waves', IMPERIAL));
  let fixture: ComponentFixture<LegendComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    spec.set(legendSpec('waves', IMPERIAL));
    fixture = TestBed.createComponent(LegendComponent, {
      bindings: [inputBinding('spec', spec)],
    });
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const cells = (): HTMLElement[] => Array.from(element.querySelectorAll('li'));
  const labels = (): string[] => cells().map((cell) => cell.textContent ?? '');

  it('shows the unit and a cell per tick', () => {
    expect(element.querySelector('.unit')?.textContent).toBe('ft');
    expect(labels()).toEqual(['0', '1', '2', '3', '4', '6', '8', '10', '15', '20', '30']);
    expect(element.getAttribute('aria-label')).toBe('Map colours, ft');
  });

  it('blends each forecast cell into the next', () => {
    expect(cells()[0]?.style.background).toMatch(
      /^linear-gradient\(to right, rgb\(.+\), rgb\(.+\)\)$/,
    );
  });

  it('follows the layer and units', async () => {
    spec.set(legendSpec('wind', METRIC));
    await fixture.whenStable();
    expect(element.querySelector('.unit')?.textContent).toBe('km/h');
    expect(labels()[1]).toBe('10');

    spec.set(legendSpec('period', METRIC));
    await fixture.whenStable();
    expect(element.querySelector('.unit')?.textContent).toBe('s');
  });

  it('shows depth as solid bands', async () => {
    spec.set(legendSpec('depth', IMPERIAL));
    await fixture.whenStable();
    expect(element.querySelector('.bar')?.classList.contains('classes')).toBe(true);
    expect(cells()).toHaveLength(12);
    expect(cells()[0]?.style.background).toMatch(/^rgb\(/);
  });

  it('writes dark on pale cells and light on dark ones', async () => {
    spec.set(legendSpec('depth', IMPERIAL));
    await fixture.whenStable();
    const ink = cells().map((cell) => (cell.classList.contains('dark') ? 'dark' : 'light'));
    expect(ink).toEqual(spec().cells.map((cell) => cell.ink));
    expect(ink[0]).toBe('dark');
    expect(ink.at(-1)).toBe('light');
  });
});
