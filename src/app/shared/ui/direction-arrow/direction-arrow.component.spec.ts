import { inputBinding, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DirectionArrowComponent } from './direction-arrow.component';

describe('DirectionArrowComponent', () => {
  const from = signal(0);
  let fixture: ComponentFixture<DirectionArrowComponent>;

  async function render(degrees: number): Promise<HTMLElement> {
    from.set(degrees);
    fixture = TestBed.createComponent(DirectionArrowComponent, {
      bindings: [inputBinding('from', from)],
    });
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const rotation = (element: HTMLElement): string | undefined =>
    element.querySelector('svg')?.style.transform;

  it.each([
    [0, 180],
    [70, 250],
    [200, 20],
  ])('points a wind from %s° the way it blows, %s°', async (degrees, heading) => {
    expect(rotation(await render(degrees))).toBe(`rotate(${heading}deg)`);
  });

  it('follows a new direction, to the nearest degree', async () => {
    const element = await render(90);
    from.set(359.6);
    await fixture.whenStable();
    expect(rotation(element)).toBe('rotate(180deg)');
  });

  it('draws nothing when the forecast has no direction', async () => {
    expect((await render(NaN)).querySelector('svg')).toBeNull();
  });

  it('is decorative', async () => {
    const element = await render(10);
    expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
