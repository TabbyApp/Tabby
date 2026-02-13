import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

function genId() {
  return crypto.randomUUID();
}

// Normalize phone to E.164 (same as groups/auth routes)
function normalizePhone(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length >= 10) return '+' + digits;
  return '';
}

// Get current user profile
usersRouter.get('/me', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const user = db.prepare(
    'SELECT id, email, name, COALESCE(phone, \'\') as phone, created_at, COALESCE(bank_linked, 0) as bank_linked FROM users WHERE id = ?'
  ).get(userId) as { id: string; email: string; name: string; phone: string; created_at: string; bank_linked: number } | undefined;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const paymentMethods = db.prepare(
    'SELECT id, type, last_four, brand, created_at FROM payment_methods WHERE user_id = ?'
  ).all(userId) as { id: string; type: string; last_four: string; brand: string | null; created_at: string }[];

  res.json({ ...user, bank_linked: !!user.bank_linked, paymentMethods });
});

// Update profile (name, email, phone)
usersRouter.patch('/me', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { name, email, phone } = req.body;

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (typeof name === 'string' && name.trim()) {
    updates.push('name = ?');
    values.push(name.trim());
  }
  if (typeof email === 'string' && email.trim()) {
    const emailLower = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(emailLower, userId);
    if (existing) return res.status(400).json({ error: 'Email already in use' });
    updates.push('email = ?');
    values.push(emailLower);
  }
  if (typeof phone === 'string') {
    updates.push('phone = ?');
    values.push(phone.trim());
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  values.push(userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  const updated = db.prepare(
    'SELECT id, email, name, COALESCE(phone, \'\') as phone FROM users WHERE id = ?'
  ).get(userId) as { id: string; email: string; name: string; phone: string };
  res.json(updated);
});

// Stub: link bank (MVP - no Plaid, just marks user as bank_linked)
usersRouter.post('/link-bank', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  db.prepare('UPDATE users SET bank_linked = 1 WHERE id = ?').run(userId);
  // Also add a mock payment method so virtual cards can "charge"
  const existing = db.prepare('SELECT 1 FROM payment_methods WHERE user_id = ? AND type = ?').get(userId, 'bank');
  if (!existing) {
    const id = genId();
    db.prepare(
      'INSERT INTO payment_methods (id, user_id, type, last_four, brand) VALUES (?, ?, ?, ?, ?)'
    ).run(id, userId, 'bank', String(Math.floor(1000 + Math.random() * 9000)), null);
  }
  res.json({ ok: true, bank_linked: true });
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
