# data

Talks to the outside world and turns responses into domain types.

**Lives here**

- `open-meteo/`: the four forecast requests (`forecastRequestUrls`, `OpenMeteoClient`), raw response types,
  and the adapter that packs the responses into a domain `ForecastBundle` (`toForecastBundle`)
- `noaa/`: point elevations from the NOAA DEM ImageServer (`BathymetryClient`), the raster function rules
  for land and depth tiles, and the `exportImage` tile URL builder the map's tile layer uses
- `cache/`: `ForecastCache`, the last forecast in IndexedDB with a freshness window and a stale fallback
- `forecast.repository.ts`: `ForecastRepository.load()`, cache-first loading used by the state layer
- `forecast-errors.ts`, `retry-transient.ts`: typed load errors and the retry policy

**How a load works**

| Situation                                        | `load()` emits                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| Cached forecast younger than 45 min              | `source: 'cache'`, no requests                                          |
| Otherwise, all four requests succeed             | `source: 'network'`, and it is cached                                   |
| Network error or 5xx                             | the request is retried after 1 s and 2 s                                |
| Still failing, or any 4xx, cached copy < 12 h    | `source: 'stale-cache'` with the `error`                                |
| Still failing, or any 4xx, no usable cached copy | errors with `RateLimitedError` (HTTP 429) or `ForecastUnavailableError` |

`load({ force: true })` skips the fresh cache but keeps the stale fallback.

**May import:** `domain/`, plus config tokens from `core/` (and Angular, `rxjs` and `idb-keyval`).

**Must not import:** `state/`, `map/`, `features/`, `shared/`.

**Tests:** specs sit next to the code. HTTP goes through `HttpTestingController`, the cache runs on
`fake-indexeddb`, and recorded API responses (`src/testing/fixtures/raw/`) run through the adapter and
must reproduce the golden scoring fixture. Coverage below 90% fails `npm run test:ci`.
