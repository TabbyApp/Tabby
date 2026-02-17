import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Prevent Tesseract/native errors (e.g. "Error attempting to read image") from crashing the server
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server stays up):', err?.message || err);
});

import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { bootstrapRouter } from './routes/bootstrap.js';
import { groupsRouter } from './routes/groups.js';
import { invitesRouter } from './routes/invites.js';
import { plaidRouter } from './routes/plaid.js';
import { receiptsRouter } from './routes/receipts.js';
import { transactionsRouter, runFallbackForTransaction } from './routes/transactions.js';
import { query, pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Request timing - log slow API calls with per-step breakdown
app.use('/api', (req, res, next) => {
  const start = Date.now();
  (res as any).__timingStart = start;
  res.on('finish', () => {
    const total = Date.now() - start;
    if (total > 100) {
      const authMs = (res as any).__timingAuthDone != null ? (res as any).__timingAuthDone - start : null;
      const handlerMs = authMs != null ? total - authMs : null;
      console.warn(
        `[slow] ${req.method} ${req.path} ${total}ms` +
        (authMs != null ? ` (auth=${authMs}ms handler=${handlerMs}ms)` : '')
      );
    }
  });
  next();
});

// Receipt uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/bootstrap', bootstrapRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/invites', invitesRouter);
app.use('/api/plaid', plaidRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/transactions', transactionsRouter);

// Global error handler - prevents unhandled rejections from crashing the server
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : 'Internal server error';
  if (msg.includes('PNG or JPG')) {
    return res.status(400).json({ error: msg });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: msg });
});

// Health check: DB connectivity
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(503).json({ ok: false, db: 'disconnected', error: (err as Error)?.message });
  }
});

// Block startup until DB is connected - ensures first request isn't slow
async function start() {
  try {
    await pool.query('SELECT 1');
    console.log('DB connected');
  } catch (err) {
    console.error('DB connection failed:', (err as Error)?.message);
    process.exit(1);
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Timer: every 30s check for expired PENDING_ALLOCATION transactions
  setInterval(async () => {
    try {
      const { rows } = await query<{ id: string }>(`
        SELECT id FROM transactions
        WHERE status = 'PENDING_ALLOCATION' AND allocation_deadline_at IS NOT NULL
        AND allocation_deadline_at <= now()
      `);
      for (const r of rows) {
        await runFallbackForTransaction(r.id);
        console.log('[Timer] Fallback-even applied for transaction', r.id);
      }
    } catch (err) {
      console.error('[Timer] Error:', err);
    }
  }, 30_000);
  });
}

start();
