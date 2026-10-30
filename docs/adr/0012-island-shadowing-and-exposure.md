# ADR-0012: Island shadowing: keep exposure until the surf estimate is calibrated

- **Status:** Accepted
- **Date:** 2026-10-29 ([#56](https://github.com/jamesablue/glassy/issues/56))
- **Deciders:** James Blue

## Context and problem

Glassy reads each spot's wave trains from Open-Meteo in open water near the spot, then scales each
train by `exposure()`: how much of a swell from that direction gets past the coast to the spot
([ADR-0004](0004-heuristic-surf-and-snorkel-score.md)). The wave model already blocks and bends
swell around Oahu at the point Glassy reads it, so the island's shadow may be counted twice.

Two backtests measure it:

- **NOAA buoys** ([#55](https://github.com/jamesablue/glassy/issues/55),
  [report](../buoy-swell-backtest.md)). In deep water, the model on its own (option A) is closest:
  total-height MAE 0.26 m, against 0.40 m for today's method, which reads 0.36 m low. That is the
  double count.
- **Lifeguard reports** ([#58](https://github.com/jamesablue/glassy/issues/58),
  [report](../lifeguard-surf-backtest.md)). At the beach, today's estimate is already unbiased over
  405 readings: 84% overlap with the lifeguards' range, MAE 0.91 ft, bias 0.00 ft, and 6% of
  readings more than 1 ft too low.

Buoys measure significant height in deep water. Lifeguards report breaking face height, which
Glassy gets by multiplying by `periodFactor()`. The two judgment calls were set together, so the
double count in `exposure()` offsets a period factor that would otherwise read high.

## Decision drivers

- Agree with what lifeguards see at the beach, which is what snorkelers meet.
- Read too low less often: calling it calm when it isn't is the dangerous mistake.
- Change one setting only where the backtests show it helps without making the estimate worse
  overall.

## Considered options

Each variant of `exposure()` run through both backtests on the same data (lifeguards: 405 readings,
Jul 29 to Oct 29, 2026; buoys: 4,319 hours, Sep 14 to Oct 29, 2026). "Buoy MAE" is the buoy report's
"today" method with that variant.

| Option                                          | Overlap | MAE (ft) | Bias (ft) | > 1 ft low | Mākaha overlap | Buoy MAE (m) |
| ----------------------------------------------- | ------: | -------: | --------: | ---------: | -------------: | -----------: |
| 0. Keep today's `exposure()`                    |     84% |     0.91 |      0.00 |         6% |            95% |         0.40 |
| 1. No exposure (A as the buoy test measured it) |     48% |     2.15 |     +2.07 |         0% |            11% |         0.25 |
| 2. Full strength across the window, then fade   |     66% |     1.37 |     +1.07 |         1% |            25% |         0.20 |
| 3. Today's shape, window edge 0.25 → 0.6        |     82% |     1.00 |     +0.47 |         3% |            83% |         0.30 |

#56 set the bar for shipping a variant: overlap at least 84%, MAE at most 0.91 ft, fewer readings
more than 1 ft low than today's 6%, and Mākaha no worse.

## Decision

Option 0: `exposure()` stays as it is. No variant clears the bar. Each one fixes the deep-water
error and reads too low less often, but overshoots at the beach because the period factor is
unchanged.

Separately, each spot's marine values are now read at a fixed `sample` point in the catalog, and
the catalog fingerprint hashes that point instead of `facing`
([#63](https://github.com/jamesablue/glassy/issues/63)). `facing` and `window` can be retuned
([#57](https://github.com/jamesablue/glassy/issues/57)) without invalidating snapshots.

## Consequences

- The surf estimate doesn't change, so the golden scores and every snorkeler-facing number stay the
  same.
- The double count remains, offset by the period factor. Readings are still too low most often for
  east and southeast swell and on the windward side (Makapuʻu 15% more than 1 ft low, Sandy Beach
  9%). The Mokapu buoy reads low even with the model on its own (−0.46 m).
- [#60](https://github.com/jamesablue/glassy/issues/60) fits the window-edge share and the period
  factor together against the lifeguard reports. It should consider removing or softening exposure
  as part of that fit (options 1–3 above as starting points), not on its own.
- A regression test pins Mākaha at 11 AM HST on Oct 29, 2026 (estimate 1.16 ft, shown as 1–2 ft)
  inside the lifeguards' 1–2 ft (`src/app/domain/scoring/lifeguard-regressions.spec.ts`).

## Alternatives considered

- **Option 1, no exposure:** matches the buoy test's winner, but reads +2.07 ft high at the beach and
  overlaps the lifeguards only 48% of the time.
- **Option 2, soften inside the window:** best in deep water (0.20 m), but +1.07 ft high at the beach,
  and Mākaha's overlap falls from 95% to 25%.
- **Option 3, raise the window edge:** closest to today, and cuts readings more than 1 ft low from 6%
  to 3%, but overlap and MAE get worse, and Mākaha reads +0.89 ft high. The closest candidate for #60.
