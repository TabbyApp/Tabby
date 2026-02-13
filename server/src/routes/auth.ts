import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

function genId() {
  return crypto.randomUUID();
}

authRouter.post('/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const id = genId();
  const passwordHash = await bcrypt.hash(password, 10);

  db.prepare(
    'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)'
  ).run(id, email.toLowerCase().trim(), passwordHash, name.trim());

  const accessToken = signAccessToken({ userId: id, email: email.toLowerCase() });
  const refreshToken = signRefreshToken({ userId: id, email: email.toLowerCase() });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(genId(), id, tokenHash, expiresAt);

  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      accessToken,
      expiresIn: 15 * 60,
      user: { id, email: email.toLowerCase(), name: name.trim() },
    });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare(
    'SELECT id, email, password_hash, name FROM users WHERE email = ?'
  ).get(email.toLowerCase()) as { id: string; email: string; password_hash: string; name: string } | undefined;

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)'
  ).run(genId(), user.id, tokenHash, expiresAt);

  res
    .cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({
      accessToken,
      expiresIn: 15 * 60,
      user: { id: user.id, email: user.email, name: user.name },
    });
});

authRouter.post('/refresh', (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  const payload = verifyRefreshToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const row = db.prepare(
    "SELECT id FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime('now')"
  ).get(tokenHash) as { id: string } | undefined;

  if (!row) {
    return res.status(401).json({ error: 'Refresh token expired or revoked' });
  }

  const accessToken = signAccessToken({ userId: payload.userId, email: payload.email });

  res.json({ accessToken, expiresIn: 15 * 60 });
});

authRouter.post('/logout', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
  }
  res.clearCookie('refreshToken').json({ ok: true });
});
