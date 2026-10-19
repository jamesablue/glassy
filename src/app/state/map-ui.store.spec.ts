import { TestBed } from '@angular/core/testing';
import { LAYER_IDS, type LayerId } from '../domain/models';
import { MapUiStore } from './map-ui.store';
import { SettingsStore } from './settings.store';

describe('MapUiStore', () => {
  let mapUi: MapUiStore;
  let settings: SettingsStore;

  beforeEach(() => {
    localStorage.clear();
    mapUi = TestBed.inject(MapUiStore);
    settings = TestBed.inject(SettingsStore);
  });

  it('starts on the waves layer with particles and spots on, and nothing selected', () => {
    expect(mapUi.activeLayer()).toBe('waves');
    expect(mapUi.particlesOn()).toBe(true);
    expect(mapUi.spotsOn()).toBe(true);
    expect(mapUi.selectedSpotId()).toBeNull();
    expect(mapUi.selectedSpot()).toBeNull();
    expect(mapUi.regionFilter()).toBe('all');
    expect(mapUi.inspectedPoint()).toBeNull();
  });

  describe('layer and overlays', () => {
    it('switches layers through the saved preferences', () => {
      mapUi.setLayer('period');
      expect(mapUi.activeLayer()).toBe('period');
      expect(settings.mapPreferences().layer).toBe('period');
    });

    it('follows the saved preferences', () => {
      settings.updateMapPreferences({ layer: 'wind', particlesOn: false });
      expect(mapUi.activeLayer()).toBe('wind');
      expect(mapUi.particlesOn()).toBe(false);
    });

    it('toggles particles and spots', () => {
      mapUi.toggleParticles();
      mapUi.toggleSpots();
      expect(mapUi.particlesOn()).toBe(false);
      expect(mapUi.spotsOn()).toBe(false);
      expect(settings.mapPreferences()).toEqual({
        layer: 'waves',
        particlesOn: false,
        spotsOn: false,
      });

      mapUi.toggleParticles();
      expect(mapUi.particlesOn()).toBe(true);
    });

    it.each<[LayerId, string, string]>([
      ['wind', 'windSpeed', 'wind'],
      ['waves', 'waveHeight', 'waves'],
      ['swell', 'swellHeight', 'swell'],
      ['period', 'swellPeriod', 'swell'],
    ])('draws the %s layer from %s with %s particles', (layer, field, vectors) => {
      mapUi.setLayer(layer);
      expect(mapUi.isDepth()).toBe(false);
      expect(mapUi.activeFieldKey()).toBe(field);
      expect(mapUi.activeVectorKey()).toBe(vectors);
      expect(mapUi.activeLayerDefinition().kind).toBe('field');
    });

    it('draws no forecast field or particles on the depth layer', () => {
      mapUi.setLayer('depth');
      expect(mapUi.isDepth()).toBe(true);
      expect(mapUi.activeFieldKey()).toBeNull();
      expect(mapUi.activeVectorKey()).toBeNull();
    });

    it('knows what every layer draws', () => {
      for (const layer of LAYER_IDS) {
        mapUi.setLayer(layer);
        expect(mapUi.activeLayerDefinition()).toBeDefined();
      }
    });
  });

  describe('spot selection', () => {
    it('selects a spot from the catalog', () => {
      mapUi.selectSpot('hanauma');
      expect(mapUi.selectedSpotId()).toBe('hanauma');
      expect(mapUi.selectedSpot()?.name).toBe('Hanauma Bay');
    });

    it('ignores an id that is not in the catalog', () => {
      mapUi.selectSpot('hanauma');
      mapUi.selectSpot('atlantis');
      expect(mapUi.selectedSpotId()).toBe('hanauma');
    });

    it('clears the selection', () => {
      mapUi.selectSpot('hanauma');
      mapUi.clearSelection();
      expect(mapUi.selectedSpotId()).toBeNull();
      expect(mapUi.selectedSpot()).toBeNull();
    });

    it('is not remembered between visits', () => {
      mapUi.selectSpot('hanauma');
      expect(JSON.stringify(settings.preferences())).not.toContain('hanauma');
    });
  });

  describe('hovered spot', () => {
    it('starts with nothing highlighted', () => {
      expect(mapUi.hoveredSpotId()).toBeNull();
    });

    it('highlights a spot from the catalog and clears it again', () => {
      mapUi.hoverSpot('hanauma');
      expect(mapUi.hoveredSpotId()).toBe('hanauma');
      mapUi.hoverSpot(null);
      expect(mapUi.hoveredSpotId()).toBeNull();
    });

    it('ignores an id that is not in the catalog', () => {
      mapUi.hoverSpot('hanauma');
      mapUi.hoverSpot('atlantis');
      expect(mapUi.hoveredSpotId()).toBe('hanauma');
    });
  });

  it('filters by region', () => {
    mapUi.setRegionFilter('Windward');
    expect(mapUi.regionFilter()).toBe('Windward');
    mapUi.setRegionFilter('all');
    expect(mapUi.regionFilter()).toBe('all');
  });

  it('opens and closes the point readout', () => {
    mapUi.inspect({ lat: 21.27, lon: -157.69 });
    expect(mapUi.inspectedPoint()).toEqual({ lat: 21.27, lon: -157.69 });
    mapUi.clearInspection();
    expect(mapUi.inspectedPoint()).toBeNull();
  });
});
