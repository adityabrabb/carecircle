/**
 * Vitest configuration.
 *
 * Purpose: run the unit tests in Node with the same "@/..." import alias
 * the application uses.
 */
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
   test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
   },
   resolve: {
      alias: { '@': path.resolve(import.meta.dirname, 'src') },
   },
});
