import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { join } from 'node:path';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { databaseErrorCode } from '@/lib/api-errors';

type Options = {
  connectionString: string;
  migrationsFolder?: string;
  adminEmail?: string;
  adminPassword?: string;
};
export async function migrateDatabase(options: Options) {
  const url = new URL(options.connectionString);
  if (url.port === '6543')
    throw Error(
      'Tự tạo bảng cần Direct Connection cổng 5432. Điền DIRECT_DATABASE_URL nếu DATABASE_URL đang dùng transaction pooler.',
    );
  const folder = options.migrationsFolder ?? join(process.cwd(), 'drizzle');
  // The official Drizzle migrator reads the same files and migration history as db:migrate.
  const files = readMigrationFiles({ migrationsFolder: folder });
  const client = new Client({
    connectionString: options.connectionString,
    connectionTimeoutMillis: 10000,
    statement_timeout: 60000,
    query_timeout: 65000,
  });
  let locked = false;
  try {
    await client.connect();
    const until = Date.now() + 45000;
    while (!locked) {
      locked = (await client.query('SELECT pg_try_advisory_lock(628479301) AS locked')).rows[0]
        .locked;
      if (!locked) {
        if (Date.now() > until)
          throw Error('Server khác đang cập nhật database. Chờ hoàn tất rồi khởi động lại.');
        await sleep(250);
      }
    }
    const exists = (
      await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS name")
    ).rows[0].name;
    const history = exists
      ? (await client.query('SELECT hash, created_at FROM drizzle.__drizzle_migrations')).rows
      : [];
    for (const row of history) {
      const file = files.find((f) => f.folderMillis === Number(row.created_at));
      if (file && file.hash !== row.hash)
        throw Error(
          'Một migration đã chạy bị sửa nội dung. Khôi phục migration cũ và tạo migration mới; không reset database.',
        );
    }
    await migrate(drizzle(client), { migrationsFolder: folder });
    if (options.adminEmail && options.adminPassword) {
      if (options.adminPassword.length < 12)
        throw Error('ADMIN_PASSWORD cần ít nhất 12 ký tự để khởi tạo Admin.');
      const salt = randomBytes(16).toString('hex');
      const password = salt + ':' + scryptSync(options.adminPassword, salt, 64).toString('hex');
      await client.query(
        'INSERT INTO users (id,email,name,password,role) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING',
        [randomUUID(), options.adminEmail.trim().toLowerCase(), 'Cozy Admin', password, 'ADMIN'],
      );
    }
    return {
      applied: files.filter(
        (f) => !history.some((row) => Number(row.created_at) === f.folderMillis),
      ).length,
      total: files.length,
    };
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock(628479301)');
      } catch {
        /* Closing this connection releases the session lock too. */
      }
    }
    await client.end();
  }
}
export function startupErrorMessage(error: unknown) {
  const code = databaseErrorCode(error);
  const descriptions: Record<string, string> = {
    ENETUNREACH:
      'Không có đường mạng tới Supabase Direct. Máy chạy server cần IPv6 hoặc Supabase IPv4 add-on.',
    ENOTFOUND: 'Không tìm thấy hostname PostgreSQL. Kiểm tra DATABASE_URL.',
    ECONNREFUSED: 'PostgreSQL từ chối kết nối. Kiểm tra host, port và dịch vụ.',
    ETIMEDOUT: 'Kết nối database quá thời gian. Kiểm tra mạng và IP allowlist.',
    '28P01': 'Sai username hoặc mật khẩu database. Kiểm tra URI, URL-encode mật khẩu.',
    '42501':
      'Tài khoản kết nối không có quyền tạo schema/bảng. Cấp quyền migration cho Direct Connection.',
    '42P07':
      'Bảng đã tồn tại nhưng thiếu lịch sử migration tương ứng. Không tự xóa dữ liệu; kiểm tra baseline database.',
    '3D000': 'Database chưa tồn tại. Supabase dùng database có sẵn tên postgres.',
  };
  if (code) return descriptions[code] ?? `Không thể cập nhật database (mã ${code}).`;
  if (
    error instanceof Error &&
    !('cause' in error) &&
    !error.message.includes('postgresql://') &&
    !error.message.startsWith('Failed query:')
  )
    return error.message;
  return 'Không thể cập nhật database. Kiểm tra kết nối và quyền migration; dữ liệu không bị reset.';
}
const globalStartup = globalThis as unknown as { cozyStartup?: Promise<void> };
export async function ensureDatabaseReady() {
  if (process.env.AUTO_MIGRATE === 'false') return;
  globalStartup.cozyStartup ??= (async () => {
    const connectionString =
      process.env.DIRECT_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
    if (!connectionString)
      throw Error('Thiếu DATABASE_URL. Điền Supabase Direct Connection trong cấu hình server.');
    try {
      const result = await migrateDatabase({
        connectionString,
        adminEmail: process.env.ADMIN_EMAIL,
        adminPassword: process.env.ADMIN_PASSWORD,
      });
      console.info(
        `[database] Ready: ${result.applied} migration mới, ${result.total} migration trong phiên bản. Không reset dữ liệu.`,
      );
    } catch (error) {
      throw new Error('[database] ' + startupErrorMessage(error));
    }
  })();
  return globalStartup.cozyStartup;
}
