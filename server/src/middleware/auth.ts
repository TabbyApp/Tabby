import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod';

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

const ACCESS_TOKEN_TTL = process.env.NODE_ENV === 'production' ? '15m' : '7d';

export function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
}

export function signRefreshToken(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
    return decoded.type === 'access' ? decoded : null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as JwtPayload;
    return decoded.type === 'refresh' ? decoded : null;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const start = (res as any).__timingStart != null ? (res as any).__timingStart : Date.now();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  (res as any).__timingAuthDone = Date.now();
  (req as Request & { user: JwtPayload }).user = payload;
  next();
}

// Must be used after requireAuth
export async function requireBankLinked(req: Request, res: Response, next: NextFunction) {
  const { userId } = (req as any).user;
  const { rows } = await query<{ bank_linked?: boolean }>('SELECT bank_linked FROM users WHERE id = $1', [userId]);
  const row = rows[0];
  if (!row || !row.bank_linked) {
    return res.status(403).json({ error: 'Please link your bank account before performing this action' });
  }
  next();
}
