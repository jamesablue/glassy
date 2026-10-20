# core

App-wide wiring: providers, configuration and injection tokens.

**Lives here**

- `GlassyConfig` and `DEFAULT_GLASSY_CONFIG` (`glassy-config.ts`): API base URLs, the forecast grid, forecast
  days, time zone, cache lifetimes, the forecast request timeout and the offshore distance. Plain data with
  no Angular imports, so Node scripts build the same requests as the app
- `GLASSY_CONFIG` and `provideGlassyConfig(overrides?)`: the config as an injection token, with no implicit
  default, so every app or test states its environment
- `SPOT_CATALOG`: the spot list, defaulting to Oahu, so other islands can plug in later
- `CLOCK`: the current time, the system clock unless replaced, so tests can fix "now"
- `TERRAIN_TILE_SOURCES`: where the map's land and depth tiles come from. `map/` may not import `data/`, so the
  map depends on this interface and `data/noaa/` implements it (`provideNoaaTileSources()` in `app.config.ts`).
  Like `GLASSY_CONFIG` it has no default
- `PREFERS_REDUCED_MOTION`: the "reduce motion" setting as a signal that follows changes, so code that
  animates on its own (the map's flights) can move instantly instead
- `AppNotices`: the channel from code that notices a problem (the error handler, the map's tile layers) to the
  shell that tells the user. Each kind of notice is raised at most once a minute, so a burst of failures
  makes one notice
- `GlassyErrorHandler` and `provideGlassyErrorHandler()`: the app's `ErrorHandler`. It logs each distinct
  unhandled error once, with its stack, and raises a generic `unexpected-error` notice: details stay in the
  console, never on screen

**May import:** `domain/` (tokens are typed with domain models).

**Imported by:** `data/`, `state/`, `map/` and `features/` to inject tokens. Wiring that needs the other
layers (for example registering stores) happens in `src/app/app.config.ts`, outside the layers.
