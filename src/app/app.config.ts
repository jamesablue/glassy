import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideGlassyConfig } from './core';
import { provideNoaaTileSources } from './data/noaa/noaa-terrain-tile-sources';
import { provideUrlStateSync } from './state';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideGlassyConfig(),
    provideNoaaTileSources(),
    provideUrlStateSync(),
  ],
};
