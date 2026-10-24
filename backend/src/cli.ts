/**
 * Builds `forecast.json` on a developer's machine: `npm run ingest` or `npm run snapshot:fixtures`
 * from the repository root. See backend/README.md.
 */
import { run, USAGE } from './run';

run(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  if (
    error instanceof TypeError &&
    'code' in error &&
    error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION'
  ) {
    console.error(USAGE);
  }
  process.exitCode = 1;
});
