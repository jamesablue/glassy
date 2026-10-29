# Glassy documentation

| Document                                         | What it covers                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)               | System context, layers and their dependency rules, component tree, startup, hour changes, state, rendering |
| [scoring-model.md](scoring-model.md)             | The snorkel score: exposure, period factor, shelter, penalties, ratings, hazards, a worked example, limits |
| [testing.md](testing.md)                         | Test levels, coverage floors, the golden test, fixtures, accessibility, visual regression, CI              |
| [deployment.md](deployment.md)                   | GitHub Pages and AWS S3 + CloudFront runbooks                                                              |
| [buoy-swell-backtest.md](buoy-swell-backtest.md) | Open-Meteo waves against four NOAA buoys: where to read the model and who blocks the swell (#55)           |
| [adr/](adr/README.md)                            | Architecture decision records                                                                              |
| [images/](images/)                               | README screenshots, taken by `npm run docs:screenshots`                                                    |

Elsewhere in the repository:

- [README.md](../README.md): what Glassy is, getting started, scripts.
- [CONTRIBUTING.md](../CONTRIBUTING.md): setup, branches and commits, what a pull request needs.
- [SECURITY.md](../SECURITY.md): reporting a vulnerability.
- [e2e/README.md](../e2e/README.md): the end-to-end suite and its offline support code.
- [infra/README.md](../infra/README.md): the AWS CDK app and its runbook.
- [src/testing/fixtures/README.md](../src/testing/fixtures/README.md): the recorded forecast.
- Each layer's README in `src/app/` ([core](../src/app/core/README.md),
  [domain](../src/app/domain/README.md), [data](../src/app/data/README.md),
  [state](../src/app/state/README.md), [map](../src/app/map/README.md),
  [features](../src/app/features/README.md), [shared](../src/app/shared/README.md)): what lives there
  and what it may import.
