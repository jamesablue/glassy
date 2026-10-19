import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';

import { provideGlassyConfig, provideGlassyErrorHandler } from './core';
import { provideNoaaTileSources } from './data/noaa/noaa-terrain-tile-sources';
import { provideUrlStateSync } from './state';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideGlassyErrorHandler(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideGlassyConfig(),
    provideNoaaTileSources(),
    provideUrlStateSync(),
  ],
};
