import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import type { Result } from 'axe-core';

/** WCAG 2.0, 2.1 and 2.2 at levels A and AA, plus axe's best practices. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

/**
 * The spot pins on the map. WCAG 2.5.8 (target size) is checked everywhere but here. Each pin is at
 * least 24 × 24 px, but at island-wide zoom neighbouring pins on the North Shore overlap, which no
 * size can fix. The criterion's "equivalent" exception covers them: every pin's one action,
 * selecting its spot, is also a full-size row in the ranking.
 */
const SPOT_PINS = '.leaflet-marker-pane';

/** Each violation as "rule: target, target…", for a readable failure message. */
function describe(violations: Result[]): string[] {
  return violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes
        .map((node) => node.target.join(' '))
        .join(', ')}`,
  );
}

/**
 * Runs axe on the page as it is and fails on any violation: every rule, then target size again
 * without the spot pins (see {@link SPOT_PINS}).
 */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const everything = await new AxeBuilder({ page })
    .withTags(TAGS)
    .disableRules(['target-size'])
    .analyze();
  const targets = await new AxeBuilder({ page })
    .withRules(['target-size'])
    .exclude(SPOT_PINS)
    .analyze();
  expect(describe([...everything.violations, ...targets.violations])).toEqual([]);
}
