import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run API integration tests sequentially — unstable_dev starts a real process.
    // Use singleThread to avoid port conflicts when running multiple test files.
    singleThread: true,
    testTimeout: 90_000,
    hookTimeout: 90_000,
    include: ['src/__tests__/**/*.test.ts'],
  },
})
