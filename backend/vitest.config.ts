import { defineConfig } from 'vitest/config';

// CI runners are slower than laptops (ts-morph, property tests, real HTTP): generous per-test timeout.
export default defineConfig({ test: { testTimeout: 60_000, hookTimeout: 60_000 } });
