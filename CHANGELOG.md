# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-19

First public release: an Angular 22 rebuild of the original Glassy prototype, live at
<https://jamesablue.github.io/glassy/>.

### Added

- **Domain core** ([#20](https://github.com/jamesablue/glassy/pull/20)): framework-free scoring,
  grid sampling, palettes, units, Honolulu time helpers, label placement and the 25-spot Oahu
  catalog. A golden test proves the port matches the prototype on 1,200 recorded spot-hours.
- **Data layer** ([#21](https://github.com/jamesablue/glassy/pull/21)): Open-Meteo and NOAA
  clients, a typed adapter, an IndexedDB forecast cache and a repository with retries and typed
  errors.
- **Signal stores** ([#22](https://github.com/jamesablue/glassy/pull/22)): forecast, timeline,
  map UI, settings and conditions stores, plus shareable `?layer=&spot=&t=` URLs.
- **Map** ([#24](https://github.com/jamesablue/glassy/pull/24)): Leaflet host with terrain, depth,
  scalar-field and particle layers, accessible spot pins and a point inspector with depth.
- **Feature UI** ([#25](https://github.com/jamesablue/glassy/pull/25)): spot ranking, spot detail
  with hazards, a 5-day chart and best window, timeline with playback, layer picker, legend, and
  units and about popovers.
- **AWS infrastructure** ([#19](https://github.com/jamesablue/glassy/pull/19)): CDK stack for
  S3 + CloudFront with security headers, a GitHub OIDC deploy role and a manual deploy workflow.
- **GitHub Pages deployment** ([#31](https://github.com/jamesablue/glassy/pull/31)) after green CI
  on `main`.
- **Documentation** ([#33](https://github.com/jamesablue/glassy/pull/33)): README, architecture
  diagrams, scoring model, deployment guide and nine ADRs.

### Changed

- **Accessibility, resilience and performance pass**
  ([#26](https://github.com/jamesablue/glassy/pull/26)): zero axe violations, offline and error
  states, a global error handler, and URL state without the Angular router (about 60 kB smaller).
- **CI hardening** ([#27](https://github.com/jamesablue/glassy/pull/27)): parallel jobs, SHA-pinned
  actions, sharded E2E against the production build, visual regression, CodeQL, Dependabot and
  dependency review.
- **Slow-API resilience** ([#34](https://github.com/jamesablue/glassy/pull/34)): request timeouts,
  stale-while-revalidate, and progressive loading so the ranking renders before the map overlay.

### Fixed

- A cached forecast that no longer matches the spot catalog is discarded instead of crashing
  ([#23](https://github.com/jamesablue/glassy/issues/23)).

[1.0.0]: https://github.com/jamesablue/glassy/releases/tag/v1.0.0
