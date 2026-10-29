# The snorkel score

Glassy rates every spot for every forecast hour on a 0 to 10 scale. The score starts at 10 and loses
points for surf at the spot, for wind and for current. It is a heuristic built from a few readable
rules, not a trained model ([ADR-0004](adr/0004-heuristic-surf-and-snorkel-score.md)).

All of it lives in `src/app/domain/scoring/`, as plain functions with no framework code. The
golden test (`scoring/golden.spec.ts`) checks the TypeScript against the original prototype's
code on a real recorded forecast: all 1,200 spot-hours (25 spots × 48 hours) match exactly.

- [Inputs](#inputs)
- [Surf at the spot](#surf-at-the-spot)
- [Wind](#wind)
- [Current](#current)
- [The score and its rating](#the-score-and-its-rating)
- [Hazards](#hazards)
- [The best window](#the-best-window)
- [Worked example](#worked-example-hanauma-bay-at-8-am)
- [Known limitations](#known-limitations)

## Inputs

### Per spot

Each spot in `domain/spots/oahu.spots.ts` carries three numbers that describe its coastline:

| Field     | Meaning                                                                                             |
| --------- | --------------------------------------------------------------------------------------------------- |
| `facing`  | compass bearing the shore looks out toward; swell from here hits head-on, wind from here is onshore |
| `window`  | half-width of the swell window in degrees: how far off-axis swell still wraps in (80° if unset)     |
| `shelter` | 0 for fully exposed, 1 for fully protected by reef, breakwater, lagoon or bay                       |

<details>
<summary>All 25 spots</summary>

| Spot                         | Region      | Facing | Window | Shelter | Level        |
| ---------------------------- | ----------- | -----: | -----: | ------: | ------------ |
| Shark's Cove                 | North Shore |   300° |    90° |    0.15 | Intermediate |
| Three Tables                 | North Shore |   295° |    90° |    0.10 | Intermediate |
| Waimea Bay                   | North Shore |   315° |    90° |    0.05 | Intermediate |
| Laniakea (Turtle Beach)      | North Shore |   320° |    90° |    0.20 | Intermediate |
| Mokule'ia                    | North Shore |   355° |    85° |    0.20 | Intermediate |
| Kuilima Cove (Turtle Bay)    | North Shore |    10° |    80° |    0.70 | Beginner     |
| Mālaekahana                  | Windward    |    75° |    80° |    0.25 | Intermediate |
| Kahana Bay                   | Windward    |    45° |    60° |    0.45 | Beginner     |
| Kualoa (Mokoli'i)            | Windward    |    70° |    70° |    0.55 | Beginner     |
| Kāneʻohe Sandbar             | Windward    |    45° |    60° |    0.85 | Beginner     |
| Kailua Beach                 | Windward    |    75° |    80° |    0.30 | Beginner     |
| Lanikai                      | Windward    |    85° |    80° |    0.40 | Beginner     |
| Waimānalo Bay                | Windward    |    70° |    80° |    0.20 | Intermediate |
| Kaupo Beach Park             | Windward    |    80° |    70° |    0.50 | Beginner     |
| Hanauma Bay                  | South Shore |   140° |    55° |    0.55 | Beginner     |
| China Walls                  | South Shore |   185° |    80° |    0.00 | Advanced     |
| Kahala (Waiʻalae)            | South Shore |   170° |    80° |    0.45 | Beginner     |
| Diamond Head (Kuilei Cliffs) | South Shore |   190° |    85° |    0.10 | Intermediate |
| Kaimana / Sans Souci         | South Shore |   215° |    80° |    0.35 | Beginner     |
| Magic Island Lagoon          | South Shore |   190° |    60° |    0.85 | Beginner     |
| Ko Olina Lagoons             | West Side   |   230° |    60° |    0.80 | Beginner     |
| Electric Beach (Kahe Pt)     | West Side   |   260° |    85° |    0.00 | Intermediate |
| Pōkaʻi Bay                   | West Side   |   245° |    70° |    0.70 | Beginner     |
| Mākaha                       | West Side   |   270° |    85° |    0.05 | Intermediate |
| Mākua Beach                  | West Side   |   265° |    85° |    0.05 | Intermediate |

</details>

### Per hour

`sampleSpot()` reads one `SpotHourSample` per spot and hour from the packed forecast:

- **Marine values** (three wave trains, current, sea temperature, sea level) come from the
  Open-Meteo Marine API at a point 6 km out to sea along the spot's `facing` (`offshorePoint`),
  with `cell_selection=sea`, because wave models mask the coastal cells the spots sit in as land.
- **Weather values** (wind speed and direction at 10 m, gusts, rain chance, daylight) come from
  the Open-Meteo Forecast API at the spot itself, with `cell_selection=nearest`.
- A missing value is `NaN`. Each rule below says what it does with one.

The three wave trains are the **primary swell**, the **secondary swell** and the **wind waves**,
each with a height (m), a peak period (s) and the direction it comes from (degrees).

## Surf at the spot

The forecast describes the sea offshore. The surf a snorkeler meets at the entry depends on how much
of each wave train reaches the spot, how much it grows as it breaks, and how sheltered the spot is.

The estimate is a **full-face** breaking height: from the trough in front of a breaking wave to its
crest, the way Hawaii's county lifeguards report surf. Hawaiian-scale reports, which quote roughly
half the face, read lower for the same waves.

### Exposure

`exposure(direction, spot)` is the share (0 to 1) of a wave train that reaches the spot. With
θ = the angle between the train's direction and the spot's `facing` (0° to 180°) and w = `window`:

| Zone             | Angle           | Exposure                       |
| ---------------- | --------------- | ------------------------------ |
| Swell window     | θ ≤ w           | 0.25 + 0.75 · cos(θ / w · 90°) |
| Wrap zone        | w < θ ≤ w + 45° | 0.25 · (1 − (θ − w) / 45°)     |
| Behind the coast | θ > w + 45°     | 0                              |

Head-on swell arrives in full. Inside the window the share tapers along a cosine to 25% at the
window's edge, then fades linearly to nothing across a 45° wrap zone, where only refracted energy
bends around the coast.

### Period factor

`periodFactor(T)` says how much bigger than its offshore height a train breaks, given its period T
in seconds:

```text
periodFactor(T) = clamp(0.5 + 0.065 · T, 0.8, 1.7)        T = 8 s when the period is missing
```

| Period | 4.6 s or less |  6 s |  8 s | 10 s | 12 s |  15 s | 18.5 s or more |
| ------ | ------------: | ---: | ---: | ---: | ---: | ----: | -------------: |
| Factor |           0.8 | 0.89 | 1.02 | 1.15 | 1.28 | 1.475 |            1.7 |

Long-period groundswell carries more energy per meter of height and steepens more over the reef,
so a 15 s swell breaks far bigger than 6 s wind chop of the same offshore height.

### Combined energy and shelter

Each available train (height and direction both known) contributes
`height × exposure × periodFactor`. Wave energy scales with height squared, so the trains combine
as the root of the sum of squares, and shelter takes its share off the result:

```text
surf = √(s₁² + s₂² + s₃²) × (1 − shelter)        meters, where sᵢ = hᵢ · exposure(dᵢ) · periodFactor(Tᵢ)
```

The app shows this estimate as a surf-report range, and as "Flat" below 0.4 ft. In feet the range's
width follows Oahu's lifeguard reports, which quote small surf in 1 ft ranges and bigger surf in
2 ft ranges, and it always contains the estimate:

| Estimate     | Range                                     | Example         |
| ------------ | ----------------------------------------- | --------------- |
| 0.4 to 1 ft  | 0–1                                       | 0.7 ft → "0–1"  |
| 1 to 4 ft    | 1 ft wide, from the estimate rounded down | 2.31 ft → "2–3" |
| 4 to 12 ft   | 2 ft wide, centered on the estimate       | 5.7 ft → "5–7"  |
| 12 ft and up | 80% to 120% of the estimate               | 20 ft → "16–24" |

In meters it spans 80% to 120% of the estimate, in tenths.

### Surf penalty

`SURF_PENALTY` maps the estimate in feet to points lost, interpolating linearly between the knots
and holding the last value above them:

| Surf (ft)  |   0 | 0.5 |   1 |   2 |   3 |   4 |   5 |   6 |  8+ |
| ---------- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| Points off |   0 | 0.2 | 0.8 | 2.5 | 4.5 | 6.5 |   8 | 9.5 |  10 |

Knee-high surf barely matters. By head high (6 ft), getting in and out over the reef is no longer
safe.

## Wind

Onshore wind piles chop onto the spot and stirs up sediment; offshore wind crosses the land first
and mostly flattens the water close in. With α = the angle between the wind's direction and the
spot's `facing`:

```text
direction weight = 0.6 + 0.4 · cos α                       1.0 onshore, 0.6 cross-shore, 0.2 offshore
effective wind   = speed (kt) × direction weight × (1 − 0.45 · shelter)
```

Shelter takes off at most 45% of the wind, so a fully sheltered spot still feels 55% of it. The
ranking and the details label the wind **onshore** when α < 45°, **offshore** when α > 135° and
**cross-shore** in between.

`WIND_PENALTY`, by effective wind in knots (missing wind costs nothing):

| Effective wind (kt) |   0 |   6 |  10 |  15 |  20 |  25 | 35+ |
| ------------------- | --: | --: | --: | --: | --: | --: | --: |
| Points off          |   0 | 0.3 | 1.2 | 2.6 | 4.2 | 5.8 |   8 |

## Current

The marine model's surface current (km/h) is converted to knots; a missing current counts as none.
Half a knot is easy to swim against, so the penalty starts above it, and shelter reduces it:

```text
current penalty = CURRENT_PENALTY(knots) × (1 − shelter)
```

| Current (kt) |   0 | 0.5 |   1 |  2+ |
| ------------ | --: | --: | --: | --: |
| Points off   |   0 |   0 | 0.6 |   2 |

## The score and its rating

```text
score = clamp(10 − surf penalty − wind penalty − current penalty, 0, 10)
```

`rateScore()` puts the score in a band:

| Rating    | Score    | Color     |
| --------- | -------- | --------- |
| Excellent | 8 and up | `#34d399` |
| Good      | 6.5 to 8 | `#a3e635` |
| Fair      | 5 to 6.5 | `#facc15` |
| Poor      | 3 to 5   | `#fb923c` |
| Hazardous | below 3  | `#f87171` |

A missing score rates as Hazardous. `computeScoreMatrix()` scores every spot for every hour once
per forecast load, and `rankSpots()` sorts a region's spots by score at the selected hour (equal
scores keep catalog order).

## Hazards

`hazardsFor()` adds warnings to the details panel, independent of the score:

| Hazard           | Shown when             | Message                                                                  |
| ---------------- | ---------------------- | ------------------------------------------------------------------------ |
| `big-surf`       | surf ≥ 3 ft            | "Surf around … here. Getting in and out over the reef can be dangerous." |
| `strong-wind`    | effective wind ≥ 18 kt | "Strong onshore wind: expect chop and poor visibility."                  |
| `strong-current` | current ≥ 1 kt         | "Current near … kt offshore. Stay close to shore."                       |

The wind threshold uses the onshore-weighted, sheltered wind, so it fires mostly for onshore wind.

## The best window

`bestWindow()` suggests a three-hour daylight session for the selected spot:

- Windows start at or after the current hour and must fit inside the forecast.
- A window counts as daylight when its first and last hours are daylight (true for any window
  shorter than a night). Daylight is the forecast's island-wide flag (the first spot's `is_day`).
- Each window is scored by the mean of its three hourly scores.
- A later window replaces an earlier one only if it is better by more than 0.05 points, so rounding
  noise does not push the suggestion days ahead. Ties go to the earlier window.
- If no window fits, the panel says there is no daylight window left.

## Worked example: Hanauma Bay at 8 AM

Hanauma Bay at 8 AM on Sunday 18 October 2026 (Honolulu time), hour 8 of the recorded forecast in
`src/testing/fixtures/spot-forecast.fixture.json`. That is the hour the end-to-end tests and the
README screenshots open on. The spot faces 140° with a 55° window and 0.55 shelter.

**Surf.**

| Train           | Height | Period | From |    θ | Zone         | Exposure                         | Period factor | Contribution |
| --------------- | -----: | -----: | ---: | ---: | ------------ | -------------------------------- | ------------: | -----------: |
| Primary swell   | 0.72 m | 10.8 s | 175° |  35° | window       | 0.25 + 0.75 · cos(57.3°) = 0.655 |         1.202 |      0.567 m |
| Secondary swell | 0.34 m |  7.1 s |  32° | 108° | behind coast | 0                                |         0.962 |          0 m |
| Wind waves      | 1.60 m |  4.7 s |  63° |  77° | wrap zone    | 0.25 · (1 − 22 / 45) = 0.128     |         0.806 |      0.165 m |

```text
surf = √(0.567² + 0.165²) × (1 − 0.55) = 0.591 × 0.45 = 0.266 m = 0.87 ft        shown as "0–1 ft"
surf penalty = 0.2 + (0.8 − 0.2) × (0.872 − 0.5) / 0.5 = 0.647
```

The 1.6 m of trade-wind chop is the largest of the three trains, but it comes from 77° off the
spot's axis, so only 13% wraps into the bay, and as short-period chop it breaks small.

**Wind.** 8.71 m/s (16.9 kt) from 60°, so α = 80°: cross-shore.

```text
effective wind = 16.9 × (0.6 + 0.4 · cos 80°) × (1 − 0.45 × 0.55) = 16.9 × 0.669 × 0.753 = 8.53 kt
wind penalty   = 0.3 + (1.2 − 0.3) × (8.53 − 6) / 4 = 0.869
```

**Current.** 1.70 km/h = 0.918 kt.

```text
current penalty = 0.6 × (0.918 − 0.5) / 0.5 × (1 − 0.55) = 0.502 × 0.45 = 0.226
```

**Score.**

```text
score = 10 − 0.647 − 0.869 − 0.226 = 8.26        Excellent, shown as 8.3
```

No hazard applies (0.87 ft < 3 ft, 8.5 kt < 18 kt, 0.92 kt < 1 kt). Unrounded, the score is
8.258727318956979, which is exactly what the prototype's code gives in
`spot-forecast.expected.json`. Hanauma Bay ranks 8th of 25 at that hour, and its best daylight
window is Monday 1 to 4 PM, averaging 8.6. The [spot details screenshot](images/spot-detail.png)
shows the same hour: "66% hits spot" for the primary swell, 0% for the secondary and 13% for the
wind waves.

## Known limitations

The score is a decision aid for picking where to look, not a safety forecast. The app says so in
its About panel: check lifeguard postings and the water when you arrive.

- **Model resolution.** The marine values come from global wave models whose cells are kilometers
  across, read at the nearest sea cell to a point 6 km offshore. Conditions inside a small bay, or
  on one side of a point, can differ a lot from that cell.
- **No reef-scale wave physics.** Exposure is a geometric rule (direction against a fixed facing and
  window), not refraction, shoaling or diffraction over the real bathymetry. The NOAA depth data is
  shown on the map but does not feed the score.
- **Hand-set heuristics.** The penalty tables, the period factor, the wrap zone, the wind weights
  and each spot's facing, window and shelter were chosen by judgment and carried over from the
  prototype unchanged. None of them has been calibrated against observations, though the surf
  estimate is now checked against lifeguard reports (below).
- **No tide effect.** Sea level (tide plus surge) is shown with its trend, but the score ignores
  it. On shallow reef flats a low tide can make an otherwise good spot unswimmable, and a high tide
  can let more surf over the reef.
- **Things it does not see.** Water clarity, runoff after rain (rain chance is shown but not
  scored), rip currents and local currents finer than the ocean model, jellyfish, crowds and
  closures. Hanauma Bay is closed on Mondays and Tuesdays, which only its notes mention; the best
  window in the worked example above falls on a Monday.

### How it could be validated

- **Surf estimate against buoys and reports.** Two backtests do this now.
  [buoy-swell-backtest.md](buoy-swell-backtest.md) (#55) compares the model's waves with four NOAA
  buoys. [lifeguard-surf-backtest.md](lifeguard-surf-backtest.md) (#58) compares the full-face
  estimate and its displayed range with the NWS lifeguard reports for Mākaha and five test beaches,
  per beach and by swell direction. Rerun it (`npm run backtest:lifeguards`) before and after a
  change to the surf model or spot geometry. Neither yet covers a winter season or forecast lead
  time.
- **Score against observed sessions.** Log real snorkel sessions (visibility, chop, surf at the
  entry, an overall 1 to 5 rating) together with the forecast the app showed. A rank correlation
  between score and rating, per spot, would show whether the ranking is useful. With enough data
  the tables could be fitted, holding out whole days to avoid overfitting.
- **Tide data.** NOAA CO-OPS tide stations ([#16](https://github.com/jamesablue/glassy/issues/16))
  would let a tide term be tested on the reef-flat spots.

Any change to the model should keep the golden test meaningful: update the prototype copy in
`scripts/generate-expected-scores.mjs` on purpose, regenerate with `npm run fixtures:expected`, and
review the change in expected scores as a diff (see [testing.md](testing.md)).
