# ADR-0001: Static SPA with no backend

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** James Blue

## Context and problem

Glassy answers one question: where on Oahu is the snorkeling good right now, and when will it be
good later? Everything it needs is public. Open-Meteo serves marine and weather forecasts with CORS
headers and no API key, NOAA NCEI's DEM ImageServer renders depth and land tiles and answers point
lookups, and Esri serves basemap tiles. Scoring 25 spots for every hour of a five-day forecast is a
few thousand small calculations.

The question was whether anything needs to run on a server.

## Decision drivers

- No running cost and nothing to operate, so the live demo can stay up indefinitely.
- No secrets: nothing that would need a server to hide an API key.
- Works on a phone at the beach, including with a flaky connection.
- Deterministic and testable without a deployed service.

## Considered options

1. A static single-page app that calls the public APIs from the browser.
2. A single-page app plus a small backend (a Lambda or a Cloudflare Worker) that fetches, caches and
   scores the forecast for everyone.
3. A server-rendered app (Angular SSR) on a Node host.

## Decision

Option 1. Glassy is a static Angular build. The browser fetches the forecast, scores it with the
pure functions in `src/app/domain/`, keeps the last forecast in IndexedDB and draws the map. The
workspace was generated with `--ssr false`.

## Consequences

**Good**

- It is just files: GitHub Pages hosts the demo for free, and the AWS stack is a private bucket
  behind CloudFront ([ADR-0007](0007-dual-hosting-pages-and-aws.md)).
- The Content-Security-Policy can name every outside host the app talks to: Open-Meteo's two APIs,
  NOAA and Esri.
- Every layer is testable offline: the end-to-end suite serves recorded responses
  ([ADR-0006](0006-vitest-playwright-recorded-fixtures.md)).
- The scoring model has no framework code, so it could move to a server or a worker unchanged.

**Bad**

- Each visitor calls Open-Meteo directly, under the free tier's non-commercial terms and per-IP
  limits (600 calls a minute, 5,000 an hour, 10,000 a day). The IndexedDB cache
  ([ADR-0005](0005-indexeddb-forecast-cache.md)) means a reload within 45 minutes sends no request,
  and a 429 becomes a typed `RateLimitedError` with its own message, but nothing is shared between
  visitors.
- Every visitor downloads the raw forecast: in the recording, about 730 kB of JSON for 48 hours,
  before compression. A five-day forecast is proportionally more.
- First load depends on four third-party requests succeeding. Retries (after 1 s and 2 s), a 25 s
  timeout per request, showing the spot forecast before the slower map grid, and showing a cached
  forecast while it refreshes soften this but cannot remove it.

## Alternatives considered

- **A backend proxy and cache.** It would share one fetch between all visitors, shrink the payload
  to what the UI needs and protect against rate limits. It also adds a service to run, monitor and
  pay for. It stays in the backlog as
  [#17](https://github.com/jamesablue/glassy/issues/17), to be built if the rate limits ever bite.
- **Server-side rendering.** The first paint is a map that needs tiles and a forecast either way,
  so pre-rendering would buy little and would need a Node host.
