import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import expected from '../../testing/fixtures/spot-forecast.expected.json';
import { recordedForecastBundle } from '../../testing/forecast-bundle';
import { provideTestForecast } from '../../testing/state-providers';
import { legendSpec } from '../domain/legend';
import type { Region } from '../domain/models';
import { bestWindow, hazardsFor, rateScore } from '../domain/scoring';
import { OAHU_SPOTS } from '../domain/spots';
import { ConditionsStore, type SpotDetail } from './conditions.store';
import { MapUiStore } from './map-ui.store';
import { SettingsStore } from './settings.store';
import { TimelineStore } from './timeline.store';

/** 8:30 AM on the recorded forecast's first day in Honolulu: hour 8. */
const MORNING = Date.UTC(2026, 9, 18, 18, 30);
const NOW_HOUR = 8;

describe('ConditionsStore', () => {
  const bundle = recordedForecastBundle();
  const expectedSpot = (id: string): (typeof expected.spots)[number] => {
    const spot = expected.spots.find((entry) => entry.id === id);
    if (!spot) throw new Error(`No expected scores for ${id}`);
    return spot;
  };
  const regionOf = (id: string): Region | undefined =>
    OAHU_SPOTS.find((spot) => spot.id === id)?.region;

  let conditions: ConditionsStore;
  let timeline: TimelineStore;
  let mapUi: MapUiStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: provideTestForecast(bundle, MORNING) });
    conditions = TestBed.inject(ConditionsStore);
    timeline = TestBed.inject(TimelineStore);
    mapUi = TestBed.inject(MapUiStore);
  });

  async function loaded(): Promise<void> {
    TestBed.tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('has nothing to rank or show before a forecast loads', () => {
    mapUi.selectSpot('hanauma');
    expect(conditions.scoreMatrix()).toBeUndefined();
    expect(conditions.rankedSpots()).toEqual([]);
    expect(conditions.spotPins()).toEqual([]);
    expect(conditions.selectedSpotDetail()).toBeNull();
  });

  describe('score matrix', () => {
    beforeEach(loaded);

    it('scores every spot for every hour', () => {
      const matrix = conditions.scoreMatrix();
      expect(matrix?.spotCount).toBe(OAHU_SPOTS.length);
      expect(matrix?.hourCount).toBe(48);
    });

    it('is computed once per forecast, not when the hour, region or selection changes', () => {
      const matrix = conditions.scoreMatrix();
      const ranking = conditions.rankedSpots();

      timeline.seek(30);
      mapUi.setRegionFilter('Windward');
      mapUi.selectSpot('hanauma');

      expect(conditions.rankedSpots()).not.toBe(ranking);
      expect(conditions.scoreMatrix()).toBe(matrix);
    });
  });

  describe('ranking', () => {
    beforeEach(loaded);

    it('ranks every spot at the current hour in the golden order', () => {
      const ranked = conditions.rankedSpots();
      expect(ranked.map((entry) => entry.spot.id)).toEqual(expected.rankings[NOW_HOUR]);
      expect(ranked.map((entry) => entry.rank)).toEqual(ranked.map((_, index) => index + 1));
    });

    it('rates each spot from its score', () => {
      for (const { conditions: spotConditions, rating, spot } of conditions.rankedSpots()) {
        expect(rating).toEqual(rateScore(spotConditions.score));
        expect(spotConditions.score).toBeCloseTo(expectedSpot(spot.id).score[NOW_HOUR] ?? NaN, 5);
      }
    });

    it('re-ranks when the timeline moves', () => {
      timeline.seek(30);
      expect(conditions.rankedSpots().map((entry) => entry.spot.id)).toEqual(expected.rankings[30]);
    });

    it.each<Region>(['North Shore', 'Windward', 'South Shore', 'West Side'])(
      'lists only the %s, in the golden order',
      (region) => {
        mapUi.setRegionFilter(region);
        const ranked = conditions.rankedSpots();
        const golden = (expected.rankings[NOW_HOUR] ?? []).filter((id) => regionOf(id) === region);

        expect(ranked.length).toBeGreaterThan(0);
        expect(ranked.map((entry) => entry.spot.id)).toEqual(golden);
        expect(ranked.map((entry) => entry.rank)).toEqual(golden.map((_, index) => index + 1));
      },
    );

    it('lists every spot again when the filter is cleared', () => {
      mapUi.setRegionFilter('West Side');
      mapUi.setRegionFilter('all');
      expect(conditions.rankedSpots()).toHaveLength(OAHU_SPOTS.length);
    });
  });

  describe('map pins', () => {
    beforeEach(loaded);

    it('has one pin per spot, in catalog order, with its rating colour and surf', () => {
      const pins = conditions.spotPins();
      expect(pins.map((pin) => pin.id)).toEqual(OAHU_SPOTS.map((spot) => spot.id));

      const hanauma = pins.find((pin) => pin.id === 'hanauma');
      const want = expectedSpot('hanauma');
      expect(hanauma).toMatchObject({ name: 'Hanauma Bay', lat: 21.2693, selected: false });
      expect(hanauma?.score).toBeCloseTo(want.score[NOW_HOUR] ?? NaN, 5);
      expect(hanauma?.surf).toBeCloseTo(want.surf[NOW_HOUR] ?? NaN, 5);
      expect(hanauma?.color).toBe(rateScore(hanauma?.score ?? NaN).color);
    });

    it('marks the selected spot', () => {
      mapUi.selectSpot('sharks');
      const selected = conditions.spotPins().filter((pin) => pin.selected);
      expect(selected.map((pin) => pin.id)).toEqual(['sharks']);
    });

    it('follows the timeline', () => {
      timeline.seek(30);
      const sharks = conditions.spotPins().find((pin) => pin.id === 'sharks');
      expect(sharks?.score).toBeCloseTo(expectedSpot('sharks').score[30] ?? NaN, 5);
    });
  });

  describe('selected spot detail', () => {
    beforeEach(loaded);

    function detailFor(id: string): SpotDetail {
      mapUi.selectSpot(id);
      const detail = conditions.selectedSpotDetail();
      if (!detail) throw new Error(`No detail for ${id}`);
      return detail;
    }

    it('is empty without a selection', () => {
      expect(conditions.selectedSpotDetail()).toBeNull();
    });

    it('shows the spot at the selected hour', () => {
      const detail = detailFor('hanauma');

      expect(detail.spot.name).toBe('Hanauma Bay');
      expect(detail.conditions.score).toBeCloseTo(
        expectedSpot('hanauma').score[NOW_HOUR] ?? NaN,
        5,
      );
      expect(detail.rating.label).toBe('Excellent');
      expect(detail.hazards).toEqual([]);
    });

    it('warns about the hazards at the selected hour', () => {
      // Malaekahana has surf of 3 ft or more for the whole recorded forecast.
      const detail = detailFor('malaekahana');

      expect(detail.hazards).toContain('big-surf');
      expect(detail.hazards).toEqual(hazardsFor(detail.conditions));
    });

    it('has a score and surf trend for every forecast hour', () => {
      const { trend } = detailFor('kailua');
      const want = expectedSpot('kailua');

      expect(trend).toHaveLength(48);
      trend.forEach((point, hour) => {
        expect(point.hour).toBe(hour);
        expect(point.time).toBe(bundle.times[hour]);
        expect(point.score).toBeCloseTo(want.score[hour] ?? NaN, 5);
        expect(point.surf).toBeCloseTo(want.surf[hour] ?? NaN, 5);
        expect(point.isDay).toBe(bundle.isDay[hour]);
      });
    });

    it('suggests the best daylight window from now on', () => {
      const want = bestWindow(expectedSpot('kailua').score, bundle.isDay, NOW_HOUR);
      const best = detailFor('kailua').bestWindow;

      expect(want).not.toBeNull();
      expect(best?.start).toBe(want?.start);
      expect(best?.average).toBeCloseTo(want?.average ?? NaN, 5);
    });

    it('moves with the timeline but keeps its trend', () => {
      const before = detailFor('kailua');
      timeline.seek(30);
      const after = detailFor('kailua');

      expect(after.conditions.score).toBeCloseTo(expectedSpot('kailua').score[30] ?? NaN, 5);
      expect(after.trend).toBe(before.trend);
      expect(after.bestWindow).toBe(before.bestWindow);
    });

    it('closes when the selection is cleared', () => {
      mapUi.selectSpot('kailua');
      mapUi.clearSelection();
      expect(conditions.selectedSpotDetail()).toBeNull();
    });
  });

  describe('legend', () => {
    it('describes the active layer in the user units', () => {
      expect(conditions.legendSpec()).toEqual(
        legendSpec('waves', { height: 'ft', speed: 'kt', temperature: 'f' }),
      );
    });

    it('follows the layer and the units', () => {
      mapUi.setLayer('wind');
      TestBed.inject(SettingsStore).setUnit('speed', 'kmh');
      expect(conditions.legendSpec().unit).toBe('km/h');

      mapUi.setLayer('depth');
      expect(conditions.legendSpec().kind).toBe('classes');
    });
  });
});
