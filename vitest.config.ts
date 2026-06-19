import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Run test files serially: some tests rely on real-time filesystem watching
    // (chokidar SSE) and PTY processes that get starved by concurrent FS-heavy
    // suites, causing flaky timeouts.
    fileParallelism: false,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/domain/**/*', 'src/app/api/**/*', 'src/components/**/*'],
      exclude: [
        'src/bin/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
        'src/domain/ports/**',
      ],
      all: true,
    }
  },
});
