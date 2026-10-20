# End-to-end tests

Playwright tests that drive the real app in Chromium, on a desktop (`chromium` project) and a
Pixel 7 (`mobile` project), with the network replaced by recorded responses. They give the same
result on every run and need no internet.

```sh
npm run e2e                                # against ng serve (started for you, or reused)
npx playwright test e2e/timeline.spec.ts   # one file
npx playwright test --ui                   # watch and step through tests
CI=1 npm run e2e                           # as CI runs it: against dist/ (npm run build first)
npm run e2e:visual                         # the screenshot comparisons, in Docker
```

## Specs

| Spec                     | Covers                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `app-shell.spec.ts`      | Brand and tagline, unknown paths sent back to the map                                                         |
| `timeline.spec.ts`       | Opening hour and ranking, scrubbing, keyboard steps, play and Now                                             |
| `spot-detail.spec.ts`    | Opening a spot from the ranking, conditions, chart, Back and Escape                                           |
| `map.spec.ts`            | Pins, selecting from a pin or the keyboard, point readout, NOAA tiles                                         |
| `controls.spec.ts`       | Layers and legend, Spots toggle, Units and About popovers, a full visit                                       |
| `shared-link.spec.ts`    | Restoring spot, layer and hour from the URL, and the URL following along                                      |
| `states.spec.ts`         | Load errors and Retry, rate limit, stale cache, offline, tile failures                                        |
| `slow-forecast.spec.ts`  | A late or failing map grid, a request that hangs past its timeout, a stale cache refreshing in the background |
| `mobile.spec.ts`         | The phone layout (mobile project only)                                                                        |
| `keyboard.spec.ts`       | Focus order, keyboard use of rows, chart, popovers and map (desktop only)                                     |
| `reduced-motion.spec.ts` | Particles, map flights and transitions with and without reduced motion                                        |
| `a11y.spec.ts`           | axe (WCAG 2.2 AA) on every main view and state                                                                |
| `visual.spec.ts`         | Screenshot comparisons (the `visual` project, see below)                                                      |

## Support utilities (`support/`)

