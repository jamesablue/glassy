# ADR-0005: An IndexedDB forecast cache with a stale fallback and a catalog fingerprint

- **Status:** Accepted
- **Date:** 2026-10-18 (implemented in [#21](https://github.com/jamesablue/glassy/pull/21));
  amended 2026-10-19 with the catalog fingerprint ([#26](https://github.com/jamesablue/glassy/pull/26),
  fixing [#23](https://github.com/jamesablue/glassy/issues/23))
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
- Recent data on screen, clearly labeled, when a refresh fails.
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

| Situation                                                           | What `ForecastRepository.load()` does                           |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| Cached forecast younger than 45 minutes                             | uses it, with no requests                                       |
| Otherwise                                                           | fetches; on success, saves in the background                    |
| The fetch fails and the cache is under 12 hours                     | shows the cached forecast as stale, with the reason             |
| The fetch fails and nothing usable is cached                        | a typed error: `RateLimitedError` or `ForecastUnavailableError` |
| Old version, other catalog or grid, corrupt, or storage unavailable | treated as a miss                                               |

`load({ force: true })` (Retry, back online) skips the fresh cache but keeps the stale fallback.

## Consequences

**Good**

- A reload within 45 minutes sends no forecast request.
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

- The cache is per browser: a first visit always fetches, and visitors share nothing
  (see [#17](https://github.com/jamesablue/glassy/issues/17) for a shared proxy).
- Stale data can be up to 12 hours old. The UI says how old, but the conditions may have changed.
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
