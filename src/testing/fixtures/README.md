# Test fixtures

Real forecast data, recorded in one run by `npm run fixtures:record` (`scripts/record-fixtures.ts`), so
every file describes the same forecast.

| File                               | What it is                                                                         | Used by                                                     |
| ---------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `raw/open-meteo-grid-marine.json`  | Marine API response for the 165 map grid cells (waves, swell)                      | data adapter and repository tests, end-to-end network mocks |
| `raw/open-meteo-grid-wind.json`    | Forecast API response for the grid cells (wind)                                    | same                                                        |
| `raw/open-meteo-spot-marine.json`  | Marine API response for the point offshore of each spot                            | same                                                        |
| `raw/open-meteo-spot-weather.json` | Forecast API response at each spot (wind, gusts, rain, daylight)                   | same                                                        |
| `raw/noaa-identify-ocean.json`     | NOAA DEM `identify` response for a point in Hanauma Bay                            | bathymetry client tests, end-to-end network mocks           |
| `raw/noaa-identify-land.json`      | The same for a point on Diamond Head                                               | same                                                        |
| `raw/noaa-identify-nodata.json`    | The same for a point outside the mosaic (`"value": "NoData"`)                      | same                                                        |
| `raw/manifest.json`                | Recording time, the exact URL behind each raw file, and data attribution           | adapter fixture test, end-to-end network mocks              |
| `spot-forecast.fixture.json`       | Each spot's hourly series in the domain's variable names, unpacked by the recorder | golden scoring test, adapter fixture test                   |
| `forecast-snapshot.json`           | The `forecast.json` snapshot the backend builds from the `raw/` responses          | snapshot decoder fixture test                               |
| `spot-forecast.expected.json`      | Scores, surf heights and rankings from the original prototype's code               | golden scoring test                                         |

## Raw responses

The `raw/` files are the API bodies as received, compact JSON like the originals (Prettier skips them),
except that every Open-Meteo hourly series is cut to the first 48 hours the four responses share. The requests are
built with the app's own `forecastRequestUrls` and `identifyUrl`, so each URL in `manifest.json` is the URL
the app requests with the default configuration. `open-meteo.adapter.fixtures.spec.ts` fails when the
configuration or the spot catalog changes and the fixtures need recording again.

To mock the network, serve each file for the URL listed next to it in `manifest.json`.

The backend reads the same files: its URL test checks the ingest's requests against `manifest.json`, and
`npm run snapshot:fixtures` (`backend/src/ingest/fixtures.ts`) builds a `forecast.json` snapshot from them with
no network, dated to `recordedAt`. That snapshot is committed as `forecast-snapshot.json`, because the
app's tests may not import the backend; a backend test fails when it no longer matches.

## Refreshing

```sh
npm run fixtures:record    # needs network access to Open-Meteo and NOAA
npm run fixtures:expected  # re-scores the new data with the prototype's code
npm run snapshot:fixtures -- --out src/testing/fixtures/forecast-snapshot.json
```

All three steps rewrite tracked files; commit them together. Rerun the last one alone whenever the
snapshot format changes. Open-Meteo data is CC BY 4.0
(https://open-meteo.com); the DEM data is from NOAA NCEI.
