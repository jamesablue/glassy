# features

The user interface: panels, timeline, controls and popovers.

**Lives here**

- `shell/`: app layout, brand badge, loading overlay, notifications
- `spot-ranking/`, `spot-detail/`: the ranked list and the detail panel with its chart
- `timeline/`, `layer-picker/`, `legend/`, `settings/`, `about/`

**May import:** `domain/`, `state/`, `shared/`, plus config tokens from `core/`.

**Must not import:** `data/` (go through a store instead) or `map/`. The root `App` component puts the map
and the feature shell side by side, so neither layer needs the other.
