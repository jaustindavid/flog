import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist', 'node_modules', '.firebase', 'coverage'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // AGENTS guardrail: no `any`. Includes catch clauses (use
      // `catch (err: unknown)` plus a type guard).
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Tests can use vitest globals; keep otherwise.
    files: ['tests/**/*.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  }
);
