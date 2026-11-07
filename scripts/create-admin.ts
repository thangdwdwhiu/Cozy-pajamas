import 'dotenv/config';
import { scryptSync, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, pool } from '../src/db';
import { users } from '../src/db/schema';
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw Error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) in the private environment file.',
    );
  const [existing] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.email, email));
  if (existing) {
    if (existing.role !== 'ADMIN')
      throw Error('Email already belongs to a non-admin account; no permissions changed.');
    console.log('Administrator already exists; password unchanged.');
  } else {
    const salt = randomBytes(16).toString('hex');
    await db
      .insert(users)
      .values({
        email,
        name: 'Cozy Admin',
        role: 'ADMIN',
        password: salt + ':' + scryptSync(password, salt, 64).toString('hex'),
      });
    console.log('Administrator created. Credentials remain in the private environment file.');
  }
  await pool.end();
}
main().catch((e) => {
  console.error(
    e instanceof Error && !('code' in e)
      ? e.message
      : 'Administrator setup failed. Check database access.',
  );
  process.exit(1);
});
