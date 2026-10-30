# domain

Pure TypeScript: the snorkel scoring model and everything it needs.

**Lives here**

- `models/`: `Spot`, `SpotHourSample`, `Conditions`, `ForecastBundle` (and its spot half,
  `SpotForecastBundle`), `GridSpec` and other types
- `scoring/`: exposure, period factor, penalty tables, `assessConditions`, ratings, hazards, best window,
  score matrix and ranking
- `forecast/`: reading one spot's hour out of a packed `SpotForecast`
- `grid/`: grid cell centres, grid position, bilinear sampling, vector fields, point sampling
- `color/` and `bathymetry/`: palettes, colour lookup tables, layer catalog, depth classes, and WCAG contrast
  (`contrastRatio`, and `inkFor`, which picks black or white text for a fill or a stretch of gradient)
- `legend/`: legend ticks and the legend for a layer in the user's units
- `units/`, `geo/`, `time/`: unit conversion and formatting, offshore and sampling points, label declutter, Hawaii time
- `spots/`: the Oahu spot catalog
- `math/`: small numeric helpers shared by the folders above

Each folder has an `index.ts` that exports its public API. Types shared across folders live in `models/`; a
result type that belongs to one function (for example `BestWindow` or `LegendSpec`) sits next to it.

**May import:** nothing outside `domain/`, except the snapshot contract `@glassy/shared` (`shared/` at the
repository root). No `@angular/*`, `rxjs`, `leaflet`, browser APIs or other layers. ESLint enforces this.

`Spot`, the Oahu catalog, `GridSpec`, `OAHU_GRID`, `gridCellCenters`, `LatLon` and `SPOT_VARIABLES` are part of
that contract, because the backend ingest uses them too. They are defined in `shared/` and re-exported here
(`models/`, `spots/`, `grid/`), so the rest of the app imports them from `domain/` as before.

**Why:** everything here is deterministic and runs in plain Node, so it is fast to test and easy to reuse
(for example in a Web Worker).

**Tests:** specs sit next to the code they test, and coverage below 95% fails `npm run test:ci`. `scoring/golden.spec.ts`
checks the port against the original prototype's scores on recorded Open-Meteo data
(`src/testing/fixtures/`, refreshed with `npm run fixtures:record` and `npm run fixtures:expected`).
