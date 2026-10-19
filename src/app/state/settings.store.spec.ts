import { TestBed } from '@angular/core/testing';
import { DEFAULT_PREFERENCES, PREFERENCES_STORAGE_KEY, SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  const store = (stored?: string): SettingsStore => {
    if (stored !== undefined) localStorage.setItem(PREFERENCES_STORAGE_KEY, stored);
    return TestBed.inject(SettingsStore);
  };
  const saved = (): unknown => JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? 'null');

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with feet, knots, Fahrenheit and the waves layer on a first visit', () => {
    const settings = store();
    expect(settings.units()).toEqual({ height: 'ft', speed: 'kt', temperature: 'f' });
    expect(settings.mapPreferences()).toEqual({ layer: 'waves', particlesOn: true, spotsOn: true });
    expect(settings.preferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('restores saved preferences', () => {
    const preferences = {
      units: { height: 'm', speed: 'kmh', temperature: 'c' },
      map: { layer: 'depth', particlesOn: false, spotsOn: false },
    };
    expect(store(JSON.stringify(preferences)).preferences()).toEqual(preferences);
  });

  it('keeps each valid saved value and replaces the others with defaults', () => {
    const settings = store(
      JSON.stringify({
        units: { height: 'm', speed: 'furlongs', temperature: 7 },
        map: { layer: 'clouds', particlesOn: false, spotsOn: 'yes' },
      }),
    );
    expect(settings.preferences()).toEqual({
      units: { height: 'm', speed: 'kt', temperature: 'f' },
      map: { layer: 'waves', particlesOn: false, spotsOn: true },
    });
  });

  it.each(['not json', '42', 'null', '[]', '{"units":[],"map":"depth"}'])(
    'ignores a saved record that is not an object of preferences: %s',
    (stored) => {
      expect(store(stored).preferences()).toEqual(DEFAULT_PREFERENCES);
    },
  );

  it('saves every change', () => {
    const settings = store();
    settings.setUnit('speed', 'mph');
    settings.updateMapPreferences({ layer: 'wind', spotsOn: false });
    TestBed.tick();

    expect(saved()).toEqual({
      units: { height: 'ft', speed: 'mph', temperature: 'f' },
      map: { layer: 'wind', particlesOn: true, spotsOn: false },
    });
  });

  it('changes one unit at a time', () => {
    const settings = store();
    settings.setUnit('height', 'm');
    settings.setUnit('temperature', 'c');
    expect(settings.units()).toEqual({ height: 'm', speed: 'kt', temperature: 'c' });
  });

  it('does not notify unit readers when a unit is set to its current value', () => {
    const settings = store();
    const before = settings.units();
    settings.setUnit('speed', 'kt');
    settings.updateMapPreferences({ particlesOn: false });
    expect(settings.units()).toBe(before);
  });

  it('starts from defaults when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(store().preferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps working when storage cannot be written', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    const settings = store();
    settings.setUnit('height', 'm');

    expect(() => TestBed.tick()).not.toThrow();
    expect(setItem).toHaveBeenCalled();
    expect(settings.units().height).toBe('m');
  });
});
