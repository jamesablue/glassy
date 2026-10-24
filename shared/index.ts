/**
 * The snapshot contract between the backend ingest and the app: the snapshot's types, format
 * version and validation, the forecast grid and the spot catalog. Plain TypeScript with no imports
 * from outside this folder (no Angular, AWS or Node), so the browser and Node can both use it.
 * See README.md.
 */
export * from './catalog-fingerprint';
export * from './grid';
export * from './snapshot';
export * from './spots';
export * from './variables';
