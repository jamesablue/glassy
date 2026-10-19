/** Coastline regions, listed clockwise around Oahu from the North Shore. */
export const REGIONS = ['North Shore', 'Windward', 'South Shore', 'West Side'] as const;

export type Region = (typeof REGIONS)[number];

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

/** A snorkel spot and the coastline geometry the scoring model needs. */
export interface Spot {
  /** Stable, URL-safe identifier. */
  readonly id: string;
  readonly name: string;
  readonly region: Region;
  readonly lat: number;
  readonly lon: number;
  /**
   * Compass bearing (degrees) the shoreline looks out toward. Swell coming from this direction hits
   * the spot head-on, and wind from this direction is onshore.
   */
  readonly facing: number;
  /**
   * Half-width (degrees) of the swell window: how far off-axis swell still wraps in.
   * The scoring model uses 80° when it is omitted.
   */
  readonly window?: number;
  /** 0 = fully exposed, 1 = fully protected (fringing reef, breakwater, lagoon or bay). */
  readonly shelter: number;
  /** Rough skill needed on a normal day. */
  readonly level: SkillLevel;
  readonly notes: string;
}
