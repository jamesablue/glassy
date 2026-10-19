/**
 * The map's custom panes and their stacking order. Leaflet's own panes sit at 200 (basemap tiles),
 * 400 (overlays), 600 (markers) and 700 (popups).
 *
 * - `field` (250): forecast colours, just above the dark basemap
 * - `depth` (260): depth tiles; only one of field and depth shows at a time
 * - `particles` (330): wave and swell streaks, under the land so they stay at sea
 * - `land` (350): NOAA hillshade, over the sea colours so the island keeps its shape
 * - `labels` (380): place names, above everything drawn from data
 */
export const MAP_PANES = {
  field: 250,
  depth: 260,
  particles: 330,
  land: 350,
  labels: 380,
} as const;

export type MapPaneName = keyof typeof MAP_PANES;

/** In wind mode the particle pane rises above the land, because wind blows across the island. */
export const PARTICLES_OVER_LAND = 370;
