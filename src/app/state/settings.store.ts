import { computed, effect, Injectable, signal } from '@angular/core';
import {
  HEIGHT_UNITS,
  LAYER_IDS,
  SPEED_UNITS,
  TEMPERATURE_UNITS,
  type LayerId,
  type UnitSettings,
} from '../domain/models';
import { asRecord, booleanOr, oneOf } from './parse';

/** How the map looks, remembered between visits. */
export interface MapPreferences {
  readonly layer: LayerId;
  readonly particlesOn: boolean;
  readonly spotsOn: boolean;
}

/** Everything the app remembers between visits. */
export interface Preferences {
  readonly units: UnitSettings;
  readonly map: MapPreferences;
}

/** A first visit: the units surf reports in Hawaii use, and the waves layer with everything on. */
export const DEFAULT_PREFERENCES: Preferences = {
  units: { height: 'ft', speed: 'kt', temperature: 'f' },
  map: { layer: 'waves', particlesOn: true, spotsOn: true },
};

/**
 * Where preferences are saved. Change the version when `Preferences` changes shape in a way the
 * field-by-field validation below cannot absorb; older records are then ignored.
 */
export const PREFERENCES_STORAGE_KEY = 'glassy.preferences.v1';

/**
 * The user's preferences (display units and how the map looks) and their only owner. Every
 * remembered choice lives in this one signal, so there is one record to validate on load and one
 * `effect()` that saves it; `MapUiStore` reads and writes the map choices through here rather than
 * keeping copies that could drift apart.
 *
 * Preferences are read synchronously when the store is created, so the first render already uses
 * the saved units. Saving is best-effort: when storage is blocked or full the choices still apply
 * for the visit, and a stored value that is missing or invalid falls back to its default on its own
 * without discarding the rest.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly state = signal<Preferences>(readPreferences());

  readonly preferences = this.state.asReadonly();
  readonly units = computed(() => this.state().units);
  readonly mapPreferences = computed(() => this.state().map);

  constructor() {
    effect(() => writePreferences(this.state()));
  }

  /** Picks the display unit for one kind of value, for example `setUnit('speed', 'kmh')`. */
  setUnit<K extends keyof UnitSettings>(kind: K, unit: UnitSettings[K]): void {
    this.state.update((preferences) =>
      preferences.units[kind] === unit
        ? preferences
        : { ...preferences, units: { ...preferences.units, [kind]: unit } },
    );
  }

  /** Changes some of the map preferences. Meant for `MapUiStore`, which owns the map's API. */
  updateMapPreferences(changes: Partial<MapPreferences>): void {
    this.state.update((preferences) => ({
      ...preferences,
      map: { ...preferences.map, ...changes },
    }));
  }
}

function readPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    return stored === null ? DEFAULT_PREFERENCES : parsePreferences(JSON.parse(stored));
  } catch {
    // Storage is blocked (privacy settings, a sandboxed frame) or the record is not JSON.
    return DEFAULT_PREFERENCES;
  }
}

function writePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Blocked or full. The choices still apply until the page closes.
  }
}

/** Keeps each stored value that is valid and replaces the rest with defaults. */
function parsePreferences(stored: unknown): Preferences {
  const record = asRecord(stored);
  const units = asRecord(record['units']);
  const map = asRecord(record['map']);
  const defaults = DEFAULT_PREFERENCES;
  return {
    units: {
      height: oneOf(HEIGHT_UNITS, units['height']) ?? defaults.units.height,
      speed: oneOf(SPEED_UNITS, units['speed']) ?? defaults.units.speed,
      temperature: oneOf(TEMPERATURE_UNITS, units['temperature']) ?? defaults.units.temperature,
    },
    map: {
      layer: oneOf(LAYER_IDS, map['layer']) ?? defaults.map.layer,
      particlesOn: booleanOr(map['particlesOn'], defaults.map.particlesOn),
      spotsOn: booleanOr(map['spotsOn'], defaults.map.spotsOn),
    },
  };
}
