export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PHASE !== 'phase-production-build'
  ) {
    const { ensureDatabaseReady } = await import('./db/startup');
    await ensureDatabaseReady();
  }
}
