import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '.pnpm-store/**',
      'local/**',
      '*.config.js',
      '*.config.ts',
      'knip.ts',
      'vitest.setup.ts',
    ],
  },

  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript configuration
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked, eslintConfigPrettier],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Temporarily disabled rules - gradually enable and fix
      // TODO: Enable these rules one by one and fix violations
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/await-thenable': 'off',
    },
  }
);
