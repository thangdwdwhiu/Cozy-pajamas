import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const target = process.argv[2] ?? '.env.deploy';
if (!/^\.env(?:\.[a-z0-9-]+)?$/.test(target)) throw Error('Use a filename such as .env.deploy');
if (existsSync(target))
  throw Error('File already exists; existing configuration was not overwritten.');
let contents = readFileSync('.env.example', 'utf8');
for (const key of ['AUTH_SECRET', 'ADMIN_PASSWORD', 'CRON_SECRET', 'SEPAY_WEBHOOK_SECRET'])
  contents = contents.replace(
    new RegExp(`^${key}=.*$`, 'm'),
    `${key}=${randomBytes(32).toString('hex')}`,
  );
writeFileSync(target, contents, { flag: 'wx', mode: 0o600 });
console.log(
  `Created ${target}. Open it in your editor to fill connection details. Secrets were not printed.`,
);
