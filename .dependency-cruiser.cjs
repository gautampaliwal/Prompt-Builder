/**
 * Architecture boundaries (brief §3). Run with `npm run check:arch`.
 * Dependency direction: features → services → (core, storage); storage → core/schema.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'core-is-pure',
      comment: 'core/ is pure TypeScript: no React, no Dexie, no DOM-bound or app-layer imports.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: {
        path: [
          '^src/(storage|services|features|components|app)/',
          'node_modules/(react|react-dom|react-router|dexie|zustand)/',
        ],
      },
    },
    {
      name: 'ui-does-not-touch-storage',
      comment: 'UI goes through services/; it never imports Dexie or storage/ directly.',
      severity: 'error',
      from: { path: '^src/(features|components|app)/' },
      to: { path: ['^src/storage/', 'node_modules/dexie/'] },
    },
    {
      name: 'dexie-only-in-storage',
      comment: 'Dexie is imported only inside src/storage/.',
      severity: 'error',
      from: { path: '^src/', pathNot: '^src/storage/' },
      to: { path: 'node_modules/dexie/' },
    },
    {
      name: 'services-not-ui',
      comment: 'services/ orchestrate core and storage; they never depend on UI.',
      severity: 'error',
      from: { path: '^src/services/' },
      to: { path: '^src/(features|components|app)/' },
    },
    {
      name: 'storage-only-core-schema',
      comment: 'storage/ may depend on core/schema only, never on UI or services.',
      severity: 'error',
      from: { path: '^src/storage/' },
      to: { path: ['^src/(services|features|components|app)/', '^src/core/(?!schema/)'] },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.test\\.tsx?$' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
