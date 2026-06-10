import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true,
    // Services are pure-logic unit tests for now; no DB setup required.
    // As DB-backed tests are added, gate them behind a TEST_DATABASE_URL.
  },
});
