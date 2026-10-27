import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/setup/unit.ts'],
          benchmark: { include: [] },
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['tests/setup/integration.ts'],
          testTimeout: 60_000,
          // Perf benchmarks assert the brief §10 targets. Run with `npm run bench`;
          // kept out of `verify` because timings depend on the machine.
          benchmark: { include: ['tests/perf/**/*.bench.ts'] },
        },
      },
    ],
  },
});
