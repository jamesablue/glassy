import { TestBed, type ComponentFixture } from '@angular/core/testing';
import expected from '../../../testing/fixtures/spot-forecast.expected.json';
import {
  RECORDED_MORNING,
  RECORDED_MORNING_HOUR,
  recordedForecastBundle,
} from '../../../testing/forecast-bundle';
import {
  provideScriptedForecast,
  provideTestForecast,
  ScriptedForecastRepository,
} from '../../../testing/state-providers';
import { OAHU_SPOTS } from '../../domain/spots';
import { MapUiStore, SettingsStore, TimelineStore } from '../../state';
import { NARROW_VIEWPORT } from '../shell/narrow-viewport';
import { SpotRankingPanelComponent } from './spot-ranking-panel.component';

describe('SpotRankingPanelComponent', () => {
  let fixture: ComponentFixture<SpotRankingPanelComponent>;
  let element: HTMLElement;

  async function render(narrow = false): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        ...provideTestForecast(recordedForecastBundle(), RECORDED_MORNING),
        { provide: NARROW_VIEWPORT, useValue: narrow },
      ],
    });
    fixture = TestBed.createComponent(SpotRankingPanelComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  }

  beforeEach(() => localStorage.clear());

  const stable = (): Promise<void> => fixture.whenStable();
  const header = (): HTMLButtonElement | null => element.querySelector('.head');
  const rows = (): HTMLButtonElement[] => Array.from(element.querySelectorAll('.row'));
  const names = (): string[] => rows().map((row) => row.querySelector('.name')?.textContent ?? '');
  const nameOf = (id: string): string => OAHU_SPOTS.find((spot) => spot.id === id)?.name ?? id;
  const row = (name: string): HTMLButtonElement | undefined =>
    rows().find((candidate) => candidate.querySelector('.name')?.textContent === name);
  const chip = (label: string): HTMLButtonElement | undefined =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('.chip')).find(
      (button) => button.textContent?.trim() === label,
    );

  describe('ranking', () => {
    beforeEach(() => render());

    it('lists every spot from best to worst score at the selected hour', () => {
      const ranking = expected.rankings[RECORDED_MORNING_HOUR] ?? [];
      expect(names()).toEqual(ranking.map(nameOf));
      const scores = rows().map((entry) =>
        Number(entry.querySelector('glassy-score-pill')?.textContent?.match(/\d+\.\d/)?.[0]),
      );
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
      expect(rows()[0]?.querySelector('.rank')?.textContent).toBe('1');
    });

    it('re-ranks when the hour changes', async () => {
      TestBed.inject(TimelineStore).seek(30);
      await stable();
      expect(names()).toEqual((expected.rankings[30] ?? []).map(nameOf));
    });

    it('filters by region and keeps the order', async () => {
      chip('Windward')?.click();
      await stable();

      const windward = new Set<string>(
        OAHU_SPOTS.filter((spot) => spot.region === 'Windward').map((spot) => spot.name),
      );
      const ranking = (expected.rankings[RECORDED_MORNING_HOUR] ?? []).map(nameOf);
      expect(names()).toEqual(ranking.filter((name) => windward.has(name)));
      expect(rows()[0]?.querySelector('.rank')?.textContent).toBe('1');
      expect(TestBed.inject(MapUiStore).regionFilter()).toBe('Windward');
      expect(chip('Windward')?.getAttribute('aria-checked')).toBe('true');

      chip('All')?.click();
      await stable();
      expect(rows()).toHaveLength(OAHU_SPOTS.length);
    });

    it('shows each spot’s surf, wind and score', () => {
      const hanauma = row('Hanauma Bay');
      expect(hanauma?.querySelector('.sub')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        '0–1 ft · 17 kt cross-shore',
      );
      expect(hanauma?.querySelector('glassy-score-pill small')?.textContent).toBe('Excellent');
    });

    it('follows the unit settings', async () => {
      const settings = TestBed.inject(SettingsStore);
      settings.setUnit('height', 'm');
      settings.setUnit('speed', 'kmh');
      await stable();
      expect(
        row('Hanauma Bay')?.querySelector('.sub')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe('0.2–0.3 m · 31 km/h cross-shore');
    });

    it('says which hour it is for, and when it is after dark', async () => {
      expect(element.querySelector('.time')?.textContent).toBe('Sun 8 AM');
      TestBed.inject(TimelineStore).seek(2);
      await stable();
      expect(element.querySelector('.time')?.textContent).toBe('Sun 2 AM · after dark');
    });

    it('selects the spot whose row is clicked', () => {
      row('Hanauma Bay')?.click();
      expect(TestBed.inject(MapUiStore).selectedSpotId()).toBe('hanauma');
    });
  });

  describe('hover', () => {
    beforeEach(() => render());

    it('highlights the spot on the map while its row is hovered or focused', async () => {
      const mapUi = TestBed.inject(MapUiStore);
      row('Mākaha')?.dispatchEvent(new MouseEvent('mouseenter'));
      expect(mapUi.hoveredSpotId()).toBe('makaha');
      row('Mākaha')?.dispatchEvent(new MouseEvent('mouseleave'));
      expect(mapUi.hoveredSpotId()).toBeNull();

      row('Hanauma Bay')?.focus();
      expect(mapUi.hoveredSpotId()).toBe('hanauma');
      row('Hanauma Bay')?.blur();
      expect(mapUi.hoveredSpotId()).toBeNull();
    });

    it('highlights the row of the spot whose pin is hovered', async () => {
      TestBed.inject(MapUiStore).hoverSpot('kuilima');
      await stable();
      const highlighted = rows().filter((entry) => entry.classList.contains('hovered'));
      expect(highlighted.map((entry) => entry.querySelector('.name')?.textContent)).toEqual([
        'Kuilima Cove (Turtle Bay)',
      ]);
    });
  });

  describe('folding', () => {
    it('starts unfolded on a wide screen and folds from its header', async () => {
      await render(false);
      expect(header()?.getAttribute('aria-expanded')).toBe('true');
      expect(element.querySelector('.body')?.hasAttribute('hidden')).toBe(false);

      header()?.click();
      await stable();
      expect(header()?.getAttribute('aria-expanded')).toBe('false');
      expect(element.querySelector('.body')?.hasAttribute('hidden')).toBe(true);
    });

    it('starts folded on a phone, and unfolds when a spot is opened', async () => {
      await render(true);
      expect(header()?.getAttribute('aria-expanded')).toBe('false');

      const mapUi = TestBed.inject(MapUiStore);
      mapUi.selectSpot('hanauma');
      await stable();
      mapUi.clearSelection();
      await stable();
      expect(header()?.getAttribute('aria-expanded')).toBe('true');
    });
  });

  it('gives focus back to the spot’s row when its details close', async () => {
    await render();
    const mapUi = TestBed.inject(MapUiStore);
    mapUi.selectSpot('hanauma');
    await stable();
    (document.activeElement as HTMLElement | null)?.blur();

    mapUi.clearSelection();
    await stable();
    expect(document.activeElement).toBe(row('Hanauma Bay'));
  });

  it('leaves focus alone when it is somewhere else', async () => {
    await render();
    const elsewhere = document.createElement('button');
    document.body.append(elsewhere);
    const mapUi = TestBed.inject(MapUiStore);
    mapUi.selectSpot('hanauma');
    await stable();
    elsewhere.focus();

    mapUi.clearSelection();
    await stable();
    expect(document.activeElement).toBe(elsewhere);
    elsewhere.remove();
  });

  it('waits for the forecast before listing spots', () => {
    TestBed.configureTestingModule({
      providers: provideScriptedForecast(new ScriptedForecastRepository(), RECORDED_MORNING),
    });
    fixture = TestBed.createComponent(SpotRankingPanelComponent);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    expect(element.querySelector('.empty')?.textContent).toContain('once the forecast loads');
    expect(element.querySelector('.time')?.textContent).toBe('');
  });
});
