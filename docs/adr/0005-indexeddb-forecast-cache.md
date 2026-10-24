# ADR-0005: An IndexedDB forecast cache with a stale fallback and a catalog fingerprint

- **Status:** Accepted
- **Date:** 2026-10-18 (implemented in [#21](https://github.com/jamesablue/glassy/pull/21));
  amended 2026-10-19 with the catalog fingerprint ([#26](https://github.com/jamesablue/glassy/pull/26),
  fixing [#23](https://github.com/jamesablue/glassy/issues/23)); amended 2026-10-19 to show a stale
  copy while it refreshes and to cache only complete forecasts
  ([#32](https://github.com/jamesablue/glassy/issues/32)); amended 2026-10-23 for the backend
  snapshot ([ADR-0010](0010-backend-forecast-snapshot.md))
- **Deciders:** James Blue

## Context and problem

A forecast only changes when the models run again, yet without a cache every page load fetches four
large responses from Open-Meteo, whose free tier is rate limited. People also open the app at the beach,
where the connection may be poor or gone. The prototype cached the last forecast in localStorage as
JSON.

The forecast is held as `Float32Array`s (a five-day grid of wind, waves and swell plus per-spot
series), which JSON can only store by converting every number.

## Decision drivers

- No requests at all when the cached forecast is recent.
- Recent data on screen, clearly labeled, when a refresh fails, and while a slow one runs.
- Typed arrays stored as they are, without encoding or rounding.
- Storage failures (private browsing, a full quota, a blocked database) must never break the app.
- A cached forecast must never be shown against spots it was not fetched for.

## Considered options

1. localStorage with JSON, as in the prototype.
2. IndexedDB through `idb-keyval`, storing the bundle by structured clone.
3. The Cache API or a service worker caching the HTTP responses.
4. No cache.

## Decision

Option 2. `ForecastCache` (`src/app/data/cache/forecast-cache.ts`) keeps one record under a fixed
key: the bundle, `fetchedAt`, a schema version, the spot ids in catalog order and the grid.

| Situation                                                           | What `ForecastRepository.load()` does                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Cached forecast younger than 45 minutes                             | uses it, with no requests                                                                              |
| Otherwise, a cached forecast under 12 hours                         | shows it at once while it refreshes in the background; swaps in the fresh forecast once it is complete |
| … the refresh fails or times out, in any part                       | keeps the cached forecast, now labeled stale, with the reason                                          |
| Nothing usable cached                                               | fetches, showing the spot forecast before the map grid; saves the forecast once it is complete         |
| … the spot requests fail                                            | a typed error: `RateLimitedError` or `ForecastUnavailableError`                                        |
| Old version, other catalog or grid, corrupt, or storage unavailable | treated as a miss                                                                                      |

`load({ force: true })` (Retry, back online) skips the fresh cache; a stale copy still shows while
it refreshes.

**Stale-while-revalidate** (amended in #32). A slow upstream once kept the page on its loading
screen for a minute although a usable forecast was cached. A cached forecast past its 45 minutes
is now shown straight away, marked as refreshing, and the ranking says when it was fetched. It is
replaced only by a complete fresh forecast, so the ranking and the map never mix two fetches; a
refresh whose grid fails counts as failed.

**Only complete forecasts are saved.** A first visit can show the spot forecast before the map grid
arrives (see [architecture.md](../architecture.md#startup-sequence)), but only the complete
forecast is written. Whatever the cache returns can then be drawn in full: a saved spot forecast
would leave the map without its layers for the cache's whole lifetime, and as a stale copy it could
not stand in for a complete one.

**With the snapshot** (amended for [ADR-0010](0010-backend-forecast-snapshot.md), built in
[#40](https://github.com/jamesablue/glassy/issues/40)). The cache stays as it is, but what it
falls back from changes:

- A refresh fetches one `forecast.json` from our own CloudFront distribution, instead of four
  Open-Meteo requests. The cache still stores the decoded bundle, with the same fingerprint check.
- The order is fresh cache, then the snapshot, then the stale copy (up to `cacheMaxStaleMs`,
  12 hours), then an error. **The stale copy is now the only fallback:** nothing ever calls
  Open-Meteo directly.
- A snapshot that is older than 7 hours, has an unknown `formatVersion` or was built for another
  catalog counts as a failed refresh, the same as a network error.
- A record's age is the snapshot's `fetchedAt`, when the ingest fetched the data, not when the
  browser downloaded it. A snapshot is up to 3 hours old when it arrives.
- The snapshot is one file, so the spot-then-grid split and `RateLimitedError` in the table above go
  away in #40, and the "spot requests fail" row becomes "the snapshot fails".

## Consequences

**Good**

- A reload within 45 minutes sends no forecast request.
- A returning visitor within 12 hours never waits on the network: the cached forecast is on screen
  at once, and the fresh one replaces it when it is ready.
- A failed refresh shows "Couldn't refresh the forecast. Showing data from Sun 8 AM." and the
  ranking notes the data's age, instead of an empty map.
- Structured clone keeps the typed arrays intact: no JSON round trip on the way in or out.
  `idb-keyval` adds about 600 bytes.
- Bumping the schema version makes the next fetch overwrite the old record, instead of leaving an
  orphaned one of about a megabyte.
- **The fingerprint.** #23 found that a forecast cached before the spot catalog changed no longer
  lined up with it: with spots added or removed, building the score matrix threw on a returning
  visit, and with spots reordered, one spot's series would be read as another's. Each record now
  carries the ordered spot ids and the grid; a mismatch is a miss, fresh or stale (record version
  2). Tests cover spots added, removed, swapped and renamed, and the grid moved.

**Bad**

- The cache is per browser: a first visit always fetches, and visitors share nothing. (Since
  [ADR-0010](0010-backend-forecast-snapshot.md), what a first visit fetches is the shared snapshot.)
- Stale data can be up to 12 hours old. The UI says how old, but the conditions may have changed.
  It is now also what a returning visitor sees first, for as long as the refresh takes (at most
  25 s, the request timeout).
- When the grid keeps failing, nothing is cached, so each visit fetches the spot forecast again.
  Those two requests are small and fast, so this costs little.
- Only the forecast is cached. The app shell and map tiles rely on the browser's HTTP cache, so this
  is not an offline app; [#13](https://github.com/jamesablue/glassy/issues/13) tracks a PWA mode.

## Alternatives considered

- **localStorage.** Synchronous, string-only and limited to about 5 MB per origin; the typed arrays
  would have to be encoded on every save and read.
- **Cache API or a service worker.** Good for responses and the app shell, but it caches raw JSON
  that still has to be adapted on every start, and freshness rules for a forecast are easier to
  express on the adapted bundle. It fits better with the PWA work in #13.
- **No cache.** Simplest, but every reload would cost four requests against the rate limit, and a
  failed load would leave nothing to show.
