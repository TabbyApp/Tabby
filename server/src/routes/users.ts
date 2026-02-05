import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

function genId() {
  return crypto.randomUUID();
}

// Get current user profile
usersRouter.get('/me', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const user = db.prepare(
    'SELECT id, email, name, created_at FROM users WHERE id = ?'
  ).get(userId) as { id: string; email: string; name: string; created_at: string } | undefined;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const paymentMethods = db.prepare(
    'SELECT id, type, last_four, brand, created_at FROM payment_methods WHERE user_id = ?'
  ).all(userId) as { id: string; type: string; last_four: string; brand: string | null; created_at: string }[];

  res.json({ ...user, paymentMethods });
});

// Add payment method (mock bank/card for prototype)
usersRouter.post('/payment-methods', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { type, lastFour, brand } = req.body;

  if (!type || !lastFour) {
    return res.status(400).json({ error: 'type and lastFour are required' });
  }
  if (!['bank', 'card'].includes(type)) {
    return res.status(400).json({ error: 'type must be bank or card' });
  }
  if (!/^\d{4}$/.test(String(lastFour))) {
    return res.status(400).json({ error: 'lastFour must be 4 digits' });
  }

  const id = genId();
  db.prepare(
    'INSERT INTO payment_methods (id, user_id, type, last_four, brand) VALUES (?, ?, ?, ?, ?)'
  ).run(id, userId, type, lastFour, type === 'card' ? (brand || 'Visa') : null);

  const row = db.prepare('SELECT id, type, last_four, brand, created_at FROM payment_methods WHERE id = ?').get(id);
  res.status(201).json(row);
});
