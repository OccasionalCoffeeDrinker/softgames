// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      /** Enforce explicit return types on public API functions. */
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      /** Prevent accidental floating promises (especially in async lifecycle methods). */
      '@typescript-eslint/no-floating-promises': 'error',
      /** Keep the codebase consistent — no void operator bypasses. */
      '@typescript-eslint/no-confusing-void-expression': 'error',
      /** Disallow unused variables except those prefixed with _. */
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      /**
       * Allow numbers (and booleans) in template literals — common in game code
       * for FPS displays, counters, labels, etc. Strings still required by default.
       */
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    /** Relax rules in test files — stubs and mocks legitimately bypass some constraints. */
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      /** Non-null assertions are legitimate in tests where we control the data. */
      '@typescript-eslint/no-non-null-assertion': 'off',
      /**
       * Inline `it('...', () => expect(...).toBe(...))` arrow functions implicitly
       * return void — this is idiomatic Vitest style, not a real confusion risk.
       */
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    /** Ignore build output and config files. */
    ignores: ['dist/**', 'node_modules/**', 'vite.config.ts', 'eslint.config.js'],
  },
);
