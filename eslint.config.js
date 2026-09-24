import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['build/**', 'node_modules/**', '.react-router/**'],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: {ecmaVersion: 'latest', sourceType: 'module'},
    },
    plugins: {'@typescript-eslint': tseslint},
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
];
