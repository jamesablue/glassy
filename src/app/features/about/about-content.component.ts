import { Component } from '@angular/core';

/**
 * What the About popover says: how the score works, where the data comes from, and the safety
 * note. The popover loads it with `@defer` the first time it opens.
 */
@Component({
  selector: 'glassy-about-content',
  template: `
    <p>
      <b>The snorkel score (0–10)</b> starts at 10 and loses points for surf at the spot, wind
      (onshore counts more than offshore) and current.
    </p>
    <p>
      <b>Surf at a spot</b> comes from the offshore wave forecast: each swell and wind-wave train is
      scaled by how squarely it hits that shore, by its period, and by how much reef or breakwater
      shelters the spot.
    </p>
    <p>
      Wind, waves and swell from
      <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a> (ECMWF,
      Météo-France and NOAA GFS models). Depth from
      <a
        href="https://www.ncei.noaa.gov/products/coastal-elevation-models"
        target="_blank"
        rel="noopener"
        >NOAA NCEI</a
      >
      coastal elevation models; tap the map for the depth anywhere. Basemap ©
      <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, map data ©
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener"
        >OpenStreetMap</a
      >
      contributors.
    </p>
    <p class="fine">
      Estimates only. Check lifeguard postings and the water when you arrive. When in doubt, don't
      go out.
    </p>
  `,
  styles: `
    p {
      margin: 0 0 8px;
      color: var(--muted);

      &:last-child {
        margin-bottom: 0;
      }
    }

    b {
      color: var(--text);
    }

    a {
      color: var(--accent-2);
    }

    .fine {
      font-size: 11.5px;
    }
  `,
})
export class AboutContentComponent {}
