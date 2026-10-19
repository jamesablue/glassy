# data

Talks to the outside world and turns responses into domain types.

**Lives here**

- `open-meteo/`: URL builder, HTTP client, response types, adapter that packs responses into a `ForecastBundle`
- `noaa/`: bathymetry point lookups and the raster function rules for NOAA DEM tiles
- `cache/`: IndexedDB forecast cache with a freshness window and stale fallback
- `forecast.repository.ts`: cache-first loading used by the state layer

**May import:** `domain/`, plus config tokens from `core/` (and Angular, `rxjs` and small data libraries).

**Must not import:** `state/`, `map/`, `features/`, `shared/`.
