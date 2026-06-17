import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
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
