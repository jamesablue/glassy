/**
 * Serves the production build (`npm run build`) for the end-to-end tests in CI, where it replaces
 * the dev server (see `webServer` in playwright.config.ts): it starts at once, and the tests run
 * against the files that ship. Paths that are not files get `index.html`, as GitHub Pages and
 * CloudFront do, so deep links still open the app.
 *
 * Plain Node with no dependencies, so it runs anywhere the tests do, including the Playwright
 * container: `node e2e/support/serve-build.mts [port]` (Node runs TypeScript files directly).
 */
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../dist/glassy/browser');
const PORT = Number(process.argv[2] ?? process.env['E2E_PORT'] ?? 4300);

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(join(ROOT, 'index.html'))) {
  console.error(`No build in ${ROOT}. Run \`npm run build\` first.`);
  process.exit(1);
}

/** The file a request path names, or `index.html` when it names none (or tries to leave ROOT). */
async function resolveFile(pathname: string): Promise<string> {
  const file = resolve(ROOT, `.${decodeURIComponent(pathname)}`);
  if (!file.startsWith(ROOT + sep)) return join(ROOT, 'index.html');
  const info = await stat(file).catch(() => undefined);
  return info?.isFile() ? file : join(ROOT, 'index.html');
}

createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  resolveFile(pathname)
    .then((file) => {
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).pipe(response);
    })
    .catch((error: unknown) => {
      response.writeHead(500).end(String(error));
    });
}).listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}`);
});
