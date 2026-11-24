import { defineConfig } from 'orval';

// Generates the typed API client and TanStack Query hooks from the back end's
// Swagger document. Never edit the output by hand: run `npm run api:generate`
// with the back end running. See ENGINEERING_STANDARDS.md §12.
export default defineConfig({
  api: {
    input: { target: 'http://localhost:4000/api/docs-json' },
    output: {
      mode: 'tags-split',
      target: 'src/lib/api/generated',
      schemas: 'src/lib/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      clean: true,
      override: {
        mutator: { path: 'src/lib/api/mutator.ts', name: 'apiFetch' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
