# state

Application state as small signal-based stores.

**Lives here**

- `ForecastStore`: loading status, the current forecast bundle, errors, reload
- `TimelineStore`: selected hour, current hour, playback
- `MapUiStore`: active layer, toggles, selected spot, region filter, inspected point
- `SettingsStore`: units, saved to localStorage
- `ConditionsStore`: computed score matrix, ranking, selected spot detail, legend
- `UrlStateSync`: keeps `?layer=&spot=&t=` in the URL in both directions

**May import:** `domain/`, `data/`, plus config tokens from `core/`.

**Must not import:** `map/`, `features/`, `shared/`.
