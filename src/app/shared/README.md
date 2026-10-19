# shared

Small, reusable presentation pieces with no knowledge of app state.

**Lives here**

- `ui/`: rating badge, direction arrow, panel, segmented control, icon
- `pipes/`: pure formatting pipes (`surfRange`, `height`, `speed`, `temperature`, `depth`, `compass`, `hstTime`)

**May import:** `domain/` (plus Angular).

**Must not import:** `data/`, `state/`, `map/`, `features/`, `core/`.
