import { inject } from '@angular/core';
import * as L from 'leaflet';
import { AppNotices } from '../../core/app-notices';
import { CLOCK } from '../../core/clock';
import { TileOutage } from './tile-outage';

/** A transparent 1 × 1 GIF, shown in place of the tiles of a source that is down. */
export const BLANK_TILE_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * A tile layer that reports its failed tiles to a {@link TileOutage} and, while the source is
 * paused, shows blank tiles instead of asking it. Without an outage it is a plain tile layer.
 */
export class GuardedTileLayer extends L.TileLayer {
  constructor(
    url: string,
    options: L.TileLayerOptions = {},
    private readonly outage?: TileOutage,
  ) {
    super(url, options);
    if (!outage) return;
    this.on('tileerror', () => outage.failed());
    this.on('tileload', (event: L.TileEvent) => {
      // A blank tile loading says nothing about the source.
      if (event.tile.src !== BLANK_TILE_URL) outage.loaded();
    });
  }

  override getTileUrl(coords: L.Coords): string {
    return this.outage?.paused ? BLANK_TILE_URL : this.sourceTileUrl(coords);
  }

  /** The tile's URL at its source. */
  protected sourceTileUrl(coords: L.Coords): string {
    return super.getTileUrl(coords);
  }
}

/**
 * A {@link TileOutage} for one tile source that raises the app's "map tiles unavailable" notice
 * when the source goes down. `AppNotices` keeps that to one notice however many sources fail. Call
 * it from a layer component's constructor.
 */
export function injectTileOutage(): TileOutage {
  const notices = inject(AppNotices);
  const clock = inject(CLOCK);
  return new TileOutage(
    () => notices.raise('map-tiles-unavailable'),
    () => clock.now(),
  );
}
