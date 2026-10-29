import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isOmrArchive, parseHeight, parseOmr, secondsAfterMidnight } from './omr';

/** One issue in the archive's layout, trimmed to the Oahu block and one other island. */
const issue = (date: string, oahuRows: string): string => `\u0001
649
SXHW80 PHFO 290115
OMRHFO

SURF OBSERVATIONS
NATIONAL WEATHER SERVICE HONOLULU HI
315 PM HST ${date}

FULL FACE SURF OBSERVATIONS ARE TAKEN BY COUNTY LIFE GUARDS AND
COOPERATIVE OBSERVERS AND RELAYED TO THE NATIONAL WEATHER SERVICE
FOR DISSEMINATION. THESE OBSERVATIONS ARE NOT QUALITY CONTROLLED.

HIZ003-004-029>031-290100-
KAUAI-

LOCATION        TIME   SURF HEIGHT DIR   PER                  REMARKS
KEE          1100 AM           6-8   N    11
$$

HIZ006-007-009>011-032>036-290100-
OAHU-

LOCATION        TIME   SURF HEIGHT DIR PER         WIND      REMARKS
${oahuRows}
$$
`;

const OCT_28 = `DIAMOND HEAD
SUNSET
WAIKIKI      1049 AM           1-2             NE 10-15       CANOES
SANDY BEACH  1049 AM           3-4+            VRB 5-10  SHORE BREAK
MAKAPUU      1049 AM           FLAT              NE 0-5
EHUKAI       1049 AM             0              NE 5-10
MAKAHA       1049 AM           1-2              UN 5-10`;

/** 10:49 AM HST on Oct 28, 2026 is 20:49 UTC. */
const OCT_28_1049 = Date.UTC(2026, 9, 28, 20, 49) / 1000;

describe('secondsAfterMidnight', () => {
  it('reads morning, afternoon, noon and the hour after midnight', () => {
    assert.equal(secondsAfterMidnight('1049', 'AM'), (10 * 60 + 49) * 60);
    assert.equal(secondsAfterMidnight('315', 'PM'), (15 * 60 + 15) * 60);
    assert.equal(secondsAfterMidnight('1200', 'PM'), 12 * 3600);
    assert.equal(secondsAfterMidnight('1205', 'AM'), 5 * 60);
  });
});

describe('parseHeight', () => {
  it('reads ranges, single heights, flat and "+"', () => {
    assert.deepEqual(parseHeight('1-2'), [1, 2]);
    assert.deepEqual(parseHeight('2-4+'), [2, 4]);
    assert.deepEqual(parseHeight('3'), [3, 3]);
    assert.deepEqual(parseHeight('0'), [0, 0]);
    assert.deepEqual(parseHeight('FLAT'), [0, 0]);
  });

  it('rejects anything else', () => {
    assert.equal(parseHeight('NE'), undefined);
    assert.equal(parseHeight('4-2'), undefined);
  });
});

describe('parseOmr', () => {
  it('reads the Oahu rows, converts Hawaii time to UTC and skips blank rows', () => {
    const readings = parseOmr([issue('WED OCT 28 2026', OCT_28)]);
    assert.deepEqual(
      readings.map((reading) => [reading.beach, reading.low, reading.high]),
      [
        ['EHUKAI', 0, 0],
        ['MAKAHA', 1, 2],
        ['MAKAPUU', 0, 0],
        ['SANDY BEACH', 3, 4],
        ['WAIKIKI', 1, 2],
      ],
    );
    assert.ok(readings.every((reading) => reading.time === OCT_28_1049));
    assert.ok(readings.every((reading) => !reading.timeBorrowed));
  });

  it('ignores the other islands', () => {
    assert.ok(parseOmr([issue('WED OCT 28 2026', '')]).length === 0);
  });

  it('gives a row with no time the commonest time in its issue', () => {
    const rows = `WAIKIKI      1032 AM           2-3             ENE 5-15       CANOES
SANDY BEACH                   2-4+            ENE 10-15  SHORE BREAK
MAKAHA       1032 AM           1-2             VRB 5-10`;
    const sandy = parseOmr([issue('SUN AUG 30 2026', rows)]).find(
      (reading) => reading.beach === 'SANDY BEACH',
    );
    assert.equal(sandy?.time, Date.UTC(2026, 7, 30, 20, 32) / 1000);
    assert.equal(sandy?.timeBorrowed, true);
  });

  it('keeps a reading repeated in a reissued report once, from the last issue', () => {
    const first = issue('WED OCT 28 2026', 'MAKAHA       1049 AM           1-2');
    const corrected = issue('WED OCT 28 2026', 'MAKAHA       1049 AM           2-3');
    const readings = parseOmr([first + corrected]);
    assert.equal(readings.length, 1);
    assert.deepEqual([readings[0]?.low, readings[0]?.high], [2, 3]);
  });

  it('orders readings from oldest to newest across downloads', () => {
    const later = issue('THU OCT 29 2026', 'MAKAHA       1000 AM           2-3');
    const earlier = issue('WED OCT 28 2026', 'MAKAHA       1049 AM           1-2');
    const times = parseOmr([later, earlier]).map((reading) => reading.time);
    assert.deepEqual(
      times,
      [...times].sort((a, b) => a - b),
    );
  });
});

describe('isOmrArchive', () => {
  it('accepts an archive and rejects an error page', () => {
    assert.equal(isOmrArchive(issue('WED OCT 28 2026', OCT_28)), true);
    assert.equal(isOmrArchive('<html>Service unavailable</html>'), false);
    assert.equal(isOmrArchive(''), false);
  });
});
