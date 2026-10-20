# features

The user interface that floats over the map: the side panel, the timeline, the map controls, the
legend, the popovers and the notices.

## Component inventory

```
AppShellComponent                  shell/        container · layout, landmarks, app-wide keys
├─ BrandBadgeComponent             shell/        logo, name, tagline (hidden on phones)
├─ PanelComponent (shared)         the side panel card, the "Snorkel spots" landmark
│  ├─ SpotRankingPanelComponent    spot-ranking/ container · header, fold, list
│  │  ├─ RegionFilterComponent     spot-ranking/ All / North / Windward / South / West
│  │  └─ SpotRankingRowComponent   spot-ranking/ rank, name, surf, wind, score pill
│  └─ SpotDetailPanelComponent     spot-detail/  container · @defer, loaded on first open
│     ├─ HazardNoticeComponent     spot-detail/  big surf, onshore wind, current
│     ├─ ConditionsGridComponent   spot-detail/  surf, wind, swells, water, current, tide, rain
│     ├─ ScoreTrendChartComponent  spot-detail/  SVG bars, surf line, days, marker; a slider over the hours
│     └─ BestWindowComponent       spot-detail/  "Best daylight window: Sat 9 AM–12 PM · …"
├─ LayerMenuComponent              layer-picker/ container · the right-hand menu
│  ├─ LayerPickerComponent         layer-picker/ Wind, Waves, Swell, Swell period, Depth
│  └─ MapTogglesComponent          layer-picker/ Particles, Spots
├─ UnitsPopoverComponent           settings/     container · height, speed, temperature units
├─ AboutPopoverComponent           about/        the score, data sources, safety note
│  └─ AboutContentComponent        about/        @defer, loaded on first open
├─ LegendComponent                 legend/       unit and colour cells for the active layer
├─ TimelineComponent               timeline/     container · ARIA slider, play, Now
├─ StatusMessagesComponent         shell/        container · one status message at a time
│  ├─ LoadingOverlayComponent      shell/        first load only, until the spot forecast arrives
│  ├─ MapLayersChipComponent       shell/        "Loading map layers…" while the map grid follows
│  ├─ LoadErrorComponent           shell/        modal dialog: first load failed, nothing cached; Retry
│  └─ NotificationToastComponent   shell/        refreshing, stale, offline, error with Retry, map tiles
└─ HourAnnouncerComponent          shell/        container · polite live region: the new hour and best spot
```

**Containers** (marked above) inject the stores and pass plain values down; everything else takes
`input()`s and reports through `output()`s. Rules that are worth testing on their own live in plain
functions next to the components that use them:

| File                             | What it decides                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `shell/notices.ts`               | what the toast and the load error screen say, and when the map layers chip shows |
| `shell/announcement-throttle.ts` | how far apart live region announcements go out                                   |
| `shell/keyboard-shortcuts.ts`    | which app-wide shortcut a key press asks for, and when to ignore it              |
| `shell/narrow-viewport.ts`       | whether the app opened on a phone (panels start folded)                          |
| `spot-detail/condition-cells.ts` | the conditions grid's readings in the user's units                               |
| `spot-detail/hazard-messages.ts` | what each hazard warning says                                                    |
| `spot-detail/score-trend.ts`     | the chart's bars, night bands, surf line and days; a daily summary               |
| `timeline/timeline-geometry.ts`  | pointer position ↔ hour, and the slider's keys                                   |

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
  sets `aria-expanded`; focus starts on the popover's first control and goes back to the button when
  it closes. `PopoverComponent` (in `shared/`) follows its `beforetoggle` events, so the About text
  can load on first open and the shell can leave Escape to an open popover.
