# ADR-0002: Leaflet with custom canvas renderers

- **Status:** Accepted
- **Date:** 2026-10-19 (implemented in [#24](https://github.com/jamesablue/glassy/pull/24))
- **Deciders:** James Blue

## Context and problem

The map has to show:

- raster tiles from Esri (basemap and labels) and from NOAA, which renders hillshade and depth
  classes on request through ArcGIS raster functions (`exportImage`);
- a forecast field (wind, waves, swell, period) interpolated from a coarse 1/8° grid;
- animated particles following the wind, wave or swell vectors;
- 25 spot pins with decluttered labels, and a readout where the map is tapped.

The prototype did all of this with Leaflet 1.9 from a CDN plus hand-written canvas code. The port had
to keep its look and behavior, and fit Angular's components, signals and tests.

## Decision drivers

- Parity with the prototype, checked side by side.
- Bundle size: the initial budget is 510 kB (warning) and 535 kB (error).
- Renderers that can be tested without a browser, and could move to a Web Worker.
- Pins that are real, focusable Angular components.

## Considered options

1. Leaflet 1.9.4 from npm, wrapped by small Angular components of our own, with the canvas code moved
   into framework-free renderer classes.
2. MapLibre GL JS (WebGL, vector tiles), with the field and particles rewritten as WebGL custom
   layers.
3. ngx-leaflet, an Angular wrapper library around Leaflet.

## Decision

Option 1. `MapHostComponent` creates the map and provides a `MapContext` (the map plus `viewport`,
`moving` and `zooming` signals) to one component per layer. `ScalarFieldRenderer` and
`ParticleSystem` in `map/renderers/` take a canvas, plain arrays and a `MapView`, and ESLint keeps
every package (Angular, Leaflet, RxJS) out of that folder. Pins and the readout are Angular
components mounted into Leaflet's DOM with `createComponent`.

## Consequences

**Good**

- The port matched the prototype pixel for pixel on the waves, wind and depth layers, apart from the
  panels added later.
- Leaflet is about 150 kB of the 484 kB initial bundle.
- The renderers have their own unit tests with a fake 2D context and animation host; the components
  run against real Leaflet in jsdom.
- The field paints at 1/3 resolution and only on change. In a trace of ten pans, the longest task
  with app script in it was under 10 ms.
- Pins are buttons: Tab reaches them, Enter selects them, and screen readers hear the name, rating
  and surf.

**Bad**

- Everything is drawn on the CPU. That is fine for a 165-cell grid but would not scale to a much
  finer one without a worker or WebGL.
- The field canvas cannot follow Leaflet's zoom animation, so it hides while zooming and redraws
  when the zoom ends.
- Leaflet is CommonJS (`allowedCommonJsDependencies` in `angular.json`), and its own DOM (panes,
  controls, popups) is styled outside the components in `leaflet-overrides.scss`.
- The thin wrapper (host, context, `keepLayerOnMap`) is our code to maintain.

## Alternatives considered

- **MapLibre GL JS.** Smooth vector zooming and GPU rendering, but a much larger bundle, and the
  field and particles would have been rewritten as WebGL layers, which put the parity goal at risk.
  Vector tiles bring nothing here: the data is raster tiles and a gridded forecast.
- **ngx-leaflet.** It saves a little wiring, but adds a dependency whose releases have to keep up
  with Angular majors, and layers declared as directive inputs would not give each layer its own
  component, lifecycle and tests. The equivalent here is a host component, a context and one helper.
