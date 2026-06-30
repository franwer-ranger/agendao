import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // `server-only` es un módulo "marker" que Next reescribe a vacío en
      // builds de servidor y a un throw en client bundles. En tests no hay
      // bundler que lo reescriba, así que lo apuntamos a un stub vacío.
      'server-only': fileURLToPath(
        new URL('./lib/__test-stubs__/server-only.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
})
