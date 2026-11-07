import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
const globalDb = globalThis as unknown as { pool: Pool };
export const pool =
  globalDb.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: process.env.VERCEL ? 1 : 10,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 10000,
  });
if (process.env.NODE_ENV !== 'production') globalDb.pool = pool;
export const db = drizzle(pool, { schema });
