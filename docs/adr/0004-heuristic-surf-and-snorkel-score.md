# ADR-0004: A heuristic surf estimate and snorkel score

- **Status:** Accepted
- **Date:** 2026-10-18 (ported in [#20](https://github.com/jamesablue/glassy/pull/20))
- **Deciders:** James Blue

## Context and problem

To rank snorkel spots, Glassy needs the surf a swimmer meets at each entry, not just the swell
offshore. Open-Meteo gives significant height, period and direction for three wave trains a few
kilometers out to sea, plus wind and current. It does not say how much of that reaches a particular
cove behind a reef.

Surf forecasting services do model this, and Surfline is the best known. But Surfline has no public
API. Its private endpoints are undocumented, its terms of use do not grant access to them, and a
browser on another origin could not call them without a proxy because of CORS. The keyed commercial
marine APIs would need a server to hold the key, which [ADR-0001](0001-static-spa-no-backend.md)
rules out.

## Decision drivers

- Free and keyless, so it runs in a static SPA.
- Explainable in a sentence or two, as the About panel does.
- Per-spot: each cove's orientation and protection matter more than the offshore number.
- Deterministic and testable, and identical to the prototype's results.

## Considered options

1. A heuristic on Open-Meteo data: each wave train scaled by the spot's exposure to its direction
   and by its period, combined by energy, reduced by the spot's shelter, then turned into penalties.
2. Surfline data through its private endpoints.
3. A keyed commercial marine API behind a proxy.
4. A physical nearshore wave model run for Oahu.

## Decision

Option 1, carried over from the prototype unchanged. Each spot has a `facing`, a swell `window` and
a `shelter` value in a typed catalog. The score starts at 10 and loses points for the estimated
surf, the onshore-weighted wind and the current, read from piecewise-linear tables.
[scoring-model.md](../scoring-model.md) has every formula and a worked example.

## Consequences

**Good**

- Free, keyless and fast: scoring every spot for every hour takes one pass when a forecast loads.
- Explainable: the details panel shows how much of each train "hits spot", and the hazards say why
  a spot is risky.
- Pure functions in `domain/scoring/` with full statement coverage. The golden test compares them
  with a verbatim copy of the prototype's code on a real recording: all 1,200 spot-hours match
  exactly, as does the ranking at every hour.
- A new spot is a catalog entry, not code. Another island is a catalog and a grid
  ([#15](https://github.com/jamesablue/glassy/issues/15)).

**Bad**

- The numbers are estimates. The UI says "estimated breaking height", and the About panel tells
  people to check lifeguard postings.
- Nothing is calibrated against observations: the tables, the period factor and each spot's
  geometry are judgment calls.
- There is no refraction or shoaling over the real reef, and tide height is shown but not scored.
  [scoring-model.md](../scoring-model.md#known-limitations) lists the limits and how the model
  could be validated.

## Alternatives considered

- **Surfline.** Better nearshore numbers for surf breaks, but no public API, terms that do not allow
  this use, a proxy for CORS, and a model built for surfers rather than snorkelers. Backlog
  [#18](https://github.com/jamesablue/glassy/issues/18) tracks partner data if an API appears.
- **A keyed marine API through a proxy.** Possible later, together with the forecast proxy in
  [#17](https://github.com/jamesablue/glassy/issues/17), but it adds cost, a service and a secret.
- **A nearshore wave model** (spectral, over the real bathymetry). The most faithful option, and
  far beyond what a browser app or a portfolio budget can run every hour.
