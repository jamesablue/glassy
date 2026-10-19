import { inputBinding, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconComponent } from './icon.component';
import { ICON_NAMES, ICONS, type IconName } from './icons';

describe('IconComponent', () => {
  async function render(
    name: IconName,
  ): Promise<{ element: HTMLElement; set: (n: IconName) => Promise<void> }> {
    const icon = signal(name);
    const fixture = TestBed.createComponent(IconComponent, {
      bindings: [inputBinding('name', icon)],
    });
    await fixture.whenStable();
    const set = async (next: IconName): Promise<void> => {
      icon.set(next);
      await fixture.whenStable();
    };
    return { element: fixture.nativeElement as HTMLElement, set };
  }

  it('draws every icon in the set as SVG paths', async () => {
    for (const name of ICON_NAMES) {
      const { element } = await render(name);
      const paths = element.querySelectorAll('svg path');
      expect(paths).toHaveLength(ICONS[name].length);
      expect(paths[0]?.namespaceURI).toBe('http://www.w3.org/2000/svg');
    }
  });

  it('is decorative, so the control around it names it', async () => {
    const { element } = await render('wind');
    const svg = element.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });

  it('outlines line shapes and fills solid ones in the text colour', async () => {
    const { element, set } = await render('spots');
    const [pin, dot] = Array.from(element.querySelectorAll('path'));
    expect(pin?.getAttribute('fill')).toBe('none');
    expect(pin?.getAttribute('stroke')).toBe('currentColor');
    expect(pin?.getAttribute('stroke-width')).toBe('2');
    expect(dot?.getAttribute('fill')).toBe('currentColor');
    expect(dot?.hasAttribute('stroke')).toBe(false);

    await set('back');
    expect(element.querySelector('path')?.getAttribute('stroke-width')).toBe('2.2');
  });
});
