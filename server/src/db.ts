import pg from "pg";
const { Pool } = pg;

// Parse NUMERIC/DECIMAL and FLOAT8 as JS numbers (pg returns them as strings by default)
pg.types.setTypeParser(1700, parseFloat); // NUMERIC
pg.types.setTypeParser(701, parseFloat);  // FLOAT8

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 5000,
  min: 2, // Keep 2 warm for parallel bootstrap queries
  max: 20,
  idleTimeoutMillis: 300_000,
  allowExitOnIdle: true,
  keepAlive: true, // Prevent Docker/network from closing idle connections
  keepAliveInitialDelayMillis: 10_000,
});

// Simple helper - logs slow queries (>100ms) for debugging
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params: any[] = []) {
  const start = Date.now();
  const result = await pool.query<T>(text, params);
  const ms = Date.now() - start;
  if (ms > 100) {
    const preview = text.replace(/\s+/g, ' ').slice(0, 80);
    console.warn(`[slow-query] ${ms}ms ${preview}${text.length > 80 ? '...' : ''}`);
  }
  return result;
}

/** Run multiple queries in a transaction. Receives a client with .query. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

