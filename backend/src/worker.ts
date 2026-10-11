import { startQueue } from './db/index.js';

const boss = await startQueue();
await boss.createQueue('ping');
await boss.work('ping', async (jobs) => {
  for (const j of jobs) console.log('job', j.id);
});
console.log('worker ready');
