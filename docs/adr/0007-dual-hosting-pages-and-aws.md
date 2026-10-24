# ADR-0007: Dual hosting on GitHub Pages and AWS S3 + CloudFront

- **Status:** Accepted
- **Date:** 2026-10-18 (AWS stack in [#19](https://github.com/jamesablue/glassy/pull/19); Pages in
  [#11](https://github.com/jamesablue/glassy/issues/11)); amended 2026-10-23: the AWS stack must
  stay deployed ([ADR-0010](0010-backend-forecast-snapshot.md))
- **Deciders:** James Blue

## Context and problem

Glassy needs a public URL that stays up for free, since it is a portfolio project. It should also
show how the same static build would be hosted in production: a private origin, security headers, a
Content-Security-Policy, infrastructure as code and deploys without stored credentials. Running
that in AWS full time would cost money for a demo.

## Decision drivers

- A free, always-on live demo that deploys itself after CI passes.
- Production-grade hosting defined in code, reviewed and tested like the app.
- No long-lived cloud credentials in GitHub.
- No cost until someone decides to deploy.

## Considered options

1. GitHub Pages only.
2. AWS only (S3 and CloudFront, defined with the AWS CDK).
3. A managed static host such as Netlify, Vercel or Cloudflare Pages.
4. Both 1 and 2: Pages for the live demo, the AWS stack built and tested in CI and deployed by hand.

## Decision

Option 4.

- **GitHub Pages** builds the `github-pages` configuration (base href `/glassy/`) after CI passes
  on `main`, adds a `404.html` copy of `index.html`, and publishes with the official Pages actions.
- **AWS** is a CDK v2 app in `infra/`: a private, encrypted S3 bucket behind CloudFront with Origin
  Access Control, a response headers policy with HSTS and a CSP that lists only Open-Meteo, NOAA and
  Esri, and a deploy role that GitHub can assume through OIDC from the `production` environment
  only. CI runs its tests and `cdk synth` with cdk-nag on every pull request. The deploy workflow
  runs only when started by hand.

[deployment.md](../deployment.md) has both runbooks.

**Since ADR-0010** (amended 2026-10-23). The AWS stack also runs the forecast ingest: a Lambda
writes `forecast.json` to the site bucket every 3 hours, and **both** sites read it, the Pages demo
across origins ([ADR-0010](0010-backend-forecast-snapshot.md)). So:

- **The AWS stack must stay deployed.** It is no longer optional production hosting: the Pages
  demo depends on it. If it is down, Pages visitors see their cached forecast for up to 12 hours,
  then an error.
- **Expected monthly cost: under $1** at demo traffic (Lambda and EventBridge within or near their
  free tiers, CloudFront within its always-free 1 TB, one CloudWatch alarm). ADR-0010 breaks it
  down, and [#38](https://github.com/jamesablue/glassy/issues/38) records the measured figure in
  [deployment.md](../deployment.md).
- Deploys still run only when started by hand; the ingest runs on its own schedule between them.
- The CSP stops listing Open-Meteo once the app reads the snapshot
  ([#40](https://github.com/jamesablue/glassy/issues/40)).

## Consequences

**Good**

- The demo costs nothing and updates itself. (Since ADR-0010, it relies on the AWS stack, which
  costs under $1 a month.)
- The AWS path is reviewed and tested without an AWS account: template tests on the synthesized
  CloudFormation, and cdk-nag fails the synth on any finding that is not acknowledged with a reason.
- No AWS keys anywhere. The workflow trades a GitHub OIDC token for a one-hour session, and the
  role can only touch this bucket and this distribution.
- The CSP caught a real problem early: Angular's critical-CSS inlining adds an inline script that
  `script-src 'self'` blocks, which would have left the global styles off. The `production`
  configuration now turns it off, and the deploy workflow fails if an inline script comes back.

**Bad**

- Two build configurations, because Pages serves the app under `/glassy/` and CloudFront at `/`.
- GitHub Pages cannot set response headers, so the live demo has no CSP or HSTS of its own. The
  headers only apply on AWS.
- Pages answers unknown paths with its `404.html` and a 404 status. The app recovers (it replaces
  the path and keeps the query), but the status stays 404 for that first response.
- `cdk synth` is not a deployment. The AWS path is not exercised end to end until someone deploys it,
  and then it costs a little to run. Since ADR-0010 it has to stay deployed, so that cost is
  ongoing.

## Alternatives considered

- **Pages only.** The simplest, but it shows nothing about production hosting, headers or IaC.
- **AWS only.** Shows everything, but costs money and needs an account to keep the demo up.
- **Netlify, Vercel or Cloudflare Pages.** Headers from a config file and preview deploys, but
  another account and platform, and less to show about infrastructure as code. Open-Meteo also
  notes that its per-IP limits can bite sooner when requests come from shared platform IPs. That
  only matters for server-side calls, which Glassy did not make; since ADR-0010 the ingest Lambda
  makes them, from shared AWS addresses.
