import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Lenient baseline for a large existing codebase. The point is to catch real
 * bugs (undeclared vars, unreachable code, bad promises) without drowning in
 * style noise. Tighten rule severities incrementally over time.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**', 'scripts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'writable',
        require: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
      },
    },
    rules: {
      // The codebase uses `any` and `require()` pragmatically — don't fail on them.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      // Surface dead code, but as warnings; ignore intentional `_`-prefixed args.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
);
