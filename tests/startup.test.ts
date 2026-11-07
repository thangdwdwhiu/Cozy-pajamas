import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { randomBytes } from 'node:crypto';
import { migrateDatabase } from '../src/db/startup';

test('startup creates an empty database schema concurrently, then preserves data and admin password', async () => {
  const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL!);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Database tests require localhost');
  const name = 'cozy_bootstrap_test_' + randomBytes(6).toString('hex');
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  let client: Client | undefined;
  try {
    await admin.query(`CREATE DATABASE ${name}`);
    url.pathname = '/' + name;
    const options = {
      connectionString: url.toString(),
      adminEmail: 'startup@example.test',
      adminPassword: 'test-password-only-123',
    };
    const results = await Promise.all([migrateDatabase(options), migrateDatabase(options)]);
    assert.equal(results.filter((r) => r.applied > 0).length, 1);
    client = new Client({ connectionString: url.toString() });
    await client.connect();
    const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'");
    assert.equal(tables.rowCount, 16);
    await client.query("INSERT INTO categories (id,name,slug) VALUES ('keep','Giữ lại','giu-lai')");
    const password = (await client.query('SELECT password FROM users')).rows[0].password;
    assert.equal(
      (await migrateDatabase({ ...options, adminPassword: 'changed-password-456' })).applied,
      0,
    );
    assert.equal((await client.query('SELECT password FROM users')).rows[0].password, password);
    assert.equal((await client.query("SELECT id FROM categories WHERE id='keep'")).rowCount, 1);
  } finally {
    await client?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  }
});
