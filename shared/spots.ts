/**
 * The spot catalog: the spots the ingest forecasts and the app ranks, in the order every per-spot
 * series in a snapshot follows.
 */

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

/** Snorkel spots around Oahu, grouped by region. Field meanings are documented on {@link Spot}. */
export const OAHU_SPOTS = [
  // North Shore
  {
    id: 'sharks',
    name: "Shark's Cove",
    region: 'North Shore',
    lat: 21.653,
    lon: -158.063,
    facing: 300,
    window: 90,
    shelter: 0.15,
    level: 'Intermediate',
    notes:
      'Lava rock cove with tide pools and caverns. Summer spot: in winter swells it becomes dangerous. Wear reef shoes.',
  },
  {
    id: 'tables',
    name: 'Three Tables',
    region: 'North Shore',
    lat: 21.6475,
    lon: -158.0645,
    facing: 295,
    window: 90,
    shelter: 0.1,
    level: 'Intermediate',
    notes:
      'Three flat reef "tables" a short swim from the sand. Only calm in summer; watch for currents near the tables.',
  },
  {
    id: 'waimea',
    name: 'Waimea Bay',
    region: 'North Shore',
    lat: 21.642,
    lon: -158.066,
    facing: 315,
    window: 90,
    shelter: 0.05,
    level: 'Intermediate',
    notes:
      'Glassy in summer with good visibility along the rocks on the right side. Big-wave surf spot in winter.',
  },
  {
    id: 'laniakea',
    name: 'Laniakea (Turtle Beach)',
    region: 'North Shore',
    lat: 21.619,
    lon: -158.086,
    facing: 320,
    window: 90,
    shelter: 0.2,
    level: 'Intermediate',
    notes: 'Green sea turtles feed and rest here. Stay at least 10 ft away. Rocky entry.',
  },
  {
    id: 'mokuleia',
    name: "Mokule'ia",
    region: 'North Shore',
    lat: 21.58,
    lon: -158.194,
    facing: 355,
    window: 85,
    shelter: 0.2,
    level: 'Intermediate',
    notes:
      'Quiet, remote stretch toward Kaʻena Point. Fringing reef; often windy in the afternoon.',
  },
  {
    id: 'kuilima',
    name: 'Kuilima Cove (Turtle Bay)',
    region: 'North Shore',
    lat: 21.7065,
    lon: -157.9985,
    facing: 10,
    window: 80,
    shelter: 0.7,
    level: 'Beginner',
    notes:
      'Reef-protected cove next to Turtle Bay Resort. One of the few calm North Shore spots in winter.',
  },

  // Windward
  {
    id: 'malaekahana',
    name: 'Mālaekahana',
    region: 'Windward',
    lat: 21.6705,
    lon: -157.936,
    facing: 75,
    window: 80,
    shelter: 0.25,
    level: 'Intermediate',
    notes: 'Long beach facing Mokuauia (Goat Island). Trade-wind chop is common.',
  },
  {
    id: 'kahana',
    name: 'Kahana Bay',
    region: 'Windward',
    lat: 21.556,
    lon: -157.874,
    facing: 45,
    window: 60,
    shelter: 0.45,
    level: 'Beginner',
    notes: 'Deep, sheltered bay. Visibility drops after rain because of stream runoff.',
  },
  {
    id: 'kualoa',
    name: "Kualoa (Mokoli'i)",
    region: 'Windward',
    lat: 21.516,
    lon: -157.837,
    facing: 70,
    window: 70,
    shelter: 0.55,
    level: 'Beginner',
    notes: 'Shallow reef flats inside the north end of Kāneʻohe Bay, facing Chinaman’s Hat.',
  },
  {
    id: 'sandbar',
    name: 'Kāneʻohe Sandbar',
    region: 'Windward',
    lat: 21.458,
    lon: -157.815,
    facing: 45,
    window: 60,
    shelter: 0.85,
    level: 'Beginner',
    notes:
      'Ahu o Lāka sandbar inside the barrier reef. Boat or kayak access only. Calm water, but wind matters.',
  },
  {
    id: 'kailua',
    name: 'Kailua Beach',
    region: 'Windward',
    lat: 21.3975,
    lon: -157.728,
    facing: 75,
    window: 80,
    shelter: 0.3,
    level: 'Beginner',
    notes: 'Snorkel around Popoiʻa (Flat Island). Best in the morning before the trades fill in.',
  },
  {
    id: 'lanikai',
    name: 'Lanikai',
    region: 'Windward',
    lat: 21.393,
    lon: -157.715,
    facing: 85,
    window: 80,
    shelter: 0.4,
    level: 'Beginner',
    notes: 'Clear water over sand and reef patches facing the Mokulua islands. No lifeguards.',
  },
  {
    id: 'waimanalo',
    name: 'Waimānalo Bay',
    region: 'Windward',
    lat: 21.338,
    lon: -157.696,
    facing: 70,
    window: 80,
    shelter: 0.2,
    level: 'Intermediate',
    notes: 'Mostly sand bottom; reef patches at the ends. Exposed to trades and shorebreak.',
  },
  {
    id: 'kaupo',
    name: 'Kaupo Beach Park',
    region: 'Windward',
    lat: 21.31,
    lon: -157.662,
    facing: 80,
    window: 70,
    shelter: 0.5,
    level: 'Beginner',
    notes: 'Small reef-protected coves near Makapuʻu. Good fish life when trades are light.',
  },

  // South Shore
  {
    id: 'hanauma',
    name: 'Hanauma Bay',
    region: 'South Shore',
    lat: 21.2693,
    lon: -157.694,
    facing: 140,
    window: 55,
    shelter: 0.55,
    level: 'Beginner',
    notes:
      'Marine preserve in a volcanic crater. Reservations required; closed Mondays and Tuesdays.',
  },
  {
    id: 'chinawalls',
    name: 'China Walls',
    region: 'South Shore',
    lat: 21.2617,
    lon: -157.7105,
    facing: 185,
    window: 80,
    shelter: 0,
    level: 'Advanced',
    notes:
      'Deep water off a cliff ledge with strong surge. Experienced swimmers only and only on flat days.',
  },
  {
    id: 'kahala',
    name: 'Kahala (Waiʻalae)',
    region: 'South Shore',
    lat: 21.2699,
    lon: -157.7731,
    facing: 170,
    window: 80,
    shelter: 0.45,
    level: 'Beginner',
    notes: 'Shallow reef flat with patches of coral. Best at higher tide.',
  },
  {
    id: 'diamondhead',
    name: 'Diamond Head (Kuilei Cliffs)',
    region: 'South Shore',
    lat: 21.2553,
    lon: -157.8045,
    facing: 190,
    window: 85,
    shelter: 0.1,
    level: 'Intermediate',
    notes: 'Reef below the lighthouse. Exposed to south swells and long swims out from the beach.',
  },
  {
    id: 'kaimana',
    name: 'Kaimana / Sans Souci',
    region: 'South Shore',
    lat: 21.268,
    lon: -157.8238,
    facing: 215,
    window: 80,
    shelter: 0.35,
    level: 'Beginner',
    notes:
      'Waikīkī Marine Life Conservation District. Easy entry, turtles common on the outer reef.',
  },
  {
    id: 'magicisland',
    name: 'Magic Island Lagoon',
    region: 'South Shore',
    lat: 21.2846,
    lon: -157.849,
    facing: 190,
    window: 60,
    shelter: 0.85,
    level: 'Beginner',
    notes:
      'Enclosed lagoon at Ala Moana. Always calm, but limited marine life. Good for first-timers and kids.',
  },

  // West Side
  {
    id: 'koolina',
    name: 'Ko Olina Lagoons',
    region: 'West Side',
    lat: 21.3329,
    lon: -158.1236,
    facing: 230,
    window: 60,
    shelter: 0.8,
    level: 'Beginner',
    notes: 'Four man-made lagoons protected by rock walls. Fish gather along the openings.',
  },
  {
    id: 'electric',
    name: 'Electric Beach (Kahe Pt)',
    region: 'West Side',
    lat: 21.3553,
    lon: -158.1312,
    facing: 260,
    window: 85,
    shelter: 0,
    level: 'Intermediate',
    notes:
      'Warm-water outflow pipes attract fish, turtles and sometimes dolphins. Long swim with currents.',
  },
  {
    id: 'pokai',
    name: 'Pōkaʻi Bay',
    region: 'West Side',
    lat: 21.4431,
    lon: -158.1888,
    facing: 245,
    window: 70,
    shelter: 0.7,
    level: 'Beginner',
    notes: 'Calm bay protected by a breakwater. Visibility is best near the rock wall.',
  },
  {
    id: 'makaha',
    name: 'Mākaha',
    region: 'West Side',
    lat: 21.476,
    lon: -158.2203,
    facing: 270,
    window: 85,
    shelter: 0.05,
    level: 'Intermediate',
    notes: 'Turtles and lava formations. Exposed to winter west swells and shorebreak.',
  },
  {
    id: 'makua',
    name: 'Mākua Beach',
    region: 'West Side',
    lat: 21.5299,
    lon: -158.2323,
    facing: 265,
    window: 85,
    shelter: 0.05,
    level: 'Intermediate',
    notes:
      'Remote beach where spinner dolphins rest. Federal law requires staying 50 yards away from them.',
  },
] as const satisfies readonly Spot[];
