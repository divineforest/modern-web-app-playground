import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Allow type and interface exports used only within the same file
  // This prevents false positives for type-only exports that are used internally
  ignoreExportsUsedInFile: {
    interface: true,
    type: true,
  },

  // Exclude files/exports tagged with @lintignore from knip analysis
  tags: ['-lintignore'],

  /**
   * Dependencies that are legitimately used but cannot be detected by static analysis
   *
   * - pino-pretty: Used as a pino transport target in logger configuration.
   *   Referenced as a string ('pino-pretty') in src/lib/logger.ts and src/config/server.ts,
   *   so Knip's static analysis cannot detect the import automatically.
   *   This is a runtime dependency loaded by pino's transport system.
   *
   * - gitleaks: CLI tool for secret detection used in npm scripts (secrets, secrets:baseline,
   *   secrets:history). While it's invoked via package.json scripts, Knip treats it as both
   *   a dependency and a binary, requiring it to be listed in both ignoreDependencies and
   *   ignoreBinaries arrays.
   *
   * - @typescript-eslint/eslint-plugin: ESLint plugin re-exported by typescript-eslint package.
   *   Used in eslint.config.js via the unified 'typescript-eslint' package (tseslint.configs.*).
   *   Must be listed as direct devDependency for ESLint peer dependency requirements,
   *   even though we import through the unified package.
   *
   * - @typescript-eslint/parser: ESLint parser re-exported by typescript-eslint package.
   *   Used in eslint.config.js via the unified 'typescript-eslint' package configuration.
   *   Must be listed as direct devDependency for ESLint peer dependency requirements,
   *   even though we import through the unified package.
   */
  ignoreDependencies: [
    'pino-pretty',
    'gitleaks',
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint/parser',
  ],

  /**
   * Binary executables that are legitimately used but not auto-detected
   *
   * - gitleaks: Secret scanning CLI tool executed in npm scripts. Since it's called directly
   *   as a binary (not imported in code), it needs to be explicitly whitelisted here to
   *   prevent "unlisted binaries" warnings.
   */
  ignoreBinaries: ['gitleaks'],

  /**
   * Entry points that are loaded dynamically at runtime
   *
   * - src/shared/workflows/workflows.ts: Temporal worker loads this file via dynamic path string
   *   (new URL('./workflows.ts', import.meta.url).pathname) rather than static import,
   *   so Knip's static analysis cannot detect the usage.
   */
  entry: ['src/shared/workflows/workflows.ts'],
};

export default config;
