import { Component, computed, viewChild } from '@angular/core';
import { PopoverComponent } from '../../shared/ui';
import { AboutContentComponent } from './about-content.component';

/** The id the About button opens this popover by. */
export const ABOUT_POPOVER_ID = 'about-popover';

/**
 * How Glassy works, its data sources and the safety note. The text is fetched while the browser is
 * idle and shown once the popover first opens, so it stays out of the initial bundle.
 */
@Component({
  selector: 'glassy-about-popover',
  imports: [AboutContentComponent, PopoverComponent],
  template: `
    <glassy-popover #popover heading="How this works" [id]="id">
      @defer (when popover.isOpen(); prefetch on idle) {
        <glassy-about-content />
      } @loading {
        <p class="loading">Loading…</p>
      }
    </glassy-popover>
  `,
  styles: `
    glassy-popover {
      --popover-top: 290px;
      --popover-width: 340px;
    }

    .loading {
      margin: 0;
      color: var(--muted);
    }
  `,
})
export class AboutPopoverComponent {
  private readonly popover = viewChild.required(PopoverComponent);

  protected readonly id = ABOUT_POPOVER_ID;
  /** Whether the browser is showing the popover. */
  readonly isOpen = computed(() => this.popover().isOpen());
}
