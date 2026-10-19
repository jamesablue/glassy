# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue or pull request.

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose
**Report a vulnerability** (or go straight to
[the new advisory form](https://github.com/jamesablue/glassy/security/advisories/new)). Include:

- what the problem is and where (a file, a URL or a workflow)
- the steps to reproduce it, or a proof of concept
- what an attacker could do with it

You will get an answer within a week. Once the problem is confirmed, it is fixed on `main`, and the
advisory is published with credit to you, unless you would rather stay anonymous.

## Scope

Glassy is a static single-page app with no backend and no user accounts. It reads public forecast
and map data from Open-Meteo, NOAA and Esri in the browser. Reports that matter most:

- script injection (XSS) through the URL, forecast data or anything else the app renders
- weaknesses in the hosting setup in `infra/` (S3, CloudFront, the Content-Security-Policy and
  other response headers) or in the GitHub Actions workflows
- vulnerable dependencies that the app actually ships or that run in CI

The forecasts themselves (wrong or missing data from the upstream services) are not security issues;
please open a normal issue for those.

## Supported versions

Only the latest version on `main`, which is what the live demo runs, gets fixes.
