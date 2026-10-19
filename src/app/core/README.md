# core

App-wide wiring: providers, configuration and injection tokens.

**Lives here**

- `app.config` provider helpers (HTTP, router features, error handling)
- `GLASSY_CONFIG` and other config tokens (API base URLs, cache lifetimes)
- `SPOT_CATALOG` token that supplies the spot list, so other islands can plug in later
- The app-wide `ErrorHandler`

**May import:** `domain/` (tokens are typed with domain models).

**Imported by:** `data/`, `state/`, `map/` and `features/` to inject tokens. Wiring that needs the other
layers (for example registering stores) happens in `src/app/app.config.ts`, outside the layers.
