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
  ];

  if (layer === 'domain') {
    patterns.push({
      // Bare module specifiers: @angular/*, rxjs, leaflet and every other package.
      regex: '^(?!\\.{1,2}/|vitest$)',
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
    files: ['**/*.ts'],
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
  ...LAYERS.map((layer) => layerBoundary(/** @type {keyof typeof LAYER_IMPORTS} */ (layer))),
  // After the layer boundaries: for these files it replaces the map's rule with a stricter one.
  frameworkFreeRenderers,
  e2eSharedFixture,
  prettier,
]);
