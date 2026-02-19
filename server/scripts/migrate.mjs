/**
 * Run Postgres migrations from server/migrations/*.sql
 * Usage: node scripts/migrate.mjs (no tsx needed - works in Docker)
 */
import 'dotenv/config';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const conn = process.env.DATABASE_URL;
  if (!conn) {
    throw new Error('DATABASE_URL is required');
  }
  // Supabase and some hosts use SSL certs Node doesn't trust by default; match main db.ts behavior
  const needRelaxedSSL = process.env.PGSSLMODE === 'require' || conn.includes('supabase');
  const client = new pg.Client({
    connectionString: conn,
    ssl: needRelaxedSSL ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      const name = file;
      const { rows } = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [name]);
      if (rows.length > 0) {
        console.log('Skip (already applied):', name);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
      console.log('Applied:', name);
    }
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
