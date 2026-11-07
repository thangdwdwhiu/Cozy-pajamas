import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = url.pathname.slice(1);
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw Error('Invalid database name');
  url.pathname = '/postgres';
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
  if (!result.rowCount) await client.query(`CREATE DATABASE "${name}"`);
  console.log('PostgreSQL connected; project database ready.');
  await client.end();
  let env = readFileSync('.env', 'utf8');
  for (const [key, value] of Object.entries({
    ADMIN_EMAIL: 'admin@cozypajamas.local',
    ADMIN_PASSWORD: randomBytes(18).toString('base64url'),
    CRON_SECRET: randomBytes(32).toString('hex'),
  }))
    if (!new RegExp(`^${key}=`, 'm').test(env)) appendFileSync('.env', `\n${key}=${value}\n`);
}
main().catch((e) => {
  console.error('Database setup failed.', {
    code: e.code,
    type: e.name,
    reason:
      e.code === '28P01'
        ? 'Authentication failed'
        : e.code === 'ECONNREFUSED'
          ? 'Service unreachable'
          : e.message?.startsWith('Invalid')
            ? e.message
            : 'Check connection configuration',
  });
  process.exit(1);
});
