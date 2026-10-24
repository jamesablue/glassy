# Glassy backend: the forecast ingest

Fetches the forecast from Open-Meteo and builds the one `forecast.json` snapshot the app reads
([ADR-0010](../docs/adr/0010-backend-forecast-snapshot.md)). The browser never calls Open-Meteo:
this package is the only code that does.

It is a package of its own, like `infra/`, with its own `package.json`, lockfile, `tsconfig.json`
and tests. Its lint and formatting run from the repository root (`npm run lint`,
`npm run format:check`), so every import boundary lives in the root `eslint.config.js`. There is no
AWS code yet: #38 adds a thin Lambda handler, `src/lambda.ts`, around the same ingest.

## Layout

```text
backend/src/
  cli.ts                  entry point for the two commands below
  run.ts                  argument parsing; writes nothing unless the whole snapshot validates
  write-snapshot.ts       validates with the app's parseSnapshot, then writes atomically (Node only)
  ingest/
    ingest.ts             the four requests in parallel, all or nothing
    build-snapshot.ts     four responses → ForecastSnapshot, in the domain's variable names, each
                          series encoded with the decimal places Open-Meteo sends
    fixtures.ts           the same snapshot from the recorded fixtures, with no network
    settings.ts           DEFAULT_INGEST_SETTINGS: URLs, grid, catalog, days, time zone, retries
  open-meteo/
    urls.ts               request URLs and variables; forecastCallCount (weighted API calls)
    client.ts             fetch with a per-attempt timeout and one retry on network errors and 5xx
    types.ts              raw response shapes
  geo/offshore-point.ts   where each spot's marine values are read
  testing/builders.ts     test builders
```

The snapshot's types, format version, encoding and validation, the grid and the spot catalog are in
[`shared/`](../shared/README.md), which the app also uses. A five-day snapshot is about 550 kB, and
about 100 kB compressed ([ADR-0011](../docs/adr/0011-snapshot-encoding.md)). Nothing else is shared: `backend/` may not
import from `src/`, and the app may not import from `backend/` (ESLint enforces both).

Until #40 switches the app to the snapshot, the app keeps its own copy of the Open-Meteo client,
URLs, types and adapter in `src/app/data/open-meteo/`. Both copies are tested against the same
recorded requests (`src/testing/fixtures/raw/manifest.json`), so they cannot drift apart. #40
deletes the app's copy.

## Commands

Run from the repository root (the root's `tsx` runs them, so `backend/` needs no install for these):

| Command                     | What it does                                                              |
| --------------------------- | ------------------------------------------------------------------------- |
| `npm run ingest`            | Fetches the live forecast and writes `.local/forecast.json`               |
| `npm run snapshot:fixtures` | Builds `.local/forecast.json` from the recorded fixtures, with no network |

Both take `--out <path>`; `snapshot:fixtures` also takes `--dir <folder>` for another recording.
`.local/` is git-ignored, and `npm start` serves `.local/forecast.json` as `/forecast.json` (the
`development` build configuration in `angular.json`; production builds never include it).

Run from `backend/`:

| Command             | What it does                            |
| ------------------- | --------------------------------------- |
| `npm ci`            | Installs the dev dependencies           |
| `npm test`          | Unit tests for `backend/` and `shared/` |
| `npm run typecheck` | TypeScript for `backend/` and `shared/` |

## What a run costs

Open-Meteo counts each location of a multi-location request as its own call, so one run is about
**388 weighted calls**, not 4 (`forecastCallCount`, and the table in ADR-0010). The free tier
allows 10,000 a day per IP address. `npm run ingest` spends them from your own address, so use
`npm run snapshot:fixtures` for tests and most development, and the live ingest only when you need
today's forecast. Retries are kept to one per request for the same reason: a retry of a grid request
costs another 165 calls.

A run fails as a whole. If any request fails after its retry, or the responses do not line up with
the grid and the catalog, nothing is written and the previous `forecast.json` stays as it was.

## Tests

Specs sit next to the code (`*.spec.ts`) and use Vitest globals. `vitest.config.mts` also runs the
specs in `shared/`. They need no network: they read the recorded fixtures in
`src/testing/fixtures/` as files, and fake `fetch`. `ingest/fixtures.spec.ts` checks that a snapshot
built from the recording holds exactly the spot series the recorder unpacked on its own
(`spot-forecast.fixture.json`), the same cross-check the app's adapter has.
