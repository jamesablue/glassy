import { computed, Directive, ElementRef, inject, input, output } from '@angular/core';

/** One choice in a {@link ChoiceGroup}. */
export interface ChoiceOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** A choice as its radio button renders it. */
interface RenderedChoice<T extends string> extends ChoiceOption<T> {
  readonly checked: boolean;
  /** Only the checked radio is in the tab order; arrow keys move between the others. */
  readonly tabIndex: 0 | -1;
}

/**
 * Where the arrow keys, Home and End move the selection in a radio group of `count` options, or
 * `null` for any other key. Arrows wrap around at either end, as in native radio groups.
 */
export function nextChoiceIndex(key: string, index: number, count: number): number | null {
  if (count === 0) return null;
  const from = Math.max(index, 0);
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (from + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (from - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * Behaviour shared by the single-choice controls ({@link SegmentedControlComponent},
 * {@link ChipGroupComponent}), which differ only in looks. Each follows the WAI-ARIA radio group
 * pattern: one tab stop, arrow keys move the selection (and focus) with wrap-around, Home and End
 * jump to the ends.
 *
 * The control is stateless: it shows `value` and asks for a change through `valueChange`.
 * Name it with `label`, or better with `labelledBy` pointing at visible text.
 */
@Directive({
  host: {
    role: 'radiogroup',
    '[attr.aria-label]': 'label() ?? null',
    '[attr.aria-labelledby]': 'labelledBy() ?? null',
    '(keydown)': 'onKeydown($event)',
  },
})
export abstract class ChoiceGroup<T extends string> {
  readonly options = input.required<readonly ChoiceOption<T>[]>();
  readonly value = input.required<T>();
  /** Accessible name, when there is no visible label to point `labelledBy` at. */
  readonly label = input<string>();
  /** Id of the element whose text names the group. */
  readonly labelledBy = input<string>();

  /** The user picked another option. */
  readonly valueChange = output<T>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly choices = computed<readonly RenderedChoice<T>[]>(() =>
    this.options().map((option) => {
      const checked = option.value === this.value();
      return { ...option, checked, tabIndex: checked ? 0 : -1 };
    }),
  );

  protected choose(value: T): void {
    if (value !== this.value()) this.valueChange.emit(value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.options();
    const current = options.findIndex((option) => option.value === this.value());
    const next = nextChoiceIndex(event.key, current, options.length);
    const option = next === null ? undefined : options[next];
    if (next === null || !option) return;
    event.preventDefault();
    this.choose(option.value);
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
}