| File                   | What it gives a spec                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test.ts`              | `test` and `expect` for every spec. An automatic fixture runs `serveOffline` before each test. ESLint rejects importing them from `@playwright/test` in a spec, so no spec can skip it.                                                                               |
| `offline.ts`           | `serveOffline`: blocks every host but `localhost`, then adds the routes below and pins the clock.                                                                                                                                                                     |
| `recorded-forecast.ts` | Answers Open-Meteo requests with the recorded responses, matched by exact URL; any other Open-Meteo URL gets a 404.                                                                                                                                                   |
| `map-sources.ts`       | Blank 1 × 1 PNGs for Esri and NOAA tiles; recorded NOAA depth lookups, with the Hanauma Bay answer for any point not recorded.                                                                                                                                        |
| `clock.ts`             | `startAtRecordedMorning`: the browser clock starts at 8:30 AM on the recording's first day (hour 8), then runs normally.                                                                                                                                              |
| `states.ts`            | `failForecastRequests` (500 or 429 until recovered), `holdForecastRequest` (one request held until released: a slow or hung service), `cacheForecastAndComeBackLater` (a cached forecast two hours old) and `showStaleForecast` (the same, with the refresh failing). |
| `glassy.ts`            | Locators and steps in the app's own terms: `ranking`, `rankingRow`, `spotPin`, `menuButton`, `timeline`, `waitForForecast` (pins and map grid), `tapOpenSea`, `expectedRanking`, `appErrors` and more.                                                                |
| `axe.ts`               | `expectNoAxeViolations`: WCAG 2.0 to 2.2 A and AA plus best practices, with the one documented exception for overlapping map pins.                                                                                                                                    |
| `serve-build.mts`      | The static server for `dist/` that replaces `ng serve` when `CI` (or `E2E_VISUAL`) is set. It falls back to `index.html` like the hosts do.                                                                                                                           |

Prefer the helpers in `glassy.ts` to raw selectors, and add one there when a locator or step is
needed in more than one spec. Find things by role and accessible name, as a screen reader would.

## How the network is mocked

`serveOffline` registers its routes before the page loads anything:

1. A catch-all that aborts every request to a host other than `localhost`. Playwright asks the
   newest route first, so this one only sees what the routes below leave alone, and a request
   nobody recorded fails loudly instead of reaching a live service.
2. Open-Meteo (`marine-api.open-meteo.com`, `api.open-meteo.com`): the four responses in
   `src/testing/fixtures/raw/`, looked up by the exact URL in `manifest.json`. These URLs are built
   with the app's own request builder, so a change to the requests shows up as 404s here (and as a
   failing adapter fixture test).
3. NOAA `identify` (depth at a point): the recorded answers, by URL.
4. Esri and NOAA `exportImage` tiles: a transparent PNG, so the map stays the same from run to run.
5. The clock, pinned inside the recorded forecast, so "now", the opening hour and the ranking never
   depend on the day the tests run.

A test can add its own route afterwards to change one answer; being newer, it is asked first. See
`failForecastRequests`, or `states.spec.ts` for failing tiles and depth lookups.

**Slow requests.** `holdForecastRequest` keeps one forecast request pending until the test releases
it. Rather than sleep, a test moves the page's clock on with `page.clock.fastForward(ms)`: the app's
retry waits and its 25 s request timeout run on that clock, so `slow-forecast.spec.ts` can show a
grid answering after 20 s, or a request hanging past its timeout, in a few seconds of real time.

## Adding or updating a fixture

- **A new request the app makes** (another API, another variable): add it to
  `scripts/record-fixtures.ts`, run `npm run fixtures:record` and serve the new file from a route in
  `support/`, matched by its URL in `manifest.json`.
- **Fresh data**: `npm run fixtures:record` then `npm run fixtures:expected`. The recording moves to
  new dates, so update `RECORDED_MORNING` in `support/clock.ts` and the hours and texts the specs
  expect (for example `Sun 8 AM`), and take new screenshot baselines.
- **An error or edge case**: do not record it. Fulfil the route in the test with the status and body
  you need, as `failForecastRequests` does.

`src/testing/fixtures/README.md` lists every recorded file and what uses it.

## Visual regression

`visual.spec.ts` compares five views with baselines in `visual.spec.ts-snapshots/`: the ranking,
Hanauma Bay's details, the depth layer, the Units popover and the ranking on a phone. The usual
offline setup keeps the data, clock and tiles fixed, and the `visual` project turns on reduced motion,
so there are no particles or map flights. A difference above 1% of the pixels fails.

The app uses system fonts, so a screenshot depends on the fonts installed. The baselines are taken
in the Playwright Linux image (`mcr.microsoft.com/playwright:v<version>-noble`, linux/amd64) and
only compared there:

- the `visual` project exists only when `E2E_VISUAL` is set, so `npm run e2e` never runs it;
- `npm run e2e:visual` builds the app and runs the project in that image through Docker;
- CI's `E2E visual` job runs it in the same image, picked by the installed Playwright version.

To update the baselines after an intended change:

```sh
npm run e2e:visual:update   # rewrites visual.spec.ts-snapshots/*-linux.png
```

Look at the new images before committing them. Without Docker, run the **Update screenshots**
workflow on your branch (Actions tab) and commit the PNGs from its `visual-baselines` artifact.
When the CI job fails, the `playwright-report` artifact shows the expected, actual and diff images.

A Playwright update brings a new Chromium, which can change how text renders; if `E2E visual` fails
on a Dependabot pull request, take new baselines on that branch.

## In CI

The `E2E shard 1/2` and `E2E shard 2/2` jobs split the functional suites, and `E2E visual` runs the
screenshots, all against the production build from the `Build` job. Each failing test is retried
once, with a trace recorded on the retry. The `E2E` job merges their blob reports into one HTML
report (the `playwright-report` artifact; open it with `npx playwright show-report <folder>`) and
passes only when all three passed. See [docs/testing.md](../docs/testing.md).
