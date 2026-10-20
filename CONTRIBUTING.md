# Contributing

Thanks for helping with Glassy. This page covers setting up, the conventions the repository follows
and what a pull request needs before it can merge.

## Setup

You need Node 24 (see `.nvmrc`) and, for the screenshot tests only, Docker.

```sh
nvm use
npm ci
npm start          # http://localhost:4200
```

`npm ci` also installs a pre-commit hook (Husky and lint-staged) that lints and formats the files
you stage.

## Scripts

| Script                      | What it does                                                    |
| --------------------------- | --------------------------------------------------------------- |
| `npm start`                 | Dev server                                                      |
| `npm run build`             | Production build, checked against the bundle budgets            |
| `npm test`                  | Unit and component tests (Vitest), single run                   |
| `npm run test:ci`           | The same with coverage, failing below each layer's floor        |
| `npm run lint`              | ESLint, including the layer import boundaries                   |
| `npm run typecheck`         | TypeScript for the app, unit tests, e2e tests and scripts       |
| `npm run format:check`      | Prettier check (`npm run format` fixes)                         |
| `npm run e2e`               | Playwright end-to-end tests against the dev server              |
| `npm run e2e:visual`        | Screenshot comparisons, in the Playwright Linux image (Docker)  |
| `npm run e2e:visual:update` | Takes new screenshot baselines the same way                     |
| `npm run fixtures:record`   | Records the forecast fixtures again from the live APIs          |
| `npm run fixtures:expected` | Scores the recorded fixtures with the original prototype's code |
| `npm run docs:screenshots`  | Builds the app and captures the README images in `docs/images/` |

The CDK app in `infra/` is a separate package with its own `npm ci`, `npm test` and `npm run synth`.

## Branches and commits

- Work on a branch named after its issue: `feat/<issue>-<slug>`, for example `feat/8-ci-hardening`
  (`fix/`, `docs/` and `chore/` work the same way).
- Write commits as [Conventional Commits](https://www.conventionalcommits.org): `feat(map): …`,
  `fix(state): …`, `test(e2e): …`, `docs: …`, `ci: …`, `chore(deps): …`. Use the layer or area as
  the scope where it helps.
- Open a pull request against `main` using the template, and link the issue with `Closes #<n>`.
  Pull requests are squash-merged once CI is green.
- `main` is protected. A pull request needs these checks to pass: `Quality`, `Unit tests`, `Build`,
  `E2E`, `Infrastructure (CDK)`, `Lint workflows`, `Analyze (javascript-typescript)` and
  `Dependency review`. It must also be up to date with `main`, and history stays linear, so rebase
  on `main` (`git fetch origin && git rebase origin/main`) rather than merging it in.

## Tests

Every change comes with tests at the level where it can break; [docs/testing.md](docs/testing.md)
describes each level. In short:

- Logic in `domain/`, `data/` and `state/` gets unit tests. `npm run test:ci` holds each layer to
  a coverage floor (`domain/` 95%, `data/`, `state/` and `shared/` 90%, `features/` 85%, `map/` 80%).
- UI changes get component tests, and an end-to-end test when they change a user flow.
- End-to-end tests import `test` and `expect` from `e2e/support/test.ts`, which serves the recorded
  network, so they never call a live service. See [e2e/README.md](e2e/README.md).
- New UI must work from the keyboard and pass the axe checks in `e2e/a11y.spec.ts`.
- If a change alters the look on purpose, take new screenshot baselines with
  `npm run e2e:visual:update` and commit them with the change.

Before pushing, run `npm run lint`, `npm run typecheck`, `npm run test:ci` and `npm run e2e`.

## Fixtures

The unit, golden and end-to-end tests share one recorded forecast in `src/testing/fixtures/`.
Record it again when the requests change (the adapter's fixture test fails when the configuration or
the spot catalog no longer matches the recording):

```sh
npm run fixtures:record    # needs network access to Open-Meteo and NOAA
npm run fixtures:expected  # re-scores the new data with the prototype's code
```

Commit the rewritten files together. A new recording moves the forecast's dates, so update the
pinned clock in `e2e/support/clock.ts` and the hours and texts the tests expect, and take new
screenshot baselines. [src/testing/fixtures/README.md](src/testing/fixtures/README.md) has the
details.

## Security

Please report vulnerabilities privately, as [SECURITY.md](SECURITY.md) describes.
