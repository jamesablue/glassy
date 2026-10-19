import type { PlaywrightTestConfig } from '@playwright/test';

/**
 * Settings for merging the CI blob reports into one HTML report (the E2E job in ci.yml). The visual
 * job runs in a container, so its report records a different absolute test directory from the
 * shards'; naming the directory here lets them merge.
 */
const config: PlaywrightTestConfig = {
  testDir: './e2e',
};

export default config;
