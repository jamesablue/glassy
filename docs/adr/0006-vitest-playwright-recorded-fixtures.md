# ADR-0006: Vitest and Playwright with recorded fixtures, visual regression in a Linux container

- **Status:** Accepted
- **Date:** 2026-10-18 (unit tests and fixtures, [#20](https://github.com/jamesablue/glassy/pull/20)
  and [#21](https://github.com/jamesablue/glassy/pull/21)); extended 2026-10-19 with visual
  regression ([#27](https://github.com/jamesablue/glassy/pull/27))
- **Deciders:** James Blue

## Context and problem

The forecast changes every hour, so a test against the live APIs would see different scores,
rankings and texts on every run, and fail whenever a service was slow or down. The scoring model
had to come across from the prototype unchanged, which needs a fixed input to compare against.
Some behavior only shows in a real browser: canvas drawing, layout, pointer input, popovers.
Screenshots depend on the fonts installed, which differ between a Mac and a CI runner.

## Decision drivers

- The same result on every run, offline.
- Fast unit tests for the domain, with coverage floors per layer.
- End-to-end tests against the files that ship.
- One recording shared by every level, so all tests describe the same forecast.
- Visual baselines that are stable in CI.

## Considered options

- **Unit runner:** Vitest through Angular's `@angular/build:unit-test` builder (the Angular 22
  default), Jest, or Karma with Jasmine.
- **Browser tests:** Playwright or Cypress.
- **Network:** live APIs, hand-written mocks, or responses recorded once from the real APIs.
- **Visual baselines:** taken on a developer's machine, in the Playwright Linux image through
  Docker, or in a hosted service.

## Decision

- **Vitest** in jsdom for unit and component tests, with per-layer coverage floors in
  `vitest-base.config.mts` (domain 95%; data, state and shared 90%; features 85%; map 80%).
- **One recording** made by `npm run fixtures:record` from the live APIs: the four Open-Meteo
  responses (cut to 48 hours) and three NOAA lookups, with the exact URLs in a manifest. The app
  and the recorder build requests with the same function, so the URLs match. The golden test's
  expected scores come from a verbatim copy of the prototype's code (`npm run fixtures:expected`).
- **Playwright** in Chromium, as a desktop and as a Pixel 7. Every spec takes `test` from
  `e2e/support/test.ts`, whose automatic fixture serves the recording, answers tiles with a blank
  image, aborts any other outside request and pins the clock to 8:30 AM on the recording's first day.
  An ESLint rule rejects importing `test` from `@playwright/test` in a spec. In CI the tests run
  against the production build, in two shards.
- **axe** in Playwright on nine states, failing on any WCAG 2.0 to 2.2 A or AA violation.
- **Visual regression** in the `mcr.microsoft.com/playwright` image for the installed version, both
  in CI and locally through `npm run e2e:visual`.

## Consequences

**Good**

- 1,059 unit tests in 112 files, 104 end-to-end tests across the two devices and 5 screenshot
  comparisons, all offline and repeatable. Coverage is 99% of statements overall.
- The golden test shows the port is faithful: all 1,200 spot-hours match the prototype exactly, and
  the end-to-end ranking is checked against the same expected file.
- The adapter's fixture test fails if the app's request URLs drift from the recording, so a change
  to the requests cannot silently leave the mocks behind.
- Baselines taken in the Playwright image passed in CI on the first run.
- CI runs the checks as parallel jobs in about two and a half minutes.

**Bad**

- The recording ages. Refreshing it moves the dates, so the pinned clock, the expected texts and
  the screenshot baselines need updating with it.
- jsdom has no layout, canvas or Popover API, so there are test helpers for canvases, pointers,
  popovers and dialogs, and the map's coverage floor is lower; Playwright covers the rest.
- Screenshots need Docker locally (or the manual **Update screenshots** workflow), and a Playwright
  upgrade can change text rendering enough to need new baselines.
- Only Chromium is tested.

## Alternatives considered

- **Karma and Jasmine.** Karma is deprecated, and Vitest is what Angular 22 sets up.
- **Jest.** Works, but would mean a separate setup outside the Angular builder.
- **Cypress.** Capable, but Playwright's `page.route`, `page.clock`, device emulation, sharding and
  first-class Docker images fit this suite better.
- **Hand-written mocks.** Quicker to start, but they drift from what the APIs really send. A
  recording also gives the golden test real data.
- **Hosted visual testing.** Handles fonts and review, but it is another account and service for
  five screenshots.
