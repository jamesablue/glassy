import { ApplicationRef, inputBinding, outputBinding, signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChipGroupComponent } from '../chip-group/chip-group.component';
import { SegmentedControlComponent } from '../segmented-control/segmented-control.component';
import { nextChoiceIndex, type ChoiceOption } from './choice-group';

describe('nextChoiceIndex', () => {
  it.each([
    ['ArrowRight', 0, 1],
    ['ArrowDown', 1, 2],
    ['ArrowRight', 3, 0],
    ['ArrowLeft', 2, 1],
    ['ArrowUp', 0, 3],
    ['Home', 2, 0],
    ['End', 1, 3],
  ])('moves %s from option %s to option %s of four, wrapping around', (key, from, to) => {
    expect(nextChoiceIndex(key, from, 4)).toBe(to);
  });

  it('starts from the first option when none is selected', () => {
    expect(nextChoiceIndex('ArrowRight', -1, 4)).toBe(1);
  });

  it('ignores other keys and empty groups', () => {
    expect(nextChoiceIndex('Enter', 0, 4)).toBeNull();
    expect(nextChoiceIndex('ArrowRight', 0, 0)).toBeNull();
  });
});

type Speed = 'kt' | 'mph' | 'kmh';
const OPTIONS: readonly ChoiceOption<Speed>[] = [
  { value: 'kt', label: 'kt' },
  { value: 'mph', label: 'mph' },
  { value: 'kmh', label: 'km/h' },
];

describe.each([
  ['SegmentedControlComponent', SegmentedControlComponent],
  ['ChipGroupComponent', ChipGroupComponent],
] as const)('%s', (_name, component: Type<unknown>) => {
  const value = signal<Speed>('kt');
  const label = signal<string | undefined>('Wind speed');
  const labelledBy = signal<string | undefined>(undefined);
  let picked: Speed[];

  async function render(): Promise<HTMLElement> {
    picked = [];
    value.set('kt');
    const fixture = TestBed.createComponent(component, {
      bindings: [
        inputBinding('options', () => OPTIONS),
        inputBinding('value', value),
        inputBinding('label', label),
        inputBinding('labelledBy', labelledBy),
        // The control is stateless, so the test plays the parent and applies each choice.
        outputBinding<Speed>('valueChange', (choice) => {
          picked.push(choice);
          value.set(choice);
        }),
      ],
    });
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const radios = (element: HTMLElement): HTMLButtonElement[] =>
    Array.from(element.querySelectorAll('[role="radio"]'));

  const press = async (element: HTMLElement, key: string): Promise<KeyboardEvent> => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement ?? element).dispatchEvent(event);
    await TestBed.inject(ApplicationRef).whenStable();
    return event;
  };

  it('is a named radio group with the selected option checked', async () => {
    const element = await render();
    expect(element.getAttribute('role')).toBe('radiogroup');
    expect(element.getAttribute('aria-label')).toBe('Wind speed');
    expect(radios(element).map((radio) => radio.textContent?.trim())).toEqual([
      'kt',
      'mph',
      'km/h',
    ]);
    expect(radios(element).map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('can be named by visible text instead', async () => {
    label.set(undefined);
    labelledBy.set('speed-label');
    const element = await render();
    expect(element.hasAttribute('aria-label')).toBe(false);
    expect(element.getAttribute('aria-labelledby')).toBe('speed-label');
    label.set('Wind speed');
    labelledBy.set(undefined);
  });

  it('puts only the selected option in the tab order', async () => {
    const element = await render();
    expect(radios(element).map((radio) => radio.tabIndex)).toEqual([0, -1, -1]);
  });

  it('asks for a new value when an option is clicked, but not for the current one', async () => {
    const element = await render();
    radios(element)[2]?.click();
    await TestBed.inject(ApplicationRef).whenStable();
    radios(element)[2]?.click();
    expect(picked).toEqual(['kmh']);
    expect(radios(element)[2]?.getAttribute('aria-checked')).toBe('true');
  });

  it('moves the selection and focus with the arrow keys, Home and End', async () => {
    const element = await render();
    radios(element)[0]?.focus();

    const right = await press(element, 'ArrowRight');
    expect(right.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(radios(element)[1]);
    await press(element, 'End');
    await press(element, 'ArrowDown');
    await press(element, 'ArrowLeft');
    await press(element, 'Home');

    expect(picked).toEqual(['mph', 'kmh', 'kt', 'kmh', 'kt']);
    expect(document.activeElement).toBe(radios(element)[0]);
  });

  it('leaves other keys alone', async () => {
    const element = await render();
    radios(element)[0]?.focus();
    const event = await press(element, 'Enter');
    expect(event.defaultPrevented).toBe(false);
    expect(picked).toEqual([]);
  });
});
