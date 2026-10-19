import { TestBed } from '@angular/core/testing';
import { OAHU_SPOTS } from '../domain/spots';
import { testSpot } from '../../testing/domain-builders';
import { DEFAULT_GLASSY_CONFIG } from './glassy-config';
import { GLASSY_CONFIG, provideGlassyConfig } from './glassy-config.token';
import { SPOT_CATALOG } from './spot-catalog.token';

describe('GLASSY_CONFIG', () => {
  it('provides the defaults', () => {
    TestBed.configureTestingModule({ providers: [provideGlassyConfig()] });
    expect(TestBed.inject(GLASSY_CONFIG)).toEqual(DEFAULT_GLASSY_CONFIG);
  });

  it('applies overrides on top of the defaults', () => {
    TestBed.configureTestingModule({
      providers: [provideGlassyConfig({ forecastDays: 2, cacheLifetimeMs: 1000 })],
    });
    expect(TestBed.inject(GLASSY_CONFIG)).toEqual({
      ...DEFAULT_GLASSY_CONFIG,
      forecastDays: 2,
      cacheLifetimeMs: 1000,
    });
  });

  it('has no implicit default', () => {
    expect(() => TestBed.inject(GLASSY_CONFIG)).toThrow(/GLASSY_CONFIG/);
  });

  it('keeps a cached forecast for 45 minutes and falls back to it for 12 hours', () => {
    expect(DEFAULT_GLASSY_CONFIG.cacheLifetimeMs).toBe(45 * 60 * 1000);
    expect(DEFAULT_GLASSY_CONFIG.cacheMaxStaleMs).toBe(12 * 60 * 60 * 1000);
  });
});

describe('SPOT_CATALOG', () => {
  it('defaults to the Oahu spots', () => {
    expect(TestBed.inject(SPOT_CATALOG)).toBe(OAHU_SPOTS);
  });

  it('can be replaced by another catalog', () => {
    const catalog = [testSpot()];
    TestBed.configureTestingModule({ providers: [{ provide: SPOT_CATALOG, useValue: catalog }] });
    expect(TestBed.inject(SPOT_CATALOG)).toBe(catalog);
  });
});
