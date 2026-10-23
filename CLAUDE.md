# CLAUDE.md

Glassy is an Angular single-page app that shows where the snorkeling is good on Oahu, now and
later. Start with `docs/architecture.md`, the ADRs in `docs/adr/`, and `CONTRIBUTING.md`.

## Working agreement

- Don't write or change code until I've approved a plan. Start non-trivial work in plan mode.
- Work from a GitHub issue. Read it (`gh issue view <n>`) and any issues or ADRs it links before
  planning. If the work changes a decision, say so before coding, and record it on the issue.
- One issue per branch and pull request, following `CONTRIBUTING.md`: branch `feat/<issue>-<slug>`,
  Conventional Commits, `Closes #<n>` in the PR, squash-merged.
- Write in American English (color, behavior, serialize) in new code, docs, issues and PRs.

## Commands

| Task         | Command                                              |
| ------------ | ---------------------------------------------------- |
| Dev server   | `npm start`                                          |
| Unit tests   | `npm test` (`npm run test:ci` for coverage)          |
| Lint / types | `npm run lint`, `npm run typecheck`                  |
| End-to-end   | `npm run e2e` (`npm run e2e:visual` for screenshots) |
| Infra tests  | `npm test` in `infra/`                               |

Run lint, typecheck, unit and e2e tests before saying a change is done. Node version is in `.nvmrc`.

## Architecture rules

- **The browser makes no weather API calls.** Open-Meteo is called only by the backend ingest,
  which publishes one `forecast.json` snapshot every hour. The app reads that snapshot, and falls
  back only to its IndexedDB copy, never to Open-Meteo. (Decided in #36.)
- NOAA DEM and Esri map tiles are still loaded by the browser, for now (#43).
- Code ownership (#42):
  - `backend/`: the ingest and everything Open-Meteo (client, URLs, response types). AWS code
    stays in a thin Lambda handler.
  - `shared/` at the repository root (not `src/app/shared/`): only the snapshot contract: types,
    format version and validation, grid spec, spot catalog. No Angular, AWS or Node-only imports.
  - `src/app/`: the app, including scoring. It must not import from `backend/`.
- Changing the snapshot contract: bump the format version, and ship an app that accepts both
  versions before deploying a backend that writes the new one.
- Deploy order: the backend must be publishing snapshots before an app that reads them ships.
- `src/app/` layers and their import rules are enforced by ESLint; see `docs/architecture.md`.
- When the app starts or stops talking to an outside host, update
  `infra/lib/content-security-policy.ts`.

## Docs

Architecture decisions get an ADR in `docs/adr/`. Update `docs/architecture.md` and the layer
READMEs in `src/app/<layer>/` when behavior or structure changes.
