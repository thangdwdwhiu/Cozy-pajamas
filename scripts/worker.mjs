// Run with: node --env-file=.env scripts/worker.mjs
import { setTimeout as sleep } from 'node:timers/promises';
const base = process.env.WORKER_APP_URL ?? process.env.APP_URL ?? 'http://localhost:3000';
const controller = new AbortController();
let stopping = false;
process.on('SIGINT', () => {
  stopping = true;
  controller.abort();
});
process.on('SIGTERM', () => {
  stopping = true;
  controller.abort();
});
if (!process.env.CRON_SECRET) throw Error('CRON_SECRET is required');
async function tick() {
  try {
    const r = await fetch(base + '/api/cron/expire', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.CRON_SECRET },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) console.error('Expiry job failed:', r.status);
    else {
      const result = await r.json();
      if (result.expired) console.log('Expired orders processed:', result.expired);
    }
  } catch {
    console.error('Expiry job cannot reach application');
  }
}
console.log('Order expiry worker running every 60 seconds.');
while (!stopping) {
  await tick();
  try {
    await sleep(60000, undefined, { signal: controller.signal });
  } catch {
    break;
  }
}
