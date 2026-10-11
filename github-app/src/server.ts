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

// Local development: forward GitHub webhooks from smee.io to this process. A failed first connection (smee.io down,
// laptop offline) must not kill the app: start() rejects in that case, so retry with backoff instead.
if (process.env.WEBHOOK_PROXY_URL && process.env.NODE_ENV !== 'production') {
  const startSmee = async (attempt = 0): Promise<void> => {
    try {
      await new SmeeClient({ source: process.env.WEBHOOK_PROXY_URL!, target: `http://localhost:${process.env.GITHUB_APP_PORT ?? 3001}/api/github/webhooks`, logger: console }).start();
    } catch (err) {
      const wait = Math.min(60_000, 2000 * 2 ** attempt);
      console.error(`smee: could not connect (${(err as Error).message ?? err}); retrying in ${wait / 1000}s`);
      setTimeout(() => void startSmee(attempt + 1), wait).unref();
    }
  };
  void startSmee();
}