- **What the app says about itself goes through one place.** `StatusMessagesComponent` reads the
  forecast's state, the connection (`ConnectivityStore`) and the problems reported through
  `AppNotices` in `core/` (the error handler and the map's tile layers) and shows one thing at a
  time; `notices.ts` decides what each says.
- **Two `@defer` blocks** keep the spot details and the About text out of the initial bundle. Both
  prefetch when the browser is idle, so they are ready by the time anyone opens them.

## States

| State                                     | What shows                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| First load                                | the loading overlay (a polite status); the ranking says spots appear once the forecast loads                                        |
| First load, spot forecast in, grid not    | the ranking, details, pins and timeline work; the map draws no colours or particles; a "Loading map layers…" chip (a polite status) |
| First load, the grid failed               | the same, without the chip; a polite toast: "Map overlay unavailable right now. The spot forecast still works."                     |
| First load failed, nothing cached         | the load error screen: a modal dialog with Retry; the rate limit and offline have their own words; Escape leaves a toast with Retry |
| Older forecast cached, being refreshed    | the cached forecast at once, with "Data from …" under the ranking's header and a "Refreshing the forecast…" status                  |
| Refresh under way                         | the forecast stays on show; a "Refreshing the forecast…" status                                                                     |
| Refresh failed, older forecast cached     | a polite toast with its age, and "Data from …" under the ranking's header while it is on show                                       |
| Refresh failed, nothing older             | the forecast stays on show; an alert toast with Retry                                                                               |
| Offline                                   | a notice; the forecast reloads by itself when the browser is back online                                                            |
| A region with no spots                    | "No spots in this region" with a button back to all of them                                                                         |
| Map tiles failing, or an unexpected error | one polite toast (at most one a minute of each kind), with no details on screen                                                     |

## Accessibility

- **Landmarks and order.** The page goes banner (brand), "Snorkel spots" (the side panel), "Map
  controls" (navigation), "Map colours" (the legend), "Forecast timeline", then the map, which is
  the `main` landmark; the shell comes before the map in the page, so Tab follows the same order.
- **Live regions.** The hour announcer tells screen readers the new hour and the best spot when the
  hour changes (at most one a second when moved by hand, one every five seconds while playing).
  Toasts are polite statuses, or alerts when they need an answer.
- **The chart** is a slider over the hours whose value reads "Mon 12 PM: score 7.4, Good; surf 2–3
  ft", with a description and a day-by-day table for screen readers.
- **Every control has a focus ring**, and every colour pair meets WCAG AA: text on the rating
  colours, the legend's black or white labels (`inkFor` in `domain/color`), the muted text.
- **Reduced motion** turns off the chevron and map transitions; nothing in the panels animates
  otherwise, and playback never starts by itself.
- **Small and zoomed screens.** At 320 px wide or 200% zoom nothing scrolls sideways: the layer menu
  shrinks (and scrolls if it must) on short screens, and the depth legend tightens on narrow ones.

## Keyboard

| Key                 | Where                     | Does                                                             |
| ------------------- | ------------------------- | ---------------------------------------------------------------- |
| ← / →               | anywhere but a text field | step the timeline an hour                                        |
| Space               | anywhere but a control    | play or pause                                                    |
| Escape              | anywhere                  | close the open popover, else the point readout, else the details |
| ← → ↑ ↓, Home, End  | timeline slider, chart    | step an hour, go to either end                                   |
| Page Up / Page Down | timeline slider, chart    | move a day                                                       |
| ← → ↑ ↓, Home, End  | region and unit choices   | move the selection (radio groups)                                |
| ← → ↑ ↓, + −, Enter | the map                   | pan, zoom, show the forecast at the middle (see `map/`)          |

**May import:** `domain/`, `state/`, `shared/`, plus tokens and `AppNotices` from `core/`.

**Must not import:** `data/` (go through a store instead) or `map/`. The root `App` component puts the map
and the feature shell side by side, so neither layer needs the other.

**Tests:** specs sit next to the components and render them with `TestBed` against the recorded
forecast (`src/testing/`), driving them through the DOM: clicks, keys, pointer drags (with
`testing/pointer.ts`, since jsdom lays nothing out), native popovers and modal dialogs (with
`testing/fake-popover.ts` and `testing/fake-dialog.ts`, since jsdom has neither API). Coverage below 85% fails
`npm run test:ci`; Playwright covers layout, real pointer input and the browser's popovers
(`e2e/`).
