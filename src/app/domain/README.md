# domain

Pure TypeScript: the snorkel scoring model and everything it needs.

**Lives here**

- `models/`: `Spot`, `HourlySample`, `ConditionsAssessment`, `ForecastBundle` and other types
- `scoring/`: exposure, period factor, penalty tables, `assessConditions`, ratings, best window
- `grid/`: grid position, bilinear sampling, vector fields
- `color/` and `bathymetry/`: palettes, colour lookup tables, depth classes
- `units/`, `geo/`, `time/`: unit conversion and formatting, offshore points, label declutter, Hawaii time
- `spots/`: the Oahu spot catalog

**May import:** nothing outside `domain/`. No `@angular/*`, `rxjs`, `leaflet`, browser APIs or other layers.
ESLint enforces this.

**Why:** everything here is deterministic and runs in plain Node, so it is fast to test and easy to reuse
(for example in a Web Worker).
