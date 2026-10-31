import { defineConfig } from 'vitest/config';

// Um projeto por pacote: npm test na raiz roda todos.
export default defineConfig({
  test: {
    projects: ['packages/tokens', 'packages/api', 'apps/web'],
  },
});
