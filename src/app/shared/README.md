# shared

Small, reusable presentation pieces with no knowledge of app state. Everything here takes its data
through `input()`s or pipe arguments, so it renders the same wherever it is used.

## Inventory

**`ui/`**

| Component                   | Selector                   | What it is                                                                 |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------- |
| `IconComponent`             | `glassy-icon`              | a line icon from the inline SVG set in `icons.ts`, decorative              |
| `DirectionArrowComponent`   | `glassy-direction-arrow`   | points the way wind or waves travel: the "from" bearing + 180°             |
| `RatingBadgeComponent`      | `glassy-rating-badge`      | a rating's name on its colour                                              |
| `ScorePillComponent`        | `glassy-score-pill`        | a score over its rating, read as "score 7.4 of 10, Good"                   |
| `PanelComponent`            | `glassy-panel`             | the dark, translucent card the floating panels are built from              |
| `PopoverComponent`          | `glassy-popover`           | a native `popover="auto"` card; knows when it is open, starts focus inside |
| `SegmentedControlComponent` | `glassy-segmented-control` | joined options, one selected                                               |
| `ChipGroupComponent`        | `glassy-chip-group`        | wrapping pill options, one selected                                        |

The icons (wind, waves, swell, period, depth, particles, spots, units, about, play, pause, back,
chevron) draw in `currentColor`, so they take the colour of the control around them.

The segmented control and the chip group differ only in looks. Both extend `ChoiceGroup`, an
accessible radio group (one tab stop; arrow keys, Home and End move the selection and focus) that
is stateless: it shows `value` and asks for changes through `valueChange`.

**`pipes/`**: pure pipes over `domain/units` and `domain/time`. Units are arguments, so the pipes stay
pure and update when the user's units change. A missing value (`NaN`, `null`, `undefined`) reads "—".

| Pipe          | Example                          | Result     |
| ------------- | -------------------------------- | ---------- |
| `height`      | `{{ 1 \| height: 'ft' }}`        | `3.3`      |
| `speed`       | `{{ 10 \| speed: 'kt' }}`        | `19`       |
| `temperature` | `{{ 26 \| temperature: 'f' }}`   | `79°F`     |
| `depth`       | `{{ 8.5 \| depth: 'ft' }}`       | `28 ft`    |
| `compass`     | `{{ 100 \| compass }}`           | `E`        |
| `surfRange`   | `{{ 1 \| surfRange: 'ft' }}`     | `3–4 ft`   |
| `hstTime`     | `{{ t \| hstTime }}`, `: 'hour'` | `Sun 3 PM` |

Formatting itself lives in `domain/units` (and `domain/time`): the map may not import `shared/`, so
its pins and point readout call the same domain functions directly, and the two can never disagree.

**May import:** `domain/` (plus Angular).

**Must not import:** `data/`, `state/`, `map/`, `features/`, `core/`.

**Tests:** a spec per pipe and per component; `choice-group.spec.ts` runs the same keyboard and
selection checks against both choice controls. Coverage below 90% fails `npm run test:ci`.
