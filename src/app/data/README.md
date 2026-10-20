# data

Talks to the outside world and turns responses into domain types.

**Lives here**

- `open-meteo/`: the four forecast requests (`forecastRequestUrls`, `OpenMeteoClient`), raw response types,
  and the adapter that packs the responses into a domain `ForecastBundle` (`toForecastBundle`), or the
  spot responses alone into a `SpotForecastBundle` that the grid completes later (`toSpotForecastBundle`,
  `withGrid`)
- `noaa/`: point elevations from the NOAA DEM ImageServer (`BathymetryClient`), the raster function rules
  for land and depth tiles, the `exportImage` tile URL builder, and `NoaaTerrainTileSources`, which implements
  the `TERRAIN_TILE_SOURCES` token from `core/` with them so the map gets tile URLs without importing `data/`
  (`provideNoaaTileSources()`)
- `cache/`: `ForecastCache`, the last complete forecast in IndexedDB with a freshness window and a stale
  fallback. Each record also keeps the spot ids in order and the grid it was fetched for; a record made
  for another catalog or grid is a miss, fresh or stale, because its series would no longer line up with
  the spots
- `forecast.repository.ts`: `ForecastRepository.load()`, used by the state layer: the cache first, a
  stale copy while it refreshes, and the spot forecast ahead of the map grid
- `forecast-errors.ts`, `retry-transient.ts`, `request-deadline.ts`: typed load errors, the retry
  policy and the per-request deadline

**How a load works**

`load()` emits one or more results and completes. Each says where the forecast came from (`source`)
and whether its map grid is in (`gridStatus`):

| Situation                                         | `load()` emits                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Cached forecast younger than 45 min               | `source: 'cache'`, no requests                                                                 |
| Cached forecast younger than 12 h                 | at once `source: 'stale-cache', refreshing: true`; then the refresh below                      |
| … all four requests succeed                       | `source: 'network'` (complete), and it is cached                                               |
| … any request fails, the grid included            | `source: 'stale-cache', refreshing: false` with the `error`                                    |
| Nothing usable cached: the two spot requests land | `source: 'network', gridStatus: 'loading'`: the spot forecast alone                            |
| … then the two grid requests land                 | `source: 'network', gridStatus: 'ready'` (complete), and it is cached                          |
| … or the grid fails                               | `source: 'network', gridStatus: 'failed'` with the `gridError`; nothing is cached              |
| … or the spot requests fail                       | errors with `RateLimitedError` (HTTP 429) or `ForecastUnavailableError`                        |
| Network error or 5xx on any request               | the request is retried after 1 s and 2 s                                                       |
| A request still unanswered 25 s after it was sent | it is cancelled with a `ForecastTimeoutError` (a `ForecastUnavailableError`) and never retried |

`load({ force: true })` skips the fresh cache; a stale copy is still shown while it refreshes.

**Waiting on the network.** Each request has one deadline (`forecastRequestTimeoutMs`, 25 s) that
covers all its attempts: the retries and their waits fit inside it instead of adding to it, so no
request takes longer than 25 s however it fails, and the four run in parallel, so neither does a
load. In the worst case a first visit sees the spot forecast or the Retry screen 25 s after the
requests went out; a returning visitor sees their cached forecast at once and the refresh gives up
after 25 s. A timeout is not retried, because an upstream slow enough to time out only gets slower
when asked twice.

**Why the spot forecast comes first.** The grid requests cover 165 points and have taken Open-Meteo
a minute when the spot requests took seconds. The ranking, the spot details and the timeline need
nothing from the grid, so `toSpotForecastBundle` packs the spot responses on their own and
`withGrid` completes them once the grid lands, on the hours all four datasets share. When those are
the spot forecast's own hours (the usual case) the spot half is kept as it is, so nothing derived
from it changes when the map layers arrive.

**Only complete forecasts are cached**, so anything read from the cache can be drawn in full. A
cached spot forecast would hide the map layers for the whole cache lifetime, and a stale copy is only
ever replaced by a complete one, so the ranking and the map always come from the same fetch.

**May import:** `domain/`, plus config tokens from `core/` (and Angular, `rxjs` and `idb-keyval`).

**Must not import:** `state/`, `map/`, `features/`, `shared/`.

**Tests:** specs sit next to the code. HTTP goes through `HttpTestingController`, the cache runs on
`fake-indexeddb`, and recorded API responses (`src/testing/fixtures/raw/`) run through the adapter and
must reproduce the golden scoring fixture. Coverage below 90% fails `npm run test:ci`.
