# ADR-0008: URL state without the Angular router

- **Status:** Accepted
- **Date:** 2026-10-19 (implemented in [#26](https://github.com/jamesablue/glassy/pull/26))
- **Deciders:** James Blue

## Context and problem

Any view in Glassy can be shared as a link: `?layer=` for the map layer, `?spot=` for the selected
spot and `?t=` for the hour, for example `/?spot=hanauma&layer=depth&t=2026-10-20T08`. The first
version (in [#22](https://github.com/jamesablue/glassy/pull/22)) kept these in sync through
`@angular/router`.

But Glassy is a single view with no `<router-outlet>`; the router only read and wrote the query
string. After the feature UI landed, the initial bundle was 543.2 kB against a 560 kB warning
budget, and the router was 69.6 kB of it.

## Decision drivers

- Initial bundle size, and room under a tighter budget.
- Links that restore a view exactly, and keep pointing at the same hour later.
- Back and forward buttons that work, without filling history while the timeline plays.
- GitHub Pages' `404.html` fallback, which serves the app for any path.

## Considered options

1. Keep `@angular/router` for the query string.
2. Read and write the query string through `@angular/common`'s `Location`.
3. Keep the state in the URL hash.
4. No URL state.

## Decision

Option 2. `UrlStateSync` (`src/app/state/url-state.sync.ts`):

- reads the URL once at startup, before anything can write, and on every `popstate`;
- writes with `replaceState`, merging into the existing query and skipping writes that change
  nothing, so stepping through the hours adds no history entries;
- sends any other path back to the app's own path with the query kept;
- writes `t` as the Honolulu wall-clock hour (`YYYY-MM-DDTHH`) rather than an index, applies it once
  the forecast has loaded and clamps it to the forecast's range;
- leaves out values at their defaults (`layer=waves`, no spot, the current hour) and ignores and
  tidies away unknown or malformed values.

## Consequences

**Good**

- The initial bundle went from 543.2 kB to 469.2 kB (147.1 kB to 129.4 kB transferred), which let
  the budgets come down to 510 kB (warning) and 535 kB (error).
- Behavior is unchanged: the spec covers the same cases plus the path fallback, and the end-to-end
  shared-link tests pass.
- The Pages fallback works: `/glassy/somewhere/else?spot=hanauma&layer=depth` opens Hanauma Bay on
  the depth layer at `/glassy/?spot=hanauma&layer=depth`.

**Bad**

- Parsing and validation are our code (`state/parse.ts`) rather than the router's.
- If Glassy ever needs a second view, the router has to come back, and `UrlStateSync` would go back
  to reading router navigations. The state README says so.

## Alternatives considered

- **Keep the router.** Familiar and future-proof, but about 70 kB for features the app does not
  use.
- **The hash.** Avoids the Pages 404 trick, but the links are uglier, and it would still need the
  same parsing and validation.
- **No URL state.** Smallest, but losing shareable links would remove a feature people use to send
  a spot and time to a friend.
