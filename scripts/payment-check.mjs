import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
const file = process.argv[2] ?? '.env';
const env = parse(readFileSync(file));
const checks = [
  ['APP_URL', /^https?:\/\//.test(env.APP_URL ?? '')],
  ['BANK_ACCOUNT_NUMBER', /^\d{6,30}$/.test(env.BANK_ACCOUNT_NUMBER ?? '')],
  ['BANK_ACCOUNT_NAME', Boolean(env.BANK_ACCOUNT_NAME?.trim())],
  ['SEPAY_TRANSFER_PREFIX', (env.SEPAY_TRANSFER_PREFIX ?? 'SEVQR') === 'SEVQR'],
  ['SEPAY_WEBHOOK_AUTH', (env.SEPAY_WEBHOOK_AUTH ?? 'HMAC_SHA256') === 'HMAC_SHA256'],
  ['SEPAY_WEBHOOK_SECRET', (env.SEPAY_WEBHOOK_SECRET ?? '').length >= 32],
  ['CRON_SECRET', (env.CRON_SECRET ?? '').length >= 32],
];
for (const [key, valid] of checks) console.log(`${valid ? 'OK' : 'NEEDS CONFIGURATION'}: ${key}`);
console.log(
  'SEPAY_API_TOKEN: ' +
    (env.SEPAY_API_TOKEN
      ? 'configured (not used for webhook authentication)'
      : 'not configured (not required by webhook receiver)'),
);
console.log('PAYMENT_LIVE_ENABLED: ' + (env.PAYMENT_LIVE_ENABLED === 'true' ? 'true' : 'false'));
try {
  const url = new URL(env.APP_URL);
  if (url.username || url.password) throw Error('Invalid public URL');
  console.log('Webhook URL: ' + url.origin + '/api/webhooks/sepay');
  if (url.protocol !== 'https:')
    console.log('Local HTTP is not a public SePay callback. Deploy HTTPS before live use.');
} catch {
  console.log('Webhook URL unavailable: set a valid APP_URL');
}
console.log('Configuration syntax only; no bank transaction or SePay API request was sent.');
if (checks.some(([, valid]) => !valid)) process.exitCode = 1;
