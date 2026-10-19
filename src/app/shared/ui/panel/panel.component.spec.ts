import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PanelComponent } from './panel.component';

@Component({
  imports: [PanelComponent],
  template: `<glassy-panel class="side"><p>Inside</p></glassy-panel>`,
})
class HostComponent {}

describe('PanelComponent', () => {
  it('wraps its content in the card, keeping the classes it is placed with', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const panel = (fixture.nativeElement as HTMLElement).querySelector('glassy-panel');
    expect(panel?.querySelector('p')?.textContent).toBe('Inside');
    expect(panel?.classList.contains('side')).toBe(true);
  });
});
