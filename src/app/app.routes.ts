import { Routes } from '@angular/router';

/**
 * Glassy is one screen, so there is one route; the view itself lives in the query string
 * (`UrlStateSync`). Any other path, such as an old or mistyped link, goes back to it with its query
 * kept, instead of failing to match.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', children: [] },
  { path: '**', redirectTo: '' },
];
