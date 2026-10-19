import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PanelComponent } from './panel.component';

@Component({
  imports: [PanelComponent],
  template: `<glassy-panel [variant]="variant()"><p>Inside</p></glassy-panel>`,
})
class HostComponent {
  readonly variant = signal<'glass' | 'solid'>('glass');
}

describe('PanelComponent', () => {
  it('wraps its content in the glass card by default and a solid one on request', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const panel = (fixture.nativeElement as HTMLElement).querySelector('glassy-panel');
    expect(panel?.querySelector('p')?.textContent).toBe('Inside');
    expect(panel?.classList.contains('solid')).toBe(false);

    fixture.componentInstance.variant.set('solid');
    await fixture.whenStable();
    expect(panel?.classList.contains('solid')).toBe(true);
  });
});
