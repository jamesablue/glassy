# map

The Leaflet map, built from Angular components.

**Lives here**

- `map-host/`: `MapHostComponent` creates the map and its panes and shares a `MapContext` with child layers
- `layers/`: basemap, terrain, depth, scalar field, particles, spot markers, point inspector
- `renderers/`: framework-free canvas renderers (scalar field, particle system)

**May import:** `domain/`, `state/`, plus config tokens from `core/` (and Angular and Leaflet).

**Must not import:** `data/`, `features/`, `shared/`.
