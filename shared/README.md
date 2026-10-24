# shared: the snapshot contract

What the backend ingest and the app must agree on, and nothing else
([ADR-0010](../docs/adr/0010-backend-forecast-snapshot.md)):

| File                     | What it holds                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `snapshot.ts`            | `ForecastSnapshot`, `SNAPSHOT_FORMAT_VERSION`, `parseSnapshot` and `SnapshotError`    |
| `series-codec.ts`        | `EncodedSeries`, `encodeSeries` and `decodeSeries`: how each series is stored         |
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
  #38 publishes it in production, and may still change in place until then.

## The format (version 1)

One JSON object: `formatVersion`, `fetchedAt` (ISO 8601), `source` (Open-Meteo, CC BY 4.0, and that
the data was modified), `catalogFingerprint`, `times` (Unix seconds), `spots.ids` and
`spots.series`, and `grid.spec` and `grid.fields`
([ADR-0011](../docs/adr/0011-snapshot-encoding.md)). Each series is stored compactly:

```json
"waveHeight": { "decimals": 2, "deltas": [142, 0, 0, 2, 0, -2, null, -4] }
```

- Values are integers, multiplied by `10^decimals`.
- Location-major: one run of `times.length` values per spot (in `spots.ids` order) or grid cell (in
  field order), one after another.
- The first value in a run is the scaled value; each later one is the change from the previous
  value that is not `null`. `null` where the model has no data.

`decodeSeries(series, locationCount)` gives back an hour-major `Float32Array` (index =
`hour * locationCount + location`, `NaN` for missing), the layout the app works in. The values are
exactly the ones Open-Meteo sent. A five-day snapshot is about 550 kB, and about 100 kB compressed.

`parseSnapshot` refuses a snapshot with an unknown version, for another catalog or grid, or with
missing fields, or series of the wrong length or holding anything but whole numbers, and says which
with `SnapshotError.code`.

## Tests

The specs here run with the backend's (`cd backend && npm test`), in Node. The app compiles these
files into its build, and its type check (`npm run typecheck`) covers them in the browser's
settings.
