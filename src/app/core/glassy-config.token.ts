import { InjectionToken, makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { DEFAULT_GLASSY_CONFIG, type GlassyConfig } from './glassy-config';

/**
 * The app's {@link GlassyConfig}. It has no default on purpose: the app (or a test) decides the
 * environment with {@link provideGlassyConfig}, and forgetting to do so fails at injection time
 * instead of silently calling the live APIs.
 */
export const GLASSY_CONFIG = new InjectionToken<GlassyConfig>('GLASSY_CONFIG');

/** Provides {@link GLASSY_CONFIG}: the defaults with any `overrides` applied on top. */
export function provideGlassyConfig(overrides: Partial<GlassyConfig> = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: GLASSY_CONFIG, useValue: { ...DEFAULT_GLASSY_CONFIG, ...overrides } },
  ]);
}
