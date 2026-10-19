import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { installFakePopover, type FakePopover } from '../../../testing/fake-popover';
import { ABOUT_POPOVER_ID, AboutPopoverComponent } from './about-popover.component';

describe('AboutPopoverComponent', () => {
  let fake: FakePopover;
  let fixture: ComponentFixture<AboutPopoverComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    fake = installFakePopover();
    fixture = TestBed.createComponent(AboutPopoverComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => fake.restore());

  const popover = (): HTMLElement => element.querySelector('glassy-popover') as HTMLElement;

  it('is the popover the About button opens', () => {
    expect(popover().id).toBe(ABOUT_POPOVER_ID);
    expect(popover().querySelector('h2')?.textContent).toBe('How this works');
  });

  it('loads its text the first time it opens', async () => {
    expect(element.querySelector('glassy-about-content')).toBeNull();

    popover().showPopover();
    expect(fixture.componentInstance.isOpen()).toBe(true);
    await fixture.whenStable();

    const content = element.querySelector('glassy-about-content');
    expect(content?.textContent).toContain('The snorkel score (0–10)');
    expect(content?.textContent).toContain('When in doubt');
  });

  it('credits each data source with a link that opens in a new tab', async () => {
    popover().showPopover();
    await fixture.whenStable();
    const links = Array.from(element.querySelectorAll('a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Open-Meteo',
      'NOAA NCEI',
      'Esri',
      'OpenStreetMap',
    ]);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener');
    }
  });

  it('keeps its text after closing', async () => {
    popover().showPopover();
    await fixture.whenStable();
    popover().hidePopover();
    await fixture.whenStable();
    expect(fixture.componentInstance.isOpen()).toBe(false);
    expect(element.querySelector('glassy-about-content')).not.toBeNull();
  });
});
