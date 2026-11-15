/**
 * ESLint configuration.
 *
 * Purpose: apply the Next.js core-web-vitals and TypeScript rule sets to
 * the whole project.
 */
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
   ...nextVitals,
   ...nextTs,
   globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts']),
]);
