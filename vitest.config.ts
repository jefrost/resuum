import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'docs/',
        'build.js',
        '**/*.test.ts',
        '**/*.spec.ts'
      ]
    },
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts'
    ]
  },
  resolve: {
    alias: {
      '@': '/src',
      '@/types': '/src/types',
      '@/utils': '/src/utils',
      '@/workers': '/src/workers'
    }
  }
});