import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { installFakePopover, type FakePopover } from '../../../../testing/fake-popover';
import { PopoverComponent } from './popover.component';

@Component({
  imports: [PopoverComponent],
  template: `
    <button type="button" popovertarget="test-popover">Open</button>
    <glassy-popover id="test-popover" heading="Settings">
      <p>Content</p>
    </glassy-popover>
    <p class="outside">Elsewhere</p>
  `,
})
class HostComponent {
  readonly popover = viewChild.required(PopoverComponent);
}

@Component({
  imports: [PopoverComponent],
  template: `
    <button type="button" popovertarget="form-popover">Open</button>
    <glassy-popover id="form-popover" heading="Units">
      <button type="button" tabindex="-1" class="skipped">Not in the tab order</button>
      <button type="button" class="first">First</button>
      <button type="button" class="second">Second</button>
    </glassy-popover>
  `,
})
class ControlsHostComponent {}

describe('PopoverComponent', () => {
  let fake: FakePopover;

  beforeEach(() => {
    fake = installFakePopover();
  });

  afterEach(() => fake.restore());

  async function render(): Promise<{
    element: HTMLElement;
    host: HostComponent;
    popover: HTMLElement;
  }> {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const popover = element.querySelector<HTMLElement>('glassy-popover');
    if (!popover) throw new Error('No popover');
    return { element, host: fixture.componentInstance, popover };
  }

  it('is a native auto popover named by its heading', async () => {
    const { popover } = await render();
    expect(popover.getAttribute('popover')).toBe('auto');
    expect(popover.getAttribute('role')).toBe('dialog');
    const titleId = popover.getAttribute('aria-labelledby') ?? '';
    expect(document.getElementById(titleId)?.textContent).toBe('Settings');
    expect(popover.querySelector('p')?.textContent).toBe('Content');
  });

  it('gives every popover its own title id', async () => {
    const first = (await render()).popover.getAttribute('aria-labelledby');
    const second = (await render()).popover.getAttribute('aria-labelledby');
    expect(first).not.toBe(second);
  });

  it('follows the browser as it opens and closes', async () => {
    const { element, host, popover } = await render();
    expect(host.popover().isOpen()).toBe(false);

    element.querySelector('button')?.click();
    expect(fake.isOpen(popover)).toBe(true);
    expect(host.popover().isOpen()).toBe(true);

    element.querySelector('button')?.click();
    expect(host.popover().isOpen()).toBe(false);
  });

  it('knows it is opening before the browser’s later toggle event', async () => {
    const { host, popover } = await render();
    const beforeToggle = (newState: string): Event =>
      Object.assign(new Event('beforetoggle'), { oldState: '', newState });
    popover.dispatchEvent(beforeToggle('open'));
    expect(host.popover().isOpen()).toBe(true);
    popover.dispatchEvent(beforeToggle('closed'));
    expect(host.popover().isOpen()).toBe(false);
  });

  it('closes on Escape and on a click outside', async () => {
    const { element, host } = await render();
    element.querySelector('button')?.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.popover().isOpen()).toBe(false);

    element.querySelector('button')?.click();
    element.querySelector<HTMLElement>('glassy-popover p')?.click();
    expect(host.popover().isOpen()).toBe(true);
    element.querySelector<HTMLElement>('.outside')?.click();
    expect(host.popover().isOpen()).toBe(false);
  });

  describe('focus', () => {
    // jsdom will not focus anything inside a [popover] (it has no open state for one), so these
    // tests watch which element is asked to take focus. Playwright checks the real thing.
    let focused: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      focused = vi.spyOn(HTMLElement.prototype, 'focus');
    });

    afterEach(() => focused.mockRestore());

    const focusedElements = (): HTMLElement[] => focused.mock.contexts as HTMLElement[];

    it('moves to the first control in the tab order when it opens', async () => {
      const fixture = TestBed.createComponent(ControlsHostComponent);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      element.querySelector<HTMLButtonElement>('button[popovertarget]')?.click();
      expect(focusedElements().map((target) => target.className)).toEqual(['first']);
    });

    it('moves to the card itself when it has nothing to focus yet', async () => {
      const { element, popover } = await render();
      element.querySelector('button')?.click();
      expect(focusedElements()).toEqual([popover]);
      expect(popover.getAttribute('tabindex')).toBe('-1');
    });

    it('stays where it is when focus is already inside', async () => {
      const fixture = TestBed.createComponent(ControlsHostComponent);
      await fixture.whenStable();
      const element = fixture.nativeElement as HTMLElement;
      const popover = element.querySelector<HTMLElement>('glassy-popover');
      const second = element.querySelector<HTMLButtonElement>('.second');
      vi.spyOn(document, 'activeElement', 'get').mockReturnValue(second);
      popover?.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'open' }));
      expect(focusedElements()).toEqual([]);
    });

    it('leaves focus alone when it closes, for the browser to hand back', async () => {
      const { popover } = await render();
      popover.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
      expect(focusedElements()).toEqual([]);
    });
  });
});
