// @ts-check
const eslint = require('@eslint/js');
const { defineConfig, globalIgnores } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');
const prettier = require('eslint-config-prettier/flat');

/**
 * Layer boundaries. Each layer lists the other layers it may import from.
 * Anything not listed is a lint error. See src/app/<layer>/README.md.
 */
const LAYER_IMPORTS = {
  domain: [],
  core: ['domain'],
  data: ['domain', 'core'],
  state: ['domain', 'data', 'core'],
  map: ['domain', 'state', 'core'],
  features: ['domain', 'state', 'shared', 'core'],
  shared: ['domain'],
};
const LAYERS = Object.keys(LAYER_IMPORTS);

/** The snapshot contract in shared/ at the repository root, imported through a tsconfig alias. */
const SHARED_CONTRACT = '@glassy/shared';

/** The app may not import the backend ingest (ADR-0010). Part of every rule for src/. */
const noBackendImports = {
  // Any relative import that climbs out into backend/.
  regex: '^(?:\\.\\./)+backend(?:/|$)',
  message: `The app may not import from backend/ (ADR-0010). Contract code lives in shared/ (${SHARED_CONTRACT}).`,
};

/**
 * The import patterns a layer may not use.
 * @param {keyof typeof LAYER_IMPORTS} layer
 */
function layerPatterns(layer) {
  const allowed = LAYER_IMPORTS[layer];
  const forbidden = LAYERS.filter((other) => other !== layer && !allowed.includes(other));
  const rule = allowed.length
    ? `${layer}/ may only import from ${allowed.map((l) => `${l}/`).join(', ')}.`
    : `${layer}/ may not import from other layers.`;

  /** @type {Array<{ regex: string; message: string }>} */
  const patterns = [
    {
      // Any relative import that passes through a forbidden layer folder.
      regex: `^\\.{1,2}/(?:.*/)?(?:${forbidden.join('|')})(?:/|$)`,
      message: `${rule} See src/app/${layer}/README.md.`,
    },
    noBackendImports,
  ];

  if (layer === 'domain') {
    patterns.push({
      // Bare module specifiers: @angular/*, rxjs, leaflet and every other package. The snapshot
      // contract is plain TypeScript too.
      regex: `^(?!\\.{1,2}/|vitest$|${SHARED_CONTRACT}$)`,
      message:
        'domain/ is plain TypeScript with no dependencies (no @angular/*, rxjs, leaflet or other packages).',
    });
  }

  return patterns;
}

/** @param {keyof typeof LAYER_IMPORTS} layer */
function layerBoundary(layer) {
  return {
    name: `glassy/layer-boundary/${layer}`,
    files: [`src/app/${layer}/**/*.ts`],
    rules: {
      'no-restricted-imports': ['error', { patterns: layerPatterns(layer) }],
    },
  };
}

/**
 * The map's canvas renderers take plain data and callbacks, so they can move into a Web Worker. This
 * keeps the map layer's boundary and also rules out every package (Angular, Leaflet, RxJS).
 */
const frameworkFreeRenderers = {
  name: 'glassy/framework-free/map-renderers',
  files: ['src/app/map/renderers/**/*.ts'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          ...layerPatterns('map'),
          {
            regex: '^(?!\\.{1,2}/|vitest$)',
            message:
              'map/renderers/ is framework-free (no @angular/*, leaflet, rxjs or other packages), so it can run in a Web Worker.',
          },
        ],
      },
    ],
  },
};

/**
 * End-to-end specs take `test` and `expect` from e2e/support/test.ts, whose fixture runs every page
 * offline against the recorded network, so no spec can reach a live service by accident.
 */
const e2eSharedFixture = {
  name: 'glassy/e2e/shared-fixture',
  files: ['e2e/**/*.spec.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@playwright/test',
            message:
              "Import test and expect from './support/test', which serves the recorded network and pins the clock.",
            allowTypeImports: true,
          },
        ],
      },
    ],
  },
};

/**
 * Code ownership between the app, the backend ingest and the snapshot contract (ADR-0010, #42).
 * shared/ is the only code both sides use. It is a flat folder, so allowing only `./` imports keeps
 * it free of packages, Node built-ins, and app or backend code.
 */
const packageBoundaries = [
  {
    name: 'glassy/package-boundary/shared',
    files: ['shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\./)',
              message:
                'shared/ is the snapshot contract: it imports only from shared/ itself (no packages, node:, app or backend code). See shared/README.md.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'glassy/package-boundary/backend',
    files: ['backend/**/*.ts', 'backend/**/*.mts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Any relative import that climbs out into the app's src/.
              regex: '^(?:\\.\\./)+src(?:/|$)',
              message: `backend/ may not import from src/. Contract code lives in shared/ (${SHARED_CONTRACT}).`,
            },
            {
              regex: '^(?:@angular/|rxjs(?:/|$)|leaflet$)',
              message: 'backend/ runs in Node, without Angular, RxJS or Leaflet.',
            },
          ],
        },
      ],
    },
  },
  {
    // The layer boundaries replace this for src/app/<layer>/, and include the same pattern.
    name: 'glassy/package-boundary/app',
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [noBackendImports] }],
    },
  },
];

module.exports = defineConfig([
  globalIgnores([
    'dist/',
    'coverage/',
    '.angular/',
    'prototype/',
    'playwright-report/',
    'test-results/',
    // The CDK app is a separate package with its own tooling.
    'infra/',
  ]),
  {
    files: ['**/*.ts', '**/*.mts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'glassy',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'glassy',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  ...packageBoundaries,
  ...LAYERS.map((layer) => layerBoundary(/** @type {keyof typeof LAYER_IMPORTS} */ (layer))),
  // After the layer boundaries: for these files it replaces the map's rule with a stricter one.
  frameworkFreeRenderers,
  e2eSharedFixture,
  prettier,
]);
