import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'docs-dist/**',
      'docs/.astro/**',
      'coverage/**',
      'test-results/**',
      'node_modules/**',
      'play/ds1/**',
      'docs/src/vendor/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
);
