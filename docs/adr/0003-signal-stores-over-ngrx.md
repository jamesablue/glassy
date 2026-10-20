# ADR-0003: Signal stores instead of NgRx

- **Status:** Accepted
- **Date:** 2026-10-18 (implemented in [#22](https://github.com/jamesablue/glassy/pull/22))
- **Deciders:** James Blue

## Context and problem

Glassy's state is small: one forecast load, the selected hour and playback, the selected spot,
region and layer, a tapped point, and the user's units. Almost everything on screen is derived from
it: a score for every spot and hour, the ranking at the selected hour, the pins, the details and
chart, the legend. The app runs with zoneless change detection, and Angular 22 provides `signal`,
`computed`, `effect`, `linkedSignal` and `rxResource`.

The prototype kept all of this in two mutable objects and a hand-written `setTime()` that updated
everything. The port needed a state layer where each value has one owner and recomputes only when
its inputs change.

## Decision drivers

- Fine-grained recomputation: the score matrix once per forecast, not once per hour change.
- Little ceremony for a small state.
- Tests through a public API, with fake time and a fake repository.
- Works naturally with zoneless change detection and signal inputs.
- Bundle size.

## Considered options

1. Plain injectable stores: private writable signals, a read-only public surface of `asReadonly()`
   and `computed()` values, and methods named after what the user does.
2. NgRx Store with actions, reducers, selectors and effects.
3. NgRx SignalStore (`@ngrx/signals`).
4. Services holding RxJS `BehaviorSubject`s.

## Decision

Option 1. Eight small `providedIn: 'root'` services in `src/app/state/`: `ForecastStore`,
`ConnectivityStore`, `SettingsStore`, `MapUiStore`, `TimelineStore`, `ConditionsStore`,
`PointInspectionStore` and `UrlStateSync`. RxJS appears only where a store meets the repository or
the NOAA client, through `rxResource`. Business rules stay in `domain/`; the stores only choose
which inputs to give the domain functions.

## Consequences

**Good**

- No state library in the bundle, and no actions or reducers to write for a handful of values.
- Derivations are split by what they depend on. A test checks that the score matrix is the same
  object after the hour, region and selection change; moving the timeline re-assesses 25 spots
  for one hour, and the selected spot's trend is not recomputed at all.
- `rxResource` cancels a superseded load when the user retries, and registers a pending task, so
  `whenStable()` waits for the forecast in tests.
- One owner per value: `SettingsStore` owns the saved preferences and `MapUiStore` reads and writes
  the map's choices through it, so there are no copies to drift apart.
- Each store is tested through its public API with `TestBed`, a fixed `CLOCK` and fake timers:
  `state/` has 100% line coverage.

**Bad**

- No Redux DevTools or action log. Debugging means reading signals, not replaying actions.
- The conventions (private writable signals, read-only surface, rules in `domain/`) are kept by
  review and the layer README, not by a library.
- `effect()` ordering needs care where it matters. `UrlStateSync`, for example, writes nothing until
  it has read the opening URL, so a shared link is never overwritten before it is applied.

## Alternatives considered

- **NgRx Store.** Strong conventions and tooling, but for this much state it is mostly boilerplate,
  and selectors would duplicate what `computed` already does.
- **NgRx SignalStore.** Closest to what was built, with useful structure (`withState`,
  `withComputed`). It would be the next step if the state grew, for example with several islands or
  saved favorites, but today it would add a dependency for little gain.
- **`BehaviorSubject` services.** They need subscriptions, `async` pipes or manual change detection
  in a zoneless app, and derived values need `combineLatest` chains that recompute more than
  necessary.
