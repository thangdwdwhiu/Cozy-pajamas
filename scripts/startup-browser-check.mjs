import 'dotenv/config';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { cpSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';

// Runs the built Next server against a new, disposable LOCAL database.
const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Local database required');
const name = 'cozy_server_test_' + randomBytes(6).toString('hex');
url.pathname = '/postgres';
const admin = new Client({ connectionString: url.toString() });
await admin.connect();
let child, client;
let output = '';
try {
  await admin.query(`CREATE DATABASE ${name}`);
  url.pathname = '/' + name;
  cpSync('drizzle', '.next/standalone/drizzle', { recursive: true });
  child = spawn(process.execPath, ['.next/standalone/server.js'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '3098',
      HOSTNAME: '127.0.0.1',
      DATABASE_URL: url.toString(),
      DIRECT_DATABASE_URL: '',
      AUTO_MIGRATE: 'true',
      ADMIN_EMAIL: 'startup@example.test',
      ADMIN_PASSWORD: 'startup-password-only-123',
      APP_URL: 'http://127.0.0.1:3098',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => {
    output += data.toString();
  });
  child.stderr.on('data', (data) => {
    output += data.toString();
  });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch('http://127.0.0.1:3098/', { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for startup. */
    }
    await sleep(500);
  }
  assert.ok(ready, 'Standalone server did not become ready: ' + output);
  assert.match(output, /\[database\] Ready:/);
  client = new Client({ connectionString: url.toString() });
  await client.connect();
  assert.equal(
    (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rowCount,
    16,
  );
  assert.equal((await client.query("SELECT id FROM users WHERE role='ADMIN'")).rowCount, 1);
  assert.equal((await client.query('SELECT id FROM products')).rowCount, 0);
  console.log(
    'PASS: production Next startup creates 16 tables and Admin before serving HTTP, without manual migration or seed.',
  );
} finally {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve));
    child.kill();
    await exited;
  }
  await client?.end();
  await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
}
