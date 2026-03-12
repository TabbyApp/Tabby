import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-png', 'image/webp'];
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, avatarsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname)?.toLowerCase() || '.jpg';
      cb(null, `${crypto.randomUUID()}${['.png', '.jpg', '.jpeg', '.webp'].includes(ext) ? ext : '.jpg'}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (ALLOWED_MIMES.includes(file.mimetype) ? cb(null, true) : cb(new Error('Please upload PNG, JPG or WebP'))),
});

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
    date_of_birth: string | null;
    onboarding_completed: boolean;
    payment_methods_json: string | null;
  }>(`
    SELECT u.id, u.email, u.name, COALESCE(u.phone, '') as phone, u.created_at, COALESCE(u.bank_linked, false) as bank_linked,
           u.date_of_birth, COALESCE(u.onboarding_completed, false) as onboarding_completed,
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
    dateOfBirth: row.date_of_birth,
    onboardingCompleted: !!row.onboarding_completed,
    paymentMethods: paymentMethods.filter((p) => p != null),
  });
});

// Update profile (name, email, phone, date of birth, onboarding completion)
usersRouter.patch('/me', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { name, email, phone, dateOfBirth, onboardingCompleted } = req.body;

  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];
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
  if (dateOfBirth !== undefined) {
    const normalizedDob = typeof dateOfBirth === 'string' ? dateOfBirth.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDob)) {
      return res.status(400).json({ error: 'dateOfBirth must be in YYYY-MM-DD format' });
    }
    updates.push(`date_of_birth = $${paramIdx++}`);
    values.push(normalizedDob);
  }
  if (typeof onboardingCompleted === 'boolean') {
    updates.push(`onboarding_completed = $${paramIdx++}`);
    values.push(onboardingCompleted);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }
  values.push(userId);
  await query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx}`, values);
  const { rows: updatedRows } = await query<{ id: string; email: string; name: string; phone: string; date_of_birth: string | null; onboarding_completed: boolean }>(
    'SELECT id, email, name, COALESCE(phone, \'\') as phone, date_of_birth, COALESCE(onboarding_completed, false) as onboarding_completed FROM users WHERE id = $1',
    [userId]
  );
  const updated = updatedRows[0];
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    phone: updated.phone,
    dateOfBirth: updated.date_of_birth,
    onboardingCompleted: !!updated.onboarding_completed,
  });
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

// Notification feed: pending invites + recent group activity
usersRouter.get('/notifications', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;

  const { rows: userRows } = await query<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
  const userEmail = userRows[0]?.email?.toLowerCase() ?? '';

  const [inviteRows, receiptRows, paymentRows, joinRows] = await Promise.all([
    userEmail
      ? query<{ id: string; token: string; created_at: string; group_id: string; group_name: string; inviter_name: string }>(`
          SELECT gi.id, gi.token, gi.created_at, gi.group_id,
                 g.name AS group_name,
                 inviter.name AS inviter_name
          FROM group_invites gi
          JOIN groups g ON g.id = gi.group_id
          JOIN users inviter ON inviter.id = gi.inviter_id
          WHERE LOWER(gi.invitee_email) = $1 AND gi.status = 'pending'
          ORDER BY gi.created_at DESC
          LIMIT 20
        `, [userEmail])
      : Promise.resolve({ rows: [] as { id: string; token: string; created_at: string; group_id: string; group_name: string; inviter_name: string }[] }),
    query<{ id: string; created_at: string; total: number | null; group_id: string; group_name: string; uploader_name: string }>(`
      SELECT r.id, r.created_at, r.total, r.group_id,
             g.name AS group_name,
             uploader.name AS uploader_name
      FROM receipts r
      JOIN groups g ON g.id = r.group_id
      JOIN group_members gm ON gm.group_id = r.group_id AND gm.user_id = $1
      JOIN users uploader ON uploader.id = r.uploaded_by
      WHERE r.uploaded_by <> $1
        AND r.status <> 'FAILED'
        AND r.created_at > now() - interval '14 days'
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [userId]),
    query<{ id: string; settled_at: string; group_id: string; group_name: string; amount: number }>(`
      SELECT t.id, t.settled_at, t.group_id,
             g.name AS group_name,
             ta.amount
      FROM transactions t
      JOIN groups g ON g.id = t.group_id
      JOIN transaction_allocations ta ON ta.transaction_id = t.id AND ta.user_id = $1
      JOIN group_members gm ON gm.group_id = t.group_id AND gm.user_id = $1
      WHERE t.status = 'SETTLED'
        AND t.settled_at IS NOT NULL
        AND t.settled_at > now() - interval '14 days'
      ORDER BY t.settled_at DESC
      LIMIT 20
    `, [userId]),
    query<{ id: string; joined_at: string; group_id: string; group_name: string; member_name: string }>(`
      SELECT CONCAT(gm.group_id, ':', gm.user_id) AS id,
             gm.joined_at,
             gm.group_id,
             g.name AS group_name,
             joined_user.name AS member_name
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      JOIN group_members me ON me.group_id = gm.group_id AND me.user_id = $1
      JOIN users joined_user ON joined_user.id = gm.user_id
      WHERE gm.user_id <> $1
        AND gm.joined_at > now() - interval '14 days'
      ORDER BY gm.joined_at DESC
      LIMIT 20
    `, [userId]),
  ]);

  const notifications = [
    ...inviteRows.rows.map((row) => ({
      id: `invite:${row.id}`,
      type: 'invite' as const,
      title: 'Group Invitation',
      message: `${row.inviter_name} invited you to join ${row.group_name}`,
      createdAt: row.created_at,
      groupId: row.group_id,
      groupName: row.group_name,
      inviterName: row.inviter_name,
      inviteToken: row.token,
      source: 'server' as const,
    })),
    ...receiptRows.rows.map((row) => ({
      id: `receipt:${row.id}`,
      type: 'receipt' as const,
      title: 'New Receipt',
      message: `${row.uploader_name} added a receipt to ${row.group_name}${row.total != null ? ` for $${Number(row.total).toFixed(2)}` : ''}`,
      createdAt: row.created_at,
      groupId: row.group_id,
      groupName: row.group_name,
      source: 'server' as const,
    })),
    ...paymentRows.rows.map((row) => ({
      id: `payment:${row.id}`,
      type: 'payment' as const,
      title: 'Payment Processed',
      message: `Your payment of $${Number(row.amount).toFixed(2)} to ${row.group_name} was successful`,
      createdAt: row.settled_at,
      groupId: row.group_id,
      groupName: row.group_name,
      source: 'server' as const,
    })),
    ...joinRows.rows.map((row) => ({
      id: `group:${row.id}`,
      type: 'group' as const,
      title: 'Group Update',
      message: `${row.member_name} joined ${row.group_name}`,
      createdAt: row.joined_at,
      groupId: row.group_id,
      groupName: row.group_name,
      source: 'server' as const,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);

  res.json(notifications);
});

/** Upload profile avatar */
usersRouter.post('/me/avatar', requireAuth, (req, res, next) => {
  avatarUpload.single('file')(req, res, (err: unknown) => {
    if (err) {
      console.error('Avatar upload multer error:', err);
      return next(err);
    }
    next();
  });
}, async (req, res) => {
  const { userId } = (req as any).user;
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    await query('UPDATE users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);
    res.json({ avatarUrl });
  } catch (err) {
    console.error('Avatar save error:', err);
    throw err;
  }
});
