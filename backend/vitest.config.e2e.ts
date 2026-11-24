import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['test/support/e2e-setup.ts'],
    globalSetup: ['test/support/e2e-global.ts'],
  },
});
