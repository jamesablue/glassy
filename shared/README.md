# shared: the snapshot contract

What the backend ingest and the app must agree on, and nothing else
([ADR-0010](../docs/adr/0010-backend-forecast-snapshot.md)):

| File                     | What it holds                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `snapshot.ts`            | `ForecastSnapshot`, `SNAPSHOT_FORMAT_VERSION`, `parseSnapshot` and `SnapshotError`    |
| `variables.ts`           | `SPOT_VARIABLES` and `GRID_VARIABLES`: the series a snapshot carries, in domain names |
| `grid.ts`                | `GridSpec`, `OAHU_GRID` and `gridCellCenters`, which fixes the order of grid cells    |
| `spots.ts`               | `Spot` and the `OAHU_SPOTS` catalog, whose order every per-spot series follows        |
| `catalog-fingerprint.ts` | `catalogFingerprint`, so a snapshot made for another catalog is refused               |

Import it as `@glassy/shared`, a path alias in the root and backend `tsconfig.json`. The app's
`src/app/domain/` re-exports the spot, grid and variable types from here, so the rest of the app
imports them from `domain/` as before. Scoring and everything else stays in the app.

## Rules

- **Plain TypeScript.** No packages, no `node:` modules, no browser APIs, and no imports from the
  app or `backend/`. The folder is flat and may only import `./` files, which ESLint enforces.
- **Changing the format** means bumping `SNAPSHOT_FORMAT_VERSION`, and shipping an app that accepts
  both versions before deploying a backend that writes the new one. Version 1 is provisional until
  #38 publishes it in production, so #39 may still change it in place.

## The format (version 1)

One JSON object: `formatVersion`, `fetchedAt` (ISO 8601), `source` (Open-Meteo, CC BY 4.0, and that
the data was modified), `catalogFingerprint`, `times` (Unix seconds), `spots.ids` and
`spots.series`, and `grid.spec` and `grid.fields`. Every series is hour-major: `count` values per
hour, `null` where the model has no data. #39 measures and optimizes it.

`parseSnapshot` refuses a snapshot with an unknown version, for another catalog or grid, or with
missing fields or series of the wrong length, and says which with `SnapshotError.code`.

## Tests

The specs here run with the backend's (`cd backend && npm test`), in Node. The app compiles these
files into its build, and its type check (`npm run typecheck`) covers them in the browser's
settings.
