import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';
import { GLASSY_CONFIG } from '../../core/glassy-config.token';
import { identifyUrl, parsePixelValue, type IdentifyResponse } from './identify';

/** Points are looked up on a grid of 1/10,000° (about 11 m), finer than a tap can aim. */
const COORDINATE_DECIMALS = 4;
/** Enough remembered points for a long session of tapping around the map. */
const MEMO_LIMIT = 256;

/** Point elevations from NOAA's DEM mosaic, for the map's point inspector. */
@Injectable({ providedIn: 'root' })
export class BathymetryClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(GLASSY_CONFIG).noaaDemUrl;
  private readonly memo = new Map<string, number>();

  /**
   * Ground elevation at a point in metres relative to sea level: negative under water (the depth
   * is its negation) and positive on land. Emits `NaN` when NOAA has no data there or the lookup
   * fails, so the inspector can show a dash instead of an error. Answers are remembered per
   * rounded point; failures are not, so tapping the same spot again retries.
   */
  elevationAt(lat: number, lon: number): Observable<number> {
    const point = { lat: round(lat), lon: round(lon) };
    const key = `${point.lat},${point.lon}`;
    const known = this.memo.get(key);
    if (known !== undefined) return of(known);

    return this.http.get<IdentifyResponse>(identifyUrl(this.baseUrl, point)).pipe(
      map((response) => {
        if (typeof response.value !== 'string') return NaN;
        const elevation = parsePixelValue(response.value);
        this.remember(key, elevation);
        return elevation;
      }),
      catchError(() => of(NaN)),
    );
  }

  private remember(key: string, elevation: number): void {
    if (this.memo.size >= MEMO_LIMIT) {
      // Maps iterate in insertion order, so the first key is the oldest.
      const oldest = this.memo.keys().next().value;
      if (oldest !== undefined) this.memo.delete(oldest);
    }
    this.memo.set(key, elevation);
  }
}

function round(degrees: number): number {
  return Number(degrees.toFixed(COORDINATE_DECIMALS));
}
