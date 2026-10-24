# ADR-0011: The snapshot's encoding: lossless delta JSON

- **Status:** Accepted
- **Date:** 2026-10-23 ([#39](https://github.com/jamesablue/glassy/issues/39))
- **Deciders:** James Blue

## Context and problem

[ADR-0010](0010-backend-forecast-snapshot.md) replaces the browser's four Open-Meteo requests with
one `forecast.json` snapshot and leaves its encoding to #39. The first version from #42 was plain
JSON with every series hour-major (all locations for hour 0, then hour 1, and so on). Measured on a
live five-day run, that is 900 kB, and under Brotli it is _larger_ than the four raw responses it
replaces. The file is downloaded on a phone, often on a weak connection at the beach.

## Decision drivers

- Small transferred size for five days (120 hours × 25 spots × 165 grid cells).
- Lossless: the app's scores, layers and particles must not change when it switches to the snapshot.
- Quick to decode on a phone, and easy to read and debug.
- Served by CloudFront with no extra infrastructure.

## Considered options

Measured on 2026-10-23 from one live five-day run. Every format holds the same 26 series; sizes in
kB. CloudFront compresses on the fly at an unpublished level, between the gzip-6 and br-5 columns.

| Format                                                      |  Raw | gzip-6 | br-5 | br-11 |
| ----------------------------------------------------------- | ---: | -----: | ---: | ----: |
| Today: the four Open-Meteo responses                        | 1628 |    193 |  162 |   127 |
| 1. JSON, hour-major (v1 from #42)                           |  900 |    176 |  177 |   148 |
| 2. JSON, location-major                                     |  900 |    139 |  144 |   112 |
| 3. JSON, scaled integers, location-major                    |  793 |    134 |  137 |   110 |
| **4. JSON, scaled integers, location-major, hourly deltas** |  553 |     99 |  101 |    82 |
| 5. Option 4, with periods and wind speed rounded to 1 dp    |  509 |     84 |   85 |    70 |
| 6. Binary: JSON header and `Float32Array`s, location-major  |  852 |    152 |  148 |   116 |
| 7. Binary: JSON header and `Int16Array` deltas              |  427 |    101 |   95 |    79 |

Open-Meteo serves today's responses with deflate: **216 kB on the wire** for the four.

Decoding into the `Float32Array`s the app uses (desktop Node, median of 30): option 1 takes 14.7 ms,
option 4 takes 2.0 ms and option 7 takes 4.6 ms.

## Decision

Option 4, as snapshot format version 1 (changed in place, since nothing published it yet).

- Each series is `{ "decimals": d, "deltas": [...] }`. Values are stored as integers, multiplied by
  `10^d`. Each spot or cell gets one run of hours, and each hour holds the change from the
  previous non-`null` value. `encodeSeries` and `decodeSeries` in `shared/series-codec.ts` define it.
- `decimals` is what Open-Meteo sends: 2 for heights, periods, sea level and wind speed, 1 for sea
  temperature, current speed and gusts, 0 for directions, rain chance and daylight. Nothing is
  rounded beyond that, so the snapshot holds exactly the values the API returned. `n / 10^d` is
  correctly rounded, so the decoded floats are bit for bit those the app builds today; a fixture
  test checks the whole `ForecastBundle`.
- It stays `application/json`, compressed by CloudFront.

## Consequences

- About **100 kB on the wire for five days, down from 216 kB** (54% less), and 82 kB if the ingest
  precompresses at Brotli 11 (#38 can choose that).
- Decoding is a loop per series rather than `JSON.parse` alone, and is still faster than v1 because
  the file is smaller.
- The deltas are unreadable by eye. `decodeSeries` turns a series back into hourly values.
- If Open-Meteo starts sending more decimal places, the snapshot rounds them to the current ones
  until `decimals` in `backend/src/ingest/build-snapshot.ts` is raised. The file carries `decimals`,
  so that needs no new format version.

## Alternatives considered

- **Options 1–3** keep more of v1, but compress 10–50% worse.
- **Option 5** saves 15% more, but changes the data, so scores could change. Not worth it.
- **Options 6 and 7.** Binary is 4% smaller than option 4 at best. CloudFront does not compress
  `application/octet-stream`, so the ingest would have to precompress it, and it needs a custom reader
  and writer and is opaque in a browser's network panel. The issue asked for JSON unless the savings
  were large; they are not.
