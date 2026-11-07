import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'dotenv';
const [file, task] = process.argv.slice(2);
if (!file || !['migrate', 'admin', 'seed'].includes(task))
  throw Error('Usage: node scripts/production-db.mjs .env.deploy migrate|admin|seed');
const env = parse(readFileSync(file));
if (!env.DATABASE_URL) throw Error('DATABASE_URL is missing');
const command =
  task === 'migrate'
    ? ['node_modules/drizzle-kit/bin.cjs', 'migrate']
    : [
        'node_modules/tsx/dist/cli.mjs',
        task === 'admin' ? 'scripts/create-admin.ts' : 'scripts/seed.ts',
      ];
const result = spawnSync(process.execPath, command, {
  stdio: 'inherit',
  env: { ...process.env, ...env, DATABASE_URL: env.DIRECT_DATABASE_URL || env.DATABASE_URL },
});
process.exit(result.status ?? 1);
