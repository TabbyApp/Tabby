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
import { groupsRouter } from './routes/groups.js';
import { receiptsRouter } from './routes/receipts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Receipt uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/receipts', receiptsRouter);

// Global error handler - prevents unhandled rejections from crashing the server
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const msg = err instanceof Error ? err.message : 'Internal server error';
  if (msg.includes('PNG or JPG')) {
    return res.status(400).json({ error: msg });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: msg });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
