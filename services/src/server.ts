import { buildServices } from './app.js';

// v3-P0.4: never run in production with a missing or default DEMO_ADMIN_TOKEN
if (process.env.NODE_ENV === 'production' && ((process.env.DEMO_ADMIN_TOKEN ?? '').length < 16 || process.env.DEMO_ADMIN_TOKEN === 'dev-admin')) {
  console.error('Refusing to start in production: DEMO_ADMIN_TOKEN must be a random secret of at least 16 characters');
  process.exit(1);
}

await buildServices().listen({ port: Number(process.env.PORT ?? 4100), host: '0.0.0.0' });
