import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { GLASSY_CONFIG } from '../../core/glassy-config.token';
import { SPOT_CATALOG } from '../../core/spot-catalog.token';
import type { OpenMeteoResponse } from './open-meteo.types';
import {
  forecastRequestUrls,
  type GridMarineVariable,
  type GridWindVariable,
  type SpotMarineVariable,
  type SpotWeatherVariable,
} from './open-meteo.urls';

/**
 * The four Open-Meteo requests behind a forecast load, one method each so the repository can
 * retry them independently. Responses are returned as Open-Meteo sends them (a bare object when
 * only one location was requested); `toForecastBundle` turns them into domain types.
 */
@Injectable({ providedIn: 'root' })
export class OpenMeteoClient {
  private readonly http = inject(HttpClient);
  private readonly urls = forecastRequestUrls(inject(GLASSY_CONFIG), inject(SPOT_CATALOG));

  /** Waves and swell on the map grid (`cell_selection=sea`, so coastal cells read open water). */
  gridMarine(): Observable<OpenMeteoResponse<GridMarineVariable>> {
    return this.http.get<OpenMeteoResponse<GridMarineVariable>>(this.urls.gridMarine);
  }

  /** Wind on the map grid, in m/s. */
  gridWind(): Observable<OpenMeteoResponse<GridWindVariable>> {
    return this.http.get<OpenMeteoResponse<GridWindVariable>>(this.urls.gridWind);
  }

  /** Marine values a few kilometres offshore of each spot, in catalog order. */
  spotMarine(): Observable<OpenMeteoResponse<SpotMarineVariable>> {
    return this.http.get<OpenMeteoResponse<SpotMarineVariable>>(this.urls.spotMarine);
  }

  /** Weather at each spot (`cell_selection=nearest`), in catalog order. */
  spotWeather(): Observable<OpenMeteoResponse<SpotWeatherVariable>> {
    return this.http.get<OpenMeteoResponse<SpotWeatherVariable>>(this.urls.spotWeather);
  }
}
