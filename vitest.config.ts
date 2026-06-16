import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/domain/**/*', 'src/app/api/**/*'],
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
