import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
async function main() {
  const source = readFileSync(process.argv[2], 'utf8');
  const match = source.match(/postgresql:\/\/postgres:([^@]+)@localhost:5432\/cozy_pajamas/);
  if (!match) throw Error('No supplied local connection');
  const url = new URL(process.env.DATABASE_URL!);
  url.username = 'postgres';
  url.password = match[1];
  url.hostname = 'localhost';
  url.port = '5432';
  url.pathname = '/postgres';
  const c = new Client({ connectionString: url.toString() });
  try {
    await c.connect();
    url.pathname = '/cozy_pajamas';
    const env = readFileSync('.env', 'utf8');
    writeFileSync('.env', env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${url.toString()}"`));
    console.log('Supplied local credentials verified; corrected invalid DATABASE_URL.');
  } finally {
    await c.end();
  }
}
main().catch(() => {
  console.error('Supplied local connection could not be verified.');
  process.exit(1);
});
