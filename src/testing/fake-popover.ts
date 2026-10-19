/** The Popover API methods jsdom lacks. */
const METHODS = ['showPopover', 'hidePopover', 'togglePopover'] as const;

/** A fake popover installed on the page. */
export interface FakePopover {
  /** Whether an element is showing as a popover. */
  isOpen(element: Element): boolean;
  /** Takes the fake away again. */
  restore(): void;
}

/**
 * The parts of the HTML Popover API that jsdom lacks, enough to test components built on it, as
 * `fake-canvas.ts` does for canvases: `showPopover`, `hidePopover` and `togglePopover` with their
 * `beforetoggle` and `toggle` events, buttons with `popovertarget`, one `auto` popover open at a
 * time, and light dismiss with Escape or a click outside.
 *
 * Like a browser, it closes a popover on Escape only after the page has seen the key (and not when
 * the page cancelled it), so app-wide key handlers run first.
 */
export function installFakePopover(): FakePopover {
  const open = new Set<HTMLElement>();

  const dispatch = (element: HTMLElement, type: string, show: boolean): void => {
    const event = new Event(type);
    Object.assign(event, {
      oldState: show ? 'closed' : 'open',
      newState: show ? 'open' : 'closed',
    });
    element.dispatchEvent(event);
  };

  const toggle = (element: HTMLElement, show: boolean): void => {
    if (open.has(element) === show) return;
    if (show) {
      for (const other of [...open]) toggle(other, false);
    }
    dispatch(element, 'beforetoggle', show);
    if (show) open.add(element);
    else open.delete(element);
    dispatch(element, 'toggle', show);
  };

  const prototype = HTMLElement.prototype as unknown as Record<string, unknown>;
  prototype['showPopover'] = function (this: HTMLElement) {
    toggle(this, true);
  };
  prototype['hidePopover'] = function (this: HTMLElement) {
    toggle(this, false);
  };
  prototype['togglePopover'] = function (this: HTMLElement) {
    toggle(this, !open.has(this));
  };

  const onClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const invoker = target?.closest('[popovertarget]');
    const id = invoker?.getAttribute('popovertarget');
    const popover = id ? document.getElementById(id) : null;
    if (popover) {
      toggle(popover, !open.has(popover));
      return;
    }
    for (const element of [...open]) {
      if (!target || !element.contains(target)) toggle(element, false);
    }
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const last = [...open].at(-1);
    if (last) toggle(last, false);
  };
  document.addEventListener('click', onClick);
  window.addEventListener('keydown', onKeydown);

  return {
    isOpen: (element) => open.has(element as HTMLElement),
    restore: () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeydown);
      for (const method of METHODS) delete prototype[method];
    },
  };
}
