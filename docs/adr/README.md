# Architecture decision records

Each record explains one decision: the context, the drivers, the options considered, what was
chosen and what it costs. They follow the [MADR](https://adr.github.io/madr/) layout.

| ADR                                                 | Decision                                                                     | Status   | Date       |
| --------------------------------------------------- | ---------------------------------------------------------------------------- | -------- | ---------- |
| [0001](0001-static-spa-no-backend.md)               | A static SPA with no backend                                                 | Accepted | 2026-10-18 |
| [0002](0002-leaflet-with-canvas-renderers.md)       | Leaflet with custom canvas renderers, over MapLibre GL and ngx-leaflet       | Accepted | 2026-10-19 |
| [0003](0003-signal-stores-over-ngrx.md)             | Signal stores instead of NgRx                                                | Accepted | 2026-10-18 |
| [0004](0004-heuristic-surf-and-snorkel-score.md)    | A heuristic surf estimate and snorkel score, not Surfline data               | Accepted | 2026-10-18 |
| [0005](0005-indexeddb-forecast-cache.md)            | An IndexedDB forecast cache with a stale fallback and a catalog fingerprint  | Accepted | 2026-10-18 |
| [0006](0006-vitest-playwright-recorded-fixtures.md) | Vitest and Playwright on recorded fixtures, visual regression in a container | Accepted | 2026-10-18 |
| [0007](0007-dual-hosting-pages-and-aws.md)          | Dual hosting: GitHub Pages and AWS S3 + CloudFront through the CDK           | Accepted | 2026-10-18 |
| [0008](0008-url-state-without-the-router.md)        | URL state without the Angular router                                         | Accepted | 2026-10-19 |
| [0009](0009-native-popover-api.md)                  | The native Popover API instead of CDK Overlay                                | Accepted | 2026-10-19 |

## Writing a new one

Copy the newest record, number it next, and keep it to about a page:

- **Status**: Proposed, Accepted, or Superseded by ADR-NNNN.
- **Context and problem**: what forces the decision, in a few sentences.
- **Decision drivers**: what a good answer has to do.
- **Considered options**: the realistic choices, including doing nothing.
- **Decision**: what was chosen, specifically enough to check in the code.
- **Consequences**: the good and the bad, with numbers where there are any.
- **Alternatives considered**: why each other option lost.

A decision that changes gets a new record that supersedes the old one, rather than an edit.
