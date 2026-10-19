# core

App-wide wiring: providers, configuration and injection tokens.

**Lives here**

- `GlassyConfig` and `DEFAULT_GLASSY_CONFIG` (`glassy-config.ts`): API base URLs, the forecast grid, forecast
  days, time zone, cache lifetimes and the offshore distance. Plain data with no Angular imports, so Node
  scripts build the same requests as the app
- `GLASSY_CONFIG` and `provideGlassyConfig(overrides?)`: the config as an injection token, with no implicit
  default, so every app or test states its environment
- `SPOT_CATALOG`: the spot list, defaulting to Oahu, so other islands can plug in later
- `CLOCK`: the current time, the system clock unless replaced, so tests can fix "now"
- Later: other app-wide provider helpers and the `ErrorHandler`

**May import:** `domain/` (tokens are typed with domain models).

**Imported by:** `data/`, `state/`, `map/` and `features/` to inject tokens. Wiring that needs the other
layers (for example registering stores) happens in `src/app/app.config.ts`, outside the layers.
