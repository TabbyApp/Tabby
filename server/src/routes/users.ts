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
    'SELECT id, email, name, created_at, phone FROM users WHERE id = ?'
  ).get(userId) as { id: string; email: string; name: string; created_at: string; phone: string | null } | undefined;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const paymentMethods = db.prepare(
    'SELECT id, type, last_four, brand, created_at FROM payment_methods WHERE user_id = ?'
  ).all(userId) as { id: string; type: string; last_four: string; brand: string | null; created_at: string }[];

  res.json({ ...user, phone: user.phone ?? undefined, paymentMethods });
});

// Single round-trip dashboard: groups, virtual cards, pending invites (faster home load)
usersRouter.get('/me/dashboard', requireAuth, (req, res) => {
  const { userId } = (req as any).user;

  const groups = db.prepare(`
    SELECT g.id, g.name, g.created_by, g.created_at,
           vc.card_number_last_four,
           (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(userId) as { id: string; name: string; created_by: string; created_at: string; card_number_last_four: string | null; member_count: number }[];

  const cards = db.prepare(`
    SELECT g.id as groupId, g.name as groupName, vc.card_number_last_four as cardLastFour,
           COALESCE(
             (SELECT SUM(COALESCE(r.total, (SELECT SUM(price) FROM receipt_items WHERE receipt_id = r.id)))
              FROM receipts r WHERE r.group_id = g.id AND r.status = 'completed'),
             0
           ) as groupTotal
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(userId) as { groupId: string; groupName: string; cardLastFour: string | null; groupTotal: number }[];

  const userRow = db.prepare('SELECT email, phone FROM users WHERE id = ?').get(userId) as { email: string; phone: string | null } | undefined;
  const email = userRow?.email?.toLowerCase() ?? '';
  const phoneNormalized = userRow?.phone ? normalizePhone(userRow.phone) : '';
  
  // Email-based invites
  const emailInvites = db.prepare(`
    SELECT gi.id as inviteId, gi.token, gi.created_at as createdAt,
           g.name as groupName, u.name as inviterName
    FROM group_invites gi
    JOIN groups g ON gi.group_id = g.id
    JOIN users u ON gi.inviter_id = u.id
    WHERE gi.invitee_email = ? AND gi.status = 'pending'
    ORDER BY gi.created_at DESC
  `).all(email) as { inviteId: string; token: string; createdAt: string; groupName: string; inviterName: string }[];
  
  // Phone-based invites (normalized to E.164)
  const phoneInvites = phoneNormalized ? db.prepare(`
    SELECT pi.id as inviteId, pi.token, pi.created_at as createdAt,
           g.name as groupName, u.name as inviterName
    FROM phone_invites pi
    JOIN groups g ON pi.group_id = g.id
    JOIN users u ON pi.inviter_id = u.id
    WHERE pi.invitee_phone = ? AND pi.status = 'pending'
    ORDER BY pi.created_at DESC
  `).all(phoneNormalized) as { inviteId: string; token: string; createdAt: string; groupName: string; inviterName: string }[] : [];
  
  // Combine and deduplicate
  const allInvites = [...emailInvites, ...phoneInvites];
  const invites = Array.from(
    new Map(allInvites.map((inv) => [inv.token, inv])).values()
  );

  res.json({
    groups: groups.map((g) => ({
      id: g.id,
      name: g.name,
      memberCount: g.member_count,
      cardLastFour: g.card_number_last_four,
      createdAt: g.created_at,
      createdBy: g.created_by,
    })),
    virtualCards: cards.map((c) => ({ ...c, active: true, groupTotal: c.groupTotal ?? 0 })),
    pendingInvites: invites,
  });
});

// Pending invites for current user (email-based and phone-based)
usersRouter.get('/me/invites', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const user = db.prepare('SELECT email, phone FROM users WHERE id = ?').get(userId) as { email: string; phone: string | null } | undefined;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const email = user.email.toLowerCase();
  const phoneNormalized = user.phone ? normalizePhone(user.phone) : '';
  
  // Email-based invites
  const emailInvites = db.prepare(`
    SELECT gi.id as inviteId, gi.token, gi.created_at as createdAt,
           g.name as groupName,
           u.name as inviterName
    FROM group_invites gi
    JOIN groups g ON gi.group_id = g.id
    JOIN users u ON gi.inviter_id = u.id
    WHERE gi.invitee_email = ? AND gi.status = 'pending'
    ORDER BY gi.created_at DESC
  `).all(email) as { inviteId: string; token: string; createdAt: string; groupName: string; inviterName: string }[];
  
  // Phone-based invites (normalized to E.164)
  const phoneInvites = phoneNormalized ? db.prepare(`
    SELECT pi.id as inviteId, pi.token, pi.created_at as createdAt,
           g.name as groupName,
           u.name as inviterName
    FROM phone_invites pi
    JOIN groups g ON pi.group_id = g.id
    JOIN users u ON pi.inviter_id = u.id
    WHERE pi.invitee_phone = ? AND pi.status = 'pending'
    ORDER BY pi.created_at DESC
  `).all(phoneNormalized) as { inviteId: string; token: string; createdAt: string; groupName: string; inviterName: string }[] : [];
  
  // Combine and deduplicate by token (in case same invite exists in both tables)
  const allInvites = [...emailInvites, ...phoneInvites];
  const uniqueInvites = Array.from(
    new Map(allInvites.map((inv) => [inv.token, inv])).values()
  );
  
  res.json(uniqueInvites);
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
