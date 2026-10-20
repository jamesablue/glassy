# ADR-0009: The native Popover API instead of CDK Overlay

- **Status:** Accepted
- **Date:** 2026-10-19 (implemented in [#25](https://github.com/jamesablue/glassy/pull/25))
- **Deciders:** James Blue

## Context and problem

The layer menu opens two small panels: **Units** (height, speed and temperature) and **About** (how
the score works, the data sources, a safety note). They are non-modal: the map stays usable, Escape
or a click outside closes them, and only one is open at a time. They must sit above Leaflet's panes
and controls, and work from the keyboard and with screen readers.

The plan was to build them on Angular CDK Overlay with focus handling.

## Decision drivers

- Correct accessibility for a non-modal popover: Escape, light dismiss, `aria-expanded`, focus
  moving in and coming back.
- Bundle size, with the initial budget already tight.
- Stacking above the map without z-index fights.
- As little custom code as possible.

## Considered options

1. `@angular/cdk` Overlay, with a focus trap.
2. The browser's Popover API: `popover="auto"` on the panel and `popovertarget` on its button.
3. A hand-rolled positioned `div` with its own key and click handling.

## Decision

Option 2. `PopoverComponent` in `shared/ui/` wraps a native `popover="auto"` element. The browser
puts it in the top layer, closes it on Escape or an outside click, keeps one open at a time, sets
`aria-expanded` on the button and returns focus to it on close. The component moves focus to the
first control when the popover opens, and the About text loads with `@defer` on first open.

## Consequences

**Good**

- No CDK in the bundle, and almost no code: the browser does the dismissal, stacking and ARIA state.
- The top layer is above everything, including Leaflet's panes, with no z-index tuning.
- No focus trap, which is the right pattern for a non-modal panel: Tab can leave it.
- axe reports no violations on either popover, and the keyboard spec checks that focus goes in on
  open and back to the button on close.

**Bad**

- It needs a browser with the Popover API (Baseline since 2024). In an older browser the buttons do
  nothing.
- jsdom has no Popover API, so component tests use a small fake (`src/testing/fake-popover.ts`)
  and the real behavior is checked in Playwright.
- Event timing needs care. The component follows `beforetoggle`, not `toggle`, which arrives a task
  later: with `toggle`, an Escape pressed in between also closed the spot details. The end-to-end
  suite caught it, and the shell now leaves Escape to an open popover first.
- Placement is fixed CSS (`--popover-top`, `--popover-right`, `--popover-width`) beside the menu,
  with no collision handling.

## Alternatives considered

- **CDK Overlay.** Mature positioning and scroll strategies, but more bundle and setup for two
  panels whose placement never changes, and its focus trap suits dialogs rather than popovers.
- **A hand-rolled panel.** No dependency, but it would reimplement light dismiss, Escape, one open
  at a time and stacking, which is the code most likely to be subtly wrong.
