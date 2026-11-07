export function assertLivePaymentConfig() {
  if (process.env.PAYMENT_LIVE_ENABLED !== 'true') return;
  const missing = [];
  if (!/^\d{6,30}$/.test(process.env.BANK_ACCOUNT_NUMBER ?? ''))
    missing.push('BANK_ACCOUNT_NUMBER');
  if (!process.env.BANK_ACCOUNT_NAME?.trim()) missing.push('BANK_ACCOUNT_NAME');
  if ((process.env.SEPAY_WEBHOOK_SECRET ?? '').length < 32)
    missing.push('SEPAY_WEBHOOK_SECRET (ít nhất 32 ký tự)');
  if (!process.env.APP_URL?.startsWith('https://')) missing.push('APP_URL HTTPS');
  if ((process.env.SEPAY_TRANSFER_PREFIX ?? 'SEVQR') !== 'SEVQR')
    missing.push('SEPAY_TRANSFER_PREFIX=SEVQR');
  if ((process.env.SEPAY_WEBHOOK_AUTH ?? 'HMAC_SHA256') !== 'HMAC_SHA256')
    missing.push('SEPAY_WEBHOOK_AUTH=HMAC_SHA256');
  if (missing.length) throw Error('Chưa thể bật thanh toán thật. Kiểm tra: ' + missing.join(', '));
}
