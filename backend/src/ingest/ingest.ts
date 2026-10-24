import type { ForecastSnapshot } from '@glassy/shared';
import { fetchOpenMeteo, NODE_FETCH_DEPS, type FetchDeps } from '../open-meteo/client';
import type { OpenMeteoForecastResponses } from '../open-meteo/types';
import { forecastRequestUrls, type ForecastRequestId } from '../open-meteo/urls';
import { buildSnapshot } from './build-snapshot';
import type { IngestSettings } from './settings';

export interface IngestDeps extends FetchDeps {
  readonly now: () => Date;
}

export const NODE_INGEST_DEPS: IngestDeps = { ...NODE_FETCH_DEPS, now: () => new Date() };

const LABELS: Readonly<Record<ForecastRequestId, string>> = {
  gridMarine: 'grid marine',
  gridWind: 'grid wind',
  spotMarine: 'spot marine',
  spotWeather: 'spot weather',
};

/**
 * Fetches the four Open-Meteo requests in parallel and builds the snapshot from them. It is all or
 * nothing: when any request fails, after its retries, the run fails and there is no snapshot, so a
 * published snapshot never mixes runs or lacks a part.
 *
 * @throws OpenMeteoError when a request fails
 * @throws Error when the responses do not line up with the grid, the catalog or each other
 */
export async function ingest(
  settings: IngestSettings,
  deps: IngestDeps = NODE_INGEST_DEPS,
): Promise<ForecastSnapshot> {
  const urls = forecastRequestUrls(settings, settings.spots);
  const ids = Object.keys(LABELS) as ForecastRequestId[];
  const bodies = await Promise.all(
    ids.map(async (id) => [id, await fetchOpenMeteo(LABELS[id], urls[id], settings, deps)]),
  );
  const fetchedAt = deps.now();
  // The shapes are checked as the snapshot is built, and the snapshot is validated before it is
  // written.
  const responses = Object.fromEntries(bodies) as OpenMeteoForecastResponses;
  return buildSnapshot(responses, { spots: settings.spots, grid: settings.grid, fetchedAt });
}
