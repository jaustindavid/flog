import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    // Rules tests are emulator-bound and slower than unit tests.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Run files sequentially: the rules-test helpers share a single
    // RulesTestEnvironment, and parallel mutation of seed data
    // between files would create false negatives.
    fileParallelism: false,
  },
});
