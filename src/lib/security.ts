import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, users, rateLimits } from '@/db/schema';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export function passwordHash(value: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(value, salt, 64).toString('hex');
}
export function passwordValid(value: string, stored: string) {
  const [salt, key] = stored.split(':');
  const actual = scryptSync(value, salt, 64);
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function currentUser() {
  const token = (await cookies()).get('cozy_session')?.value;
  if (!token) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hash(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}
export async function requireUser(admin = false) {
  const user = await currentUser();
  if (!user) throw new Error('Vui lòng đăng nhập');
  if (admin && !['ADMIN', 'STAFF'].includes(user.role)) throw new Error('Không có quyền truy cập');
  return user;
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await db
    .insert(sessions)
    .values({ id: hash(token), userId, expiresAt: new Date(Date.now() + 7 * 86400000) });
  (await cookies()).set('cozy_session', token, {
    httpOnly: true,
    secure: new URL(process.env.APP_URL!).protocol === 'https:',
    sameSite: 'lax',
    path: '/',
    maxAge: 604800,
  });
}
export async function checkOrigin() {
  const h = await headers();
  if (h.get('origin') !== new URL(process.env.APP_URL ?? 'http://localhost:3000').origin)
    throw Error('Nguồn yêu cầu không hợp lệ');
}
export async function rateLimit(key: string, max = 10) {
  const id = hash(key);
  const [r] = await db
    .insert(rateLimits)
    .values({ id, count: 1, resetAt: new Date(Date.now() + 900000) })
    .onConflictDoUpdate({
      target: rateLimits.id,
      set: {
        count: sql`case when ${rateLimits.resetAt} < now() then 1 else ${rateLimits.count}+1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} < now() then now()+interval '15 minutes' else ${rateLimits.resetAt} end`,
      },
    })
    .returning();
  if (r.count > max) throw Error('Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.');
}
