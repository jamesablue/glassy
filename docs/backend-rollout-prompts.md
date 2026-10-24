# Backend rollout: session prompts

Prompts for moving the forecast behind a backend ([#36](https://github.com/jamesablue/glassy/issues/36)),
one Claude Code session per issue, in this order. Start a fresh session for each prompt; the
session loads `CLAUDE.md` and reads the rest from the issues.

## Before you start

- `CLAUDE.md` is merged to `main` (#44).
- Begin each session in plan mode (Shift+Tab).

## Footer for every prompt

Append this to each prompt below:

```text
When the plan is approved and the work is done: run lint, typecheck and the tests that cover this
change; commit with Conventional Commits; push; open a PR using the template with Closes #<n>.
Then comment on the next issue in the order with anything it needs to know: decisions made, file
names, or surprises.
```

## 1. #36: ADR (docs only)

```text
Work on #36. Read it, ADR-0001, ADR-0005, ADR-0007, and docs/adr/README.md.
Plan in plan mode before writing anything.

- Write the new ADR as the next number in docs/adr/, in the existing ADR format.
- Check Open-Meteo's current terms of use on their website, and quote what the ADR relies on:
  re-serving the data, the non-commercial free tier, and attribution.
- Include how local development and tests work without AWS (see "Local development" below).
- Update ADR-0001 (superseded), ADR-0005 and ADR-0007, and the ADR index.
- Don't touch docs/architecture.md; #40 updates it.
Branch: docs/36-forecast-snapshot-adr
```

## 2. #42: backend package and shared contract

```text
Work on #42. Read it and the new ADR from #36. Plan in plan mode.

Before planning, look at how infra/ is set up as its own package, how scripts/record-fixtures.ts
imports from src/app, and how eslint.config.js enforces import boundaries; follow those patterns.

- Sequencing: the app still uses OpenMeteoClient until #40 ships. Moving the Open-Meteo code into
  backend/ now must not break the app. Propose how to handle that (for example, the app keeps its
  copy until #40 deletes it) and record the decision on #42 and #40.
- Local development: `npm run ingest` must be runnable from the repository root and able to write
  forecast.json to a git-ignored path the dev server can serve. Also add a way to build a snapshot
  from the recorded fixtures, with no network, for tests.
Branch: feat/42-backend-package
```

## 3. #39: snapshot format

```text
Work on #39. Read it, #42's merged code in backend/ and shared/, and
src/app/data/open-meteo/open-meteo.adapter.ts. Plan in plan mode.

- Measure first: the size of today's four responses vs. a trimmed JSON snapshot (raw and
  Brotli) and a binary version, for the five-day forecast. Show me the numbers before choosing.
- Types and validation go in shared/. The writer goes in backend/. The decoder that turns a
  snapshot into a ForecastBundle goes in src/app/data/.
- Record the measurements and the choice on #39.
Branch: feat/39-snapshot-format
```

## 4. #38: AWS Lambda ingest

```text
Work on #38. Read it, the ADR from #36, infra/README.md, and infra/lib/glassy-static-site-stack.ts
and constructs/. Plan in plan mode.

- Bundle backend/src/lambda.ts with NodejsFunction. Keep all AWS code in that handler.
- Unit-test the handler with a mocked S3 client; no AWS account needed.
- The CDK tests and cdk-nag must pass. Explain any cdk-nag suppression.
- Include a written monthly cost estimate and the deploy steps in infra/README.md and
  docs/deployment.md.
Branch: feat/38-lambda-ingest
```

## Checkpoint before #40

Deploy the stack by hand (`infra/README.md`), then check the snapshot is live:

```text
After #38's deploy: fetch https://<cloudfront-domain>/forecast.json, check that fetchedAt is less
than an hour old and the format version is right, and check that the CloudWatch alarm is in OK
state. Don't change anything.
```

**Don't start #40 until this passes**, or the live site loses its forecast.

## 5. #40: switch the frontend to the snapshot

```text
Work on #40. Read it, the ADR from #36, the comments on #40 from earlier sessions,
src/app/data/README.md and src/app/data/forecast.repository.ts. Plan in plan mode.

This touches the repository, config, error types, the CSP, e2e fixtures and docs. If the plan is
large, propose splitting it into two PRs (for example 1: snapshot loading and fallbacks,
2: removing dead code, the CSP and docs) and wait for my choice.

- Keep the stale-cache behavior from ADR-0005 working.
- Add the Playwright test that fails on any Open-Meteo request; e2e serves a recorded snapshot.
- Local development: `npm start` must work without AWS, reading the snapshot written by
  `npm run ingest`. Document the flow in CONTRIBUTING.md and src/app/data/README.md.
Branch: feat/40-client-snapshot
```

## 6. #41: GitHub Pages demo

```text
Work on #41. Read it, .github/workflows/deploy-pages.yml, the github-pages configuration in
angular.json, and how #40 set forecastSnapshotUrl. Plan in plan mode.

Confirm the CORS header from #38 is live by requesting forecast.json with
Origin: https://jamesablue.github.io before planning. After merge, check the live demo makes no
Open-Meteo requests.
Branch: feat/41-pages-snapshot
```

## Later: #43, map tiles

```text
Work on #43. Read it and the map/ and data/noaa/ READMEs. This is research and an ADR only, no
code. Compare the options in the issue, including cost and each provider's terms, and plan the
ADR in plan mode.
Branch: docs/43-map-tile-hosting
```

## Local development

Only deploying and the checkpoint above need AWS. Everything else runs on your machine:

| What                  | How it gets a forecast                                                                                               | Network               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Unit tests (app)      | Recorded fixtures, mocked `HttpClient`                                                                               | None                  |
| Unit tests (backend)  | Recorded fixtures; S3 mocked in the Lambda handler tests                                                             | None                  |
| End-to-end tests      | Playwright serves a recorded snapshot, with the clock fixed (`e2e/support/clock.ts`)                                 | None                  |
| CDK tests and cdk-nag | Synthesized template, as today                                                                                       | None                  |
| `npm start`           | `npm run ingest` fetches from Open-Meteo in Node and writes a git-ignored `forecast.json` that the dev server serves | Open-Meteo, from Node |

The rule is that the **browser** never calls Open-Meteo. The ingest script running in Node on a
developer's machine is the backend code, run locally.
