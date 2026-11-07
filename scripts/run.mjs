import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
const mode = process.argv[2] ?? 'dev';
if (mode === 'start') {
  if (!existsSync('.next/standalone/server.js')) throw Error('Run npm run build before npm start');
  cpSync('public', '.next/standalone/public', { recursive: true });
  cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
  cpSync('drizzle', '.next/standalone/drizzle', { recursive: true });
}
const appArgs =
  mode === 'start' ? ['.next/standalone/server.js'] : ['node_modules/next/dist/bin/next', mode];
const children = [
  spawn(process.execPath, appArgs, {
    stdio: 'inherit',
    env: { ...process.env, HOSTNAME: '127.0.0.1', UPLOAD_DIR: resolve('uploads') },
  }),
  spawn(
    process.execPath,
    [...(existsSync('.env') ? ['--env-file=.env'] : []), 'scripts/worker.mjs'],
    { stdio: 'inherit' },
  ),
];
function stop() {
  for (const child of children) child.kill();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children)
  child.on('exit', (code) => {
    stop();
    process.exitCode = code ?? 0;
  });
