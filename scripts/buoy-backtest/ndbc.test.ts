import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compassToDegrees, isSpecFile, parseSpec } from './ndbc';

// An excerpt of 51201.spec, newest first as NDBC writes it, with a missing swell row.
const SPEC = `#YY  MM DD hh mm WVHT  SwH  SwP  WWH  WWP SwD WWD  STEEPNESS  APD MWD
#yr  mo dy hr mn    m    m  sec    m  sec  -  degT     -      sec degT
2026 10 29 18 26  1.9  0.9 11.1  1.7  9.9   N   N    AVERAGE  6.0   6
2026 10 29 17 56  1.9  0.9 11.1  1.6  5.9 NNE NNE    AVERAGE  5.9 359
2026 10 29 17 26  1.8   MM   MM  1.6  5.9  MM NNE        N/A  5.8 359
2026 10 29 16 56  1.8  0.8 10.5  1.6  5.9 WSW NNE    AVERAGE  5.7 350
`;

const hour = (iso: string): number => Date.parse(iso) / 1000;

describe('compassToDegrees', () => {
  it('converts the 16 compass points', () => {
    assert.equal(compassToDegrees('N'), 0);
    assert.equal(compassToDegrees('NNE'), 22.5);
    assert.equal(compassToDegrees('SSW'), 202.5);
    assert.equal(compassToDegrees('NNW'), 337.5);
  });

  it('gives NaN for anything else', () => {
    assert.ok(Number.isNaN(compassToDegrees('MM')));
    assert.ok(Number.isNaN(compassToDegrees('')));
  });
});

describe('parseSpec', () => {
  const hours = parseSpec(SPEC);

  it('keeps one reading per hour, oldest first', () => {
    assert.deepEqual(
      hours.map((entry) => entry.time),
      [hour('2026-10-29T17:00Z'), hour('2026-10-29T18:00Z')],
    );
  });

  it('keeps the reading closest to each hour', () => {
    // 17:26 and 16:56 both round to 17:00; 16:56 is closer. 17:56 and 18:26 round to 18:00.
    assert.deepEqual(hours[0], {
      time: hour('2026-10-29T17:00Z'),
      waveHeight: 1.8,
      swellHeight: 0.8,
      swellPeriod: 10.5,
      swellDirection: 247.5,
    });
    assert.equal(hours[1]?.swellDirection, 22.5);
  });

  it('reads MM as missing', () => {
    const missing = parseSpec(
      SPEC.split('\n')
        .filter((line) => !line.includes('16 56'))
        .join('\n'),
    );
    const at17 = missing.find((entry) => entry.time === hour('2026-10-29T17:00Z'));
    assert.equal(at17?.waveHeight, 1.8);
    assert.ok(Number.isNaN(at17?.swellHeight));
    assert.ok(Number.isNaN(at17?.swellDirection));
  });
});

describe('isSpecFile', () => {
  it('accepts a .spec file and rejects anything else', () => {
    assert.equal(isSpecFile(SPEC), true);
    assert.equal(isSpecFile('<html><body>Service unavailable</body></html>'), false);
    assert.equal(isSpecFile(''), false);
  });
});
