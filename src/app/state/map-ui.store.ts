import { computed, inject, Injectable, signal } from '@angular/core';
import { SPOT_CATALOG } from '../core/spot-catalog.token';
import { LAYERS } from '../domain/color';
import type {
  LatLon,
  LayerDefinition,
  LayerId,
  Region,
  ScalarFieldId,
  Spot,
  VectorFieldId,
} from '../domain/models';
import { SettingsStore } from './settings.store';

/** Which spots the ranking lists: all of them, or one coastline region. */
export type RegionFilter = 'all' | Region;

/**
 * What the map and the panels around it are showing: the layer and its overlays, the selected
 * spot, the spot under the pointer, the ranking's region filter and the point being inspected.
 *
 * The layer and overlay toggles are remembered between visits, so `SettingsStore` owns them and
 * this store reads and writes them through it. Components still come here for everything about the
 * map and never need to know which choices happen to be saved. The rest is per visit: a selection
 * or an inspected point would be surprising to find again on the next one.
 */
@Injectable({ providedIn: 'root' })
export class MapUiStore {
  private readonly settings = inject(SettingsStore);
  private readonly spots = inject(SPOT_CATALOG);

  private readonly selectedId = signal<string | null>(null);
  private readonly hoveredId = signal<string | null>(null);
  private readonly region = signal<RegionFilter>('all');
  private readonly inspected = signal<LatLon | null>(null);

  readonly activeLayer = computed<LayerId>(() => this.settings.mapPreferences().layer);
  readonly particlesOn = computed(() => this.settings.mapPreferences().particlesOn);
  readonly spotsOn = computed(() => this.settings.mapPreferences().spotsOn);
  readonly selectedSpotId = this.selectedId.asReadonly();
  readonly selectedSpot = computed<Spot | null>(
    () => this.spots.find((spot) => spot.id === this.selectedId()) ?? null,
  );
  /**
   * The spot under the pointer (or keyboard focus) in the ranking or on the map, so the other one
   * can highlight it too.
   */
  readonly hoveredSpotId = this.hoveredId.asReadonly();
  readonly regionFilter = this.region.asReadonly();
  /** The map point whose forecast readout is open, or `null`. */
  readonly inspectedPoint = this.inspected.asReadonly();

  /** What the active layer draws: a forecast field with its palette and particles, or depth. */
  readonly activeLayerDefinition = computed<LayerDefinition>(() => LAYERS[this.activeLayer()]);
  readonly isDepth = computed(() => this.activeLayerDefinition().kind === 'depth');
  /** The gridded field the colour layer draws, or `null` on the depth layer. */
  readonly activeFieldKey = computed<ScalarFieldId | null>(() => {
    const layer = this.activeLayerDefinition();
    return layer.kind === 'field' ? layer.field : null;
  });
  /** The vectors the particles follow, or `null` on the depth layer. */
  readonly activeVectorKey = computed<VectorFieldId | null>(() => {
    const layer = this.activeLayerDefinition();
    return layer.kind === 'field' ? layer.vectors : null;
  });

  setLayer(layer: LayerId): void {
    this.settings.updateMapPreferences({ layer });
  }

  toggleParticles(): void {
    this.settings.updateMapPreferences({ particlesOn: !this.particlesOn() });
  }

  toggleSpots(): void {
    this.settings.updateMapPreferences({ spotsOn: !this.spotsOn() });
  }

  /** Selects a spot by id. An id that is not in the catalog is ignored. */
  selectSpot(id: string): void {
    if (this.spots.some((spot) => spot.id === id)) this.selectedId.set(id);
  }

  clearSelection(): void {
    this.selectedId.set(null);
  }

  /** Highlights a spot by id, or nothing with `null`. An id that is not in the catalog is ignored. */
  hoverSpot(id: string | null): void {
    if (id === null || this.spots.some((spot) => spot.id === id)) this.hoveredId.set(id);
  }

  setRegionFilter(filter: RegionFilter): void {
    this.region.set(filter);
  }

  inspect(point: LatLon): void {
    this.inspected.set(point);
  }

  clearInspection(): void {
    this.inspected.set(null);
  }
}
