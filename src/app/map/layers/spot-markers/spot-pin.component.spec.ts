import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import type { LabelMode } from '../../../domain/geo';
import type { HeightUnit } from '../../../domain/models';
import type { SpotPin } from '../../../state';
import { SpotPinComponent } from './spot-pin.component';

describe('SpotPinComponent', () => {
  const HANAUMA: SpotPin = {
    id: 'hanauma',
    name: 'Hanauma Bay',
    lat: 21.2693,
    lon: -157.694,
    score: 8.4,
    color: '#34d399',
    surf: 0.5,
    selected: false,
  };

  function render(
    pin: SpotPin = HANAUMA,
    mode: LabelMode = 'full',
    heightUnit: HeightUnit = 'ft',
  ): { fixture: ComponentFixture<SpotPinComponent>; button: HTMLButtonElement } {
    const fixture = TestBed.createComponent(SpotPinComponent);
    fixture.componentRef.setInput('pin', pin);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('heightUnit', heightUnit);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    if (!button) throw new Error('No pin button');
    return { fixture, button };
  }

  it('shows the surf height and the spot name', () => {
    const { button } = render();
    expect(button.querySelector('.surf')?.textContent).toBe('1–2 ft');
    expect(button.querySelector('.name')?.textContent).toBe('Hanauma Bay');
  });

  it('shows the surf height in the chosen unit', () => {
    const { button } = render(HANAUMA, 'full', 'm');
    expect(button.querySelector('.surf')?.textContent).toBe('0.4–0.6 m');
  });

  it('colours the dot by rating', () => {
    const { button } = render();
    expect(button.style.getPropertyValue('--rating-color')).toBe('#34d399');
  });

  it('is a button screen readers announce with the name, rating and surf', () => {
    const { button } = render(HANAUMA, 'dot', 'm');
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Hanauma Bay, Excellent, surf 0.4–0.6 m');
  });

  it.each([
    ['full', false, false],
    ['height-only', false, true],
    ['dot', true, true],
  ] as const)('shrinks a %s label', (mode, compact, noName) => {
    const { button } = render(HANAUMA, mode);
    expect(button.classList.contains('compact')).toBe(compact);
    expect(button.classList.contains('no-name')).toBe(noName);
  });

  it('marks the selected spot', () => {
    const plain = render().button;
    expect(plain.classList.contains('selected')).toBe(false);
    expect(plain.hasAttribute('aria-current')).toBe(false);

    const selected = render({ ...HANAUMA, selected: true }).button;
    expect(selected.classList.contains('selected')).toBe(true);
    expect(selected.getAttribute('aria-current')).toBe('true');
  });

  it('selects the spot when clicked, or activated with Enter like any button', () => {
    const { fixture, button } = render();
    const selected: string[] = [];
    fixture.componentInstance.pinSelect.subscribe((id) => selected.push(id));
    button.click();
    expect(selected).toEqual(['hanauma']);
  });

  it('asks to be brought into view on keyboard focus only', () => {
    const { fixture, button } = render();
    let focused = 0;
    fixture.componentInstance.pinFocus.subscribe(() => focused++);

    const keyboard = vi.spyOn(button, 'matches').mockReturnValue(true);
    button.dispatchEvent(new FocusEvent('focus'));
    expect(keyboard).toHaveBeenCalledWith(':focus-visible');
    expect(focused).toBe(1);

    keyboard.mockReturnValue(false);
    button.dispatchEvent(new FocusEvent('focus'));
    expect(focused).toBe(1);
  });
});
