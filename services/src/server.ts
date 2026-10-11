import { buildServices } from './app.js';

await buildServices().listen({ port: Number(process.env.PORT ?? 4100), host: '0.0.0.0' });
