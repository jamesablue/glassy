import * as L from 'leaflet';
import { MAP_PANES } from './map-panes';

const MAP_OPTIONS: L.MapOptions = {
  zoomControl: false,
  attributionControl: false,
  minZoom: 7,
  maxZoom: 15,
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 100,
  // The main Hawaiian islands with some sea around them; there is no forecast further out.
  maxBounds: [
    [16.5, -163.5],
    [25.5, -151.5],
  ],
  maxBoundsViscosity: 0.8,
};

const ATTRIBUTION_PREFIX = '<a href="https://leafletjs.com">Leaflet</a>';
const DATA_ATTRIBUTION =
  'Forecast <a href="https://open-meteo.com/">Open-Meteo</a> · ' +
  'Depth <a href="https://www.ncei.noaa.gov/">NOAA NCEI</a>';

/** Leaflet's own animations, all off when the user asks for reduced motion. */
function motionOptions(reducedMotion: boolean): L.MapOptions {
  const animate = !reducedMotion;
  return {
    zoomAnimation: animate,
    fadeAnimation: animate,
    markerZoomAnimation: animate,
    inertia: animate,
  };
}

/**
 * A Leaflet map in `container` with Glassy's options, controls and panes.
 *
 * @param reducedMotion the user asked for reduced motion: zooms snap instead of animating, tiles
 *   appear without fading in and a drag stops where it is let go
 */
export function createMap(container: HTMLElement, reducedMotion = false): L.Map {
  const map = L.map(container, { ...MAP_OPTIONS, ...motionOptions(reducedMotion) });
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.control
    .attribution({ position: 'bottomleft', prefix: ATTRIBUTION_PREFIX })
    .addAttribution(DATA_ATTRIBUTION)
    .addTo(map);
  for (const [name, zIndex] of Object.entries(MAP_PANES)) {
    map.createPane(name).style.zIndex = String(zIndex);
  }
  return map;
}
