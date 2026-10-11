import { Probot, Server } from 'probot';
import SmeeClient from 'smee-client';
import app from './app.js';

const server = new Server({
  Probot: Probot.defaults({
    appId: process.env.APP_ID,
    privateKey: process.env.PRIVATE_KEY ? Buffer.from(process.env.PRIVATE_KEY, 'base64').toString('utf8') : undefined,
    secret: process.env.WEBHOOK_SECRET,
  }),
  port: Number(process.env.GITHUB_APP_PORT ?? 3001),
  host: process.env.GITHUB_APP_HOST ?? 'localhost',     // containers set 0.0.0.0
  webhookPath: '/api/github/webhooks',
});
await server.load(app);
await server.start();

// Local development: forward GitHub webhooks from smee.io to this process.
if (process.env.WEBHOOK_PROXY_URL && process.env.NODE_ENV !== 'production') {
  new SmeeClient({ source: process.env.WEBHOOK_PROXY_URL, target: `http://localhost:${process.env.GITHUB_APP_PORT ?? 3001}/api/github/webhooks`, logger: console }).start();
}
