import { Router } from 'express';
import crypto from 'crypto';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

function genId() {
  return crypto.randomUUID();
}

// Get current user profile (single query via JSON aggregation - avoids 2 round-trips)
usersRouter.get('/me', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { rows } = await query<{
    id: string;
    email: string;
    name: string;
    phone: string;
    created_at: string;
    bank_linked: boolean;
    payment_methods_json: string | null;
  }>(`
    SELECT u.id, u.email, u.name, COALESCE(u.phone, '') as phone, u.created_at, COALESCE(u.bank_linked, false) as bank_linked,
           (SELECT json_agg(json_build_object('id', id, 'type', type, 'last_four', last_four, 'brand', brand, 'created_at', created_at))
            FROM payment_methods WHERE user_id = u.id)::text as payment_methods_json
    FROM users u WHERE u.id = $1
  `, [userId]);
  const row = rows[0];

  if (!row) return res.status(404).json({ error: 'User not found' });

  let paymentMethods: { id: string; type: string; last_four: string; brand: string | null; created_at: string }[] = [];
  if (row.payment_methods_json && row.payment_methods_json !== 'null') {
    try {
      const parsed = JSON.parse(row.payment_methods_json);
      paymentMethods = Array.isArray(parsed) ? parsed : (parsed != null ? [parsed] : []);
    } catch { /* fallback empty */ }
  }

  res.json({
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    created_at: row.created_at,
    bank_linked: !!row.bank_linked,
    paymentMethods: paymentMethods.filter((p) => p != null),
  });
});

// Update profile (name, email, phone)
usersRouter.patch('/me', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { name, email, phone } = req.body;

  const updates: string[] = [];
  const values: (string | number)[] = [];
  let paramIdx = 1;

  if (typeof name === 'string' && name.trim()) {
    updates.push(`name = $${paramIdx++}`);
    values.push(name.trim());
  }
  if (typeof email === 'string' && email.trim()) {
    const emailLower = email.trim().toLowerCase();
    const { rows: existingRows } = await query<{ id: string }>('SELECT id FROM users WHERE email = $1 AND id != $2', [emailLower, userId]);
    if (existingRows.length > 0) return res.status(400).json({ error: 'Email already in use' });
    updates.push(`email = $${paramIdx++}`);
    values.push(emailLower);
  }
  if (typeof phone === 'string') {
    updates.push(`phone = $${paramIdx++}`);
    values.push(phone.trim());
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  values.push(userId);
  await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
  const { rows: updatedRows } = await query<{ id: string; email: string; name: string; phone: string }>(
    'SELECT id, email, name, COALESCE(phone, \'\') as phone FROM users WHERE id = $1',
    [userId]
  );
  res.json(updatedRows[0]);
});

// Stub: link bank (MVP - no Plaid, just marks user as bank_linked)
usersRouter.post('/link-bank', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  await query('UPDATE users SET bank_linked = true WHERE id = $1', [userId]);
  // Also add a mock payment method so virtual cards can "charge"
  const { rows: existingRows } = await query<{ id: string }>('SELECT 1 FROM payment_methods WHERE user_id = $1 AND type = $2', [userId, 'bank']);
  if (existingRows.length === 0) {
    const id = genId();
    await query(
      'INSERT INTO payment_methods (id, user_id, type, last_four, brand) VALUES ($1, $2, $3, $4, $5)',
      [id, userId, 'bank', String(Math.floor(1000 + Math.random() * 9000)), null]
    );
  }
  res.json({ ok: true, bank_linked: true });
});

// Add payment method (mock bank/card for prototype)
usersRouter.post('/payment-methods', requireAuth, async (req, res) => {
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
  await query(
    'INSERT INTO payment_methods (id, user_id, type, last_four, brand) VALUES ($1, $2, $3, $4, $5)',
    [id, userId, type, lastFour, type === 'card' ? (brand || 'Visa') : null]
  );
  const { rows } = await query<{ id: string; type: string; last_four: string; brand: string | null; created_at: string }>(
    'SELECT id, type, last_four, brand, created_at FROM payment_methods WHERE id = $1',
    [id]
  );
  res.status(201).json(rows[0]);
});
