import { OAHU_SPOTS, type Spot } from '@glassy/shared';
import type { OmrBeach } from './omr';

/** A beach the lifeguard report covers, scored as a Glassy spot. */
export interface Beach {
  readonly omr: OmrBeach;
  readonly spot: Spot;
  /** A catalog spot, or a test beach that exists only in this backtest. */
  readonly kind: 'catalog' | 'test';
}

function catalogSpot(id: string): Spot {
  const spot = OAHU_SPOTS.find((candidate) => candidate.id === id);
  if (!spot) throw new Error(`No catalog spot "${id}"`);
  return spot;
}

/**
 * A beach that isn't in the catalog. Lifeguards read the outer break, so shelter is near zero.
 * Facing and window are estimated by hand from the coastline until #57 measures them.
 */
function testSpot(spot: Omit<Spot, 'level' | 'notes'> & { readonly notes: string }): Spot {
  return { ...spot, level: 'Advanced' };
}

/** The seven Oahu beaches in the lifeguard report, in the report's order. */
export const BEACHES: readonly Beach[] = [
  { omr: 'DIAMOND HEAD', kind: 'catalog', spot: catalogSpot('diamondhead') },
  {
    omr: 'SUNSET',
    kind: 'test',
    spot: testSpot({
      id: 'test-sunset',
      name: 'Sunset Beach',
      region: 'North Shore',
      lat: 21.679,
      lon: -158.0405,
      facing: 325, // estimate until #57
      window: 85, // estimate until #57
      shelter: 0,
      notes: 'Outer reef break off Sunset Beach Park.',
    }),
  },
  {
    omr: 'WAIKIKI',
    kind: 'test',
    spot: testSpot({
      id: 'test-waikiki',
      name: 'Waikīkī (Canoes)',
      region: 'South Shore',
      lat: 21.2745,
      lon: -157.8285,
      facing: 200, // estimate until #57
      window: 70, // estimate until #57
      shelter: 0.1,
      notes: 'Canoes, the reef break the lifeguards name in their remarks.',
    }),
  },
  {
    omr: 'SANDY BEACH',
    kind: 'test',
    spot: testSpot({
      id: 'test-sandy',
      name: 'Sandy Beach',
      region: 'South Shore',
      lat: 21.2856,
      lon: -157.6727,
      facing: 165, // estimate until #57
      window: 80, // estimate until #57
      shelter: 0,
      notes: 'Shore break, as the lifeguards note.',
    }),
  },
  {
    omr: 'MAKAPUU',
    kind: 'test',
    spot: testSpot({
      id: 'test-makapuu',
      name: 'Makapuʻu Beach',
      region: 'Windward',
      lat: 21.3105,
      lon: -157.6603,
      facing: 85, // estimate until #57
      window: 75, // estimate until #57
      shelter: 0,
      notes: 'Bodysurfing beach below Makapuʻu Point.',
    }),
  },
  {
    omr: 'EHUKAI',
    kind: 'test',
    spot: testSpot({
      id: 'test-ehukai',
      name: 'ʻEhukai (Pipeline)',
      region: 'North Shore',
      lat: 21.665,
      lon: -158.053,
      facing: 320, // estimate until #57
      window: 85, // estimate until #57
      shelter: 0,
      notes: 'Banzai Pipeline, in front of ʻEhukai Beach Park.',
    }),
  },
  { omr: 'MAKAHA', kind: 'catalog', spot: catalogSpot('makaha') },
];
