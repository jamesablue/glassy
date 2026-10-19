# features

The user interface that floats over the map: the side panel, the timeline, the map controls, the
legend, the popovers and the notices.

## Component inventory

```
AppShellComponent                  shell/        container · layout, app-wide keys, notices
├─ BrandBadgeComponent             shell/        logo, name, tagline (hidden on phones)
├─ PanelComponent (shared)         the side panel card
│  ├─ SpotRankingPanelComponent    spot-ranking/ container · header, fold, list
│  │  ├─ RegionFilterComponent     spot-ranking/ All / North / Windward / South / West
│  │  └─ SpotRankingRowComponent   spot-ranking/ rank, name, surf, wind, score pill
│  └─ SpotDetailPanelComponent     spot-detail/  container · @defer, loaded on first open
│     ├─ HazardNoticeComponent     spot-detail/  big surf, onshore wind, current
│     ├─ ConditionsGridComponent   spot-detail/  surf, wind, swells, water, current, tide, rain
│     ├─ ScoreTrendChartComponent  spot-detail/  SVG bars, surf line, days, marker; click to seek
│     └─ BestWindowComponent       spot-detail/  "Best daylight window: Sat 9 AM–12 PM · …"
├─ LayerMenuComponent              layer-picker/ container · the right-hand menu
│  ├─ LayerPickerComponent         layer-picker/ Wind, Waves, Swell, Swell period, Depth
│  └─ MapTogglesComponent          layer-picker/ Particles, Spots
├─ UnitsPopoverComponent           settings/     container · height, speed, temperature units
├─ AboutPopoverComponent           about/        the score, data sources, safety note
│  └─ AboutContentComponent        about/        @defer, loaded on first open
├─ LegendComponent                 legend/       unit and colour cells for the active layer
├─ TimelineComponent               timeline/     container · ARIA slider, play, Now
├─ LoadingOverlayComponent         shell/        first load only
└─ NotificationToastComponent      shell/        stale forecast, error with Retry, rate limit
```

**Containers** (marked above) inject the stores and pass plain values down; everything else takes
`input()`s and reports through `output()`s. Rules that are worth testing on their own live in plain
functions next to the components that use them:

| File                             | What it decides                                                     |
| -------------------------------- | ------------------------------------------------------------------- |
| `shell/forecast-notice.ts`       | which notice the forecast's status calls for                        |
| `shell/keyboard-shortcuts.ts`    | which app-wide shortcut a key press asks for, and when to ignore it |
| `shell/narrow-viewport.ts`       | whether the app opened on a phone (panels start folded)             |
| `spot-detail/condition-cells.ts` | the conditions grid's readings in the user's units                  |
| `spot-detail/hazard-messages.ts` | what each hazard warning says                                       |
| `spot-detail/score-trend.ts`     | the chart's bars, night bands, surf line and days; a daily summary  |
| `timeline/timeline-geometry.ts`  | pointer position ↔ hour, and the slider's keys                      |

## How the pieces talk

- **Stores, not events, connect the panels.** Selecting a spot (a ranking row, a map pin or a shared
  link) sets `MapUiStore.selectedSpotId`; the shell swaps the ranking for the details, the map flies
  there, and the back button or Escape clears it. Hovering works the same way through
  `MapUiStore.hoveredSpotId`, so a row lights up its pin and a pin its row.
- **Units are pipes and plain functions over `domain/units`.** `SettingsStore.units` flows into the
  templates; nothing formats a number itself, so the ranking, the details, the legend and the map's
  pins and readout always agree.
- **Popovers are native.** The Units and About buttons use `popovertarget`; the browser puts the
  popover in the top layer, closes it on Escape or an outside click, keeps one open at a time and
  sets `aria-expanded`. `PopoverComponent` (in `shared/`) follows its `beforetoggle` events, so the
  About text can load on first open and the shell can leave Escape to an open popover.
- **Two `@defer` blocks** keep the spot details and the About text out of the initial bundle. Both
  prefetch when the browser is idle, so they are ready by the time anyone opens them.

## Keyboard

| Key                 | Where                     | Does                                     |
| ------------------- | ------------------------- | ---------------------------------------- |
| ← / →               | anywhere but a text field | step the timeline an hour                |
| Space               | anywhere but a control    | play or pause                            |
| Escape              | anywhere                  | close the open popover, else the details |
| ← → ↑ ↓, Home, End  | timeline slider           | step an hour, go to either end           |
| Page Up / Page Down | timeline slider           | move a day                               |
| ← → ↑ ↓, Home, End  | region and unit choices   | move the selection (radio groups)        |

**May import:** `domain/`, `state/`, `shared/`, plus config tokens from `core/`.

**Must not import:** `data/` (go through a store instead) or `map/`. The root `App` component puts the map
and the feature shell side by side, so neither layer needs the other.

**Tests:** specs sit next to the components and render them with `TestBed` against the recorded
forecast (`src/testing/`), driving them through the DOM: clicks, keys, pointer drags (with
`testing/pointer.ts`, since jsdom lays nothing out) and native popovers (with
`testing/fake-popover.ts`, since jsdom has no Popover API). Coverage below 85% fails
`npm run test:ci`; Playwright covers layout, real pointer input and the browser's popovers
(`e2e/`).
