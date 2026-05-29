import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default unit-test project: pure-function tests colocated with
    // sources under src/. Rules tests live under tests/rules/ and run
    // via the separate `test:rules` script (slow, emulator-bound).
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
