# ADR-0010: A backend forecast snapshot; the browser makes no weather API calls

- **Status:** Accepted. Supersedes [ADR-0001](0001-static-spa-no-backend.md).
- **Date:** 2026-10-23 ([#36](https://github.com/jamesablue/glassy/issues/36))
- **Deciders:** James Blue

## Context and problem

Every visitor's browser sends the same four Open-Meteo requests: marine and wind for the 165-point
map grid, and marine and weather for the 25 spots
([ADR-0001](0001-static-spa-no-backend.md)). That has four costs:

- **Terms.** Open-Meteo's free tier is for non-commercial use only. A paid plan needs an API key,
  and a browser cannot hide one.
- **Size.** Every visitor downloads the raw responses: about 730 kB of JSON for 48 hours in the
  recording, before compression, and more for the five days the app shows.
- **Reliability.** First load depends on four third-party requests succeeding.
- **Fairness.** Upstream traffic grows with our traffic, on a free service.

Open-Meteo also weights each request by its size. In its own words, "Requests for data covering more
than 10 weather variables or extending over a period of more than 2 weeks for a single location are
considered multiple API calls". Each location in a multi-location request counts separately
([maintainer, open-meteo#438](https://github.com/open-meteo/open-meteo/issues/438); the
[weighting post](https://openmeteo.substack.com/p/weather-data-for-multiple-locations) gives
`locations × days/14 × variables/10`, each factor at least 1). One forecast load is therefore not 4
calls:

| Request      | Locations | Variables | Weight per location | Calls     |
| ------------ | --------- | --------- | ------------------- | --------- |
| Grid marine  | 165       | 6         | 1                   | 165       |
| Grid wind    | 165       | 2         | 1                   | 165       |
| Spot marine  | 25        | 13        | 1.3                 | 32.5      |
| Spot weather | 25        | 5         | 1                   | 25        |
| **Total**    |           |           |                     | **≈ 388** |

## Decision drivers

- Upstream traffic must not depend on how many people use Glassy.
- No secrets in the browser, so a paid plan stays possible.
- A small download, with one request, on a phone at the beach.
- The stale-cache behavior from [ADR-0005](0005-indexeddb-forecast-cache.md) keeps working.
- Development and tests need no AWS account.
- A running cost close to zero, inside the existing CDK stack and its tests.

## Considered options

Where the forecast comes from:

1. Keep calling Open-Meteo from the browser.
2. A CloudFront caching proxy in front of Open-Meteo ([#37](https://github.com/jamesablue/glassy/issues/37)).
3. A scheduled ingest: a Lambda fetches the forecast and writes one snapshot file to S3, served by
   the existing CloudFront distribution.
4. A Cloudflare Worker on a cron, storing the snapshot in KV or R2.

How the GitHub Pages demo gets it:

- A. Read the snapshot from the AWS CloudFront domain, over CORS.
- B. A scheduled GitHub Action fetches the forecast and publishes the snapshot with Pages.
- C. Retire the Pages demo and keep only the AWS site.

## Decision

Options 3 and A.

- **The browser makes no weather API calls.** Open-Meteo is called only by the backend ingest. This
  is an architecture rule, not a performance tweak; it is listed in `CLAUDE.md`.
- **Scheduled ingest** ([#38](https://github.com/jamesablue/glassy/issues/38)). An EventBridge
  schedule runs a Lambda **every 3 hours**. The handler, `backend/src/lambda.ts`, is a thin wrapper
  around the ingest core and holds all the AWS code. It writes `forecast.json` to the site bucket
  with a short `Cache-Control`. A partial or failed run leaves the last good snapshot in place and
  raises a CloudWatch alarm. At about 388 calls a run, that is about 3,100 calls a day (31% of the
  free daily limit) and about 94,000 a month. Hourly would use 93% of the daily limit and leave no
  room to retry, and the upstream models only update every few hours.
- **One snapshot file** holds both the spot forecast and the map grid, for simplicity. Its
  encoding and fields are chosen in [#39](https://github.com/jamesablue/glassy/issues/39). It
  carries `formatVersion`, `fetchedAt` (when the ingest fetched the data), the catalog fingerprint
  and the grid spec. Scores are not precomputed.
- **No fallback to Open-Meteo.** The client tries its fresh IndexedDB copy, then the snapshot,
  then its stale copy (up to `cacheMaxStaleMs`, 12 hours), then shows an error. There is no
  `direct` mode. A snapshot older than 7 hours (one missed run, plus an hour), with an unknown
  version, or for another catalog counts as a failed refresh
  ([#40](https://github.com/jamesablue/glassy/issues/40)).
- **The Pages demo reads the snapshot from the CloudFront domain.** CloudFront sends
  `Access-Control-Allow-Origin: https://jamesablue.github.io` for `forecast.json`, so one ingest
  serves both sites ([#41](https://github.com/jamesablue/glassy/issues/41)).
- **Map tiles stay in the browser for now.** NOAA DEM and Esri tiles are not weather data; hosting
  them is tracked in [#43](https://github.com/jamesablue/glassy/issues/43).
- **Code ownership** ([#42](https://github.com/jamesablue/glassy/issues/42)). The Open-Meteo
  client, URLs and response types move to `backend/`. Only the contract is shared: snapshot types,
  format version and validation, grid spec and spot catalog, in a framework-free `shared/` module
  at the repository root with no Angular, AWS or Node-only imports. Scoring stays in the frontend.
- **Changing the contract.** Bump `formatVersion`, and ship a client that accepts both versions
  before deploying a backend that writes the new one. In the same way, the backend must be
  publishing snapshots before a client that reads them ships.

### Open-Meteo's terms

Checked on 2026-10-23 at [open-meteo.com/en/terms](https://open-meteo.com/en/terms),
[/en/licence](https://open-meteo.com/en/licence) and [/en/pricing](https://open-meteo.com/en/pricing).

- **Re-serving the data is allowed, with attribution.** "API data are offered under Attribution 4.0
  International (CC BY 4.0). You are free to share: copy and redistribute the material in any medium
  or format and adapt: remix, transform, and build upon the material." The terms do not forbid
  storing the data or calling the API from a server; they discuss server platforms directly ("If
  you are using providers like Vercel, Netlify, Render, or Google Sheets you might be rate-limited
  earlier then expected").
- **The free tier is non-commercial, and Glassy qualifies.** "You may only use the free API services
  for non-commercial purposes." Their examples of non-commercial use include "Private or non-profit
  websites or apps that do not have subscriptions or advertising"; of commercial use, "Websites or
  apps that have subscriptions or display advertisements" and "Commercial products or promotional
  activities". The limits are "Less than 10'000 API calls per day, 5'000 per hour and 600 per
  minute", and 300,000 a month (not yet enforced). "Rate limits are applied by IP addresses and
  application."
- **Attribution.** "You must give appropriate credit, provide a link to the licence, and indicate if
  changes were made." and "You must include a link next to any location Open-Meteo data are
  displayed". The map's attribution control and the About panel already link to open-meteo.com.
  Because the snapshot trims and rounds the data, #40 adds a link to the CC BY 4.0 licence and says
  the data was modified.
- **A paid plan becomes necessary** if Glassy shows ads, takes subscriptions or becomes part of a
  commercial product, or if the weighted calls approach the free limits. More islands
  ([#15](https://github.com/jamesablue/glassy/issues/15)) add about 330 calls a run for each grid of
  this size, and hourly runs or more variables or days add more. The cheapest plan (Standard,
  1 million calls a month) uses an API key on `customer-api.open-meteo.com`. The key would live
  with the Lambda, never in the browser, which this design makes possible.

### Local development and tests

Only deploying needs AWS. Everything else runs on a developer's machine:

| What                  | How it gets a forecast                                                                                               | Network               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Unit tests (app)      | Recorded fixtures, mocked `HttpClient`                                                                               | None                  |
| Unit tests (backend)  | Recorded fixtures; S3 mocked in the Lambda handler tests                                                             | None                  |
| End-to-end tests      | Playwright serves a recorded snapshot, with the clock fixed (`e2e/support/clock.ts`)                                 | None                  |
| CDK tests and cdk-nag | Synthesized template, as today                                                                                       | None                  |
| `npm start`           | `npm run ingest` fetches from Open-Meteo in Node and writes a git-ignored `forecast.json` that the dev server serves | Open-Meteo, from Node |

The rule is that the **browser** never calls Open-Meteo. The ingest running in Node on a
developer's machine is the backend code, run locally. A snapshot can also be built from the
recorded fixtures with no network, for the end-to-end tests (#42).

## Consequences

**Good**

- Upstream traffic is fixed at about 3,100 weighted calls a day, however many people visit.
- One small, compressed, cacheable download instead of four large responses from a third party.
- Open-Meteo leaves the Content-Security-Policy's `connect-src` (#40).
- An API key for a paid plan can be added without touching the browser.
- The scoring model has no framework code, so only the fetching moves; scoring stays where it is.

**Bad**

- There is now a service to run, monitor and pay for. Expected cost is **under $1 a month** at demo
  traffic, in us-east-1 list prices: about 240 Lambda runs of about 15 s at 512 MB (about
  1,800 GB-s, inside the free tier, and about $0.03 without it); EventBridge Scheduler, S3 writes and
  storage under $0.01; CloudFront inside its always-free 1 TB and 10 million requests; one
  CloudWatch alarm at $0.10 (free within the first ten); and a few cents of logs. #38 records the
  measured figure in `docs/deployment.md`.
- The forecast can be up to 3 hours behind Open-Meteo, plus up to 45 minutes in the client's
  fresh cache.
- The Pages demo depends on the AWS stack, which must stay deployed
  ([ADR-0007](0007-dual-hosting-pages-and-aws.md)). If it is down, visitors see their cached
  forecast for up to 12 hours, then an error.
- The Lambda calls Open-Meteo from shared AWS addresses, which Open-Meteo warns can be rate limited
  sooner. At 31% of the daily limit there is room for that, and for a retry.
- The snapshot contract is a second interface to version, with a deploy order to respect.

## Alternatives considered

- **Keep calling from the browser.** No service to run, but it fails every driver above, and a
  visitor's own address gets about 25 loads a day before the limit.
- **A CloudFront caching proxy (#37, closed).** A small infrastructure change, but upstream traffic
  still follows cache misses, so it still grows with traffic, and a cold cache still makes the
  first visitor wait on four upstream requests. The browser still downloads the raw responses and
  still depends on Open-Meteo's API shape.
- **A Cloudflare Worker.** Free at this scale, and Open-Meteo limits Workers per Cloudflare user
  rather than by shared address. But it is another platform and account outside the CDK stack and
  its tests, and the AWS site would serve the snapshot cross-origin from it.
- **A scheduled GitHub Action publishing to Pages.** No AWS dependency for the demo, but scheduled
  workflows run late or are skipped under load and stop after 60 days without repository activity.
  Every run would redeploy the site, and the AWS site would still need its own copy.
- **Retire the Pages demo.** One site to look after, but the demo URL would then cost money to
  keep up, and Pages is the deploy that runs on every merge to `main`.
