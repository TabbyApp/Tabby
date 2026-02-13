import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth, requireBankLinked } from '../middleware/auth.js';

export const groupsRouter = Router();

function genId() {
  return crypto.randomUUID();
}

function addMinutes(date: Date, mins: number): string {
  return new Date(date.getTime() + mins * 60 * 1000).toISOString();
}

function generateCardNumber(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// List user's groups with virtual card info
groupsRouter.get('/', requireAuth, (req, res) => {
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

  res.json(groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: g.member_count,
    cardLastFour: g.card_number_last_four,
    createdAt: g.created_at,
  })));
});

// Create group and unique virtual card
groupsRouter.post('/', requireAuth, requireBankLinked, (req, res) => {
  const { userId } = (req as any).user;
  const { name, memberEmails } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const groupId = genId();
  const cardId = genId();
  const cardLastFour = generateCardNumber();
  const inviteToken = crypto.randomBytes(12).toString('hex');

  db.transaction(() => {
    db.prepare('INSERT INTO groups (id, name, created_by, invite_token) VALUES (?, ?, ?, ?)').run(groupId, name.trim(), userId, inviteToken);
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId);
    db.prepare('INSERT INTO virtual_cards (id, group_id, card_number_last_four) VALUES (?, ?, ?)').run(cardId, groupId, cardLastFour);

    const emails = Array.isArray(memberEmails) ? memberEmails : [];
    for (const email of emails) {
      const e = String(email).trim().toLowerCase();
      if (!e) continue;
      const member = db.prepare('SELECT id FROM users WHERE email = ?').get(e) as { id: string } | undefined;
      if (member && member.id !== userId) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, member.id);
      }
    }
  })();

  const group = db.prepare(`
    SELECT g.id, g.name, g.created_at,
           vc.card_number_last_four,
           (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE g.id = ?
  `).get(groupId) as { id: string; name: string; created_at: string; card_number_last_four: string; member_count: number };

  res.status(201).json({
    ...group,
    memberCount: group.member_count,
    cardLastFour: group.card_number_last_four,
  });
});

// Get single group with members
groupsRouter.get('/:groupId', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;

  const memberCheck = db.prepare(
    'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
  ).get(groupId, userId);

  if (!memberCheck) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const group = db.prepare(`
    SELECT g.id, g.name, g.created_by, g.created_at,
           vc.card_number_last_four, g.invite_token
    FROM groups g
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE g.id = ?
  `).get(groupId) as { id: string; name: string; created_by: string; created_at: string; card_number_last_four: string | null; invite_token: string | null } | undefined;

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  let inviteToken = group.invite_token;
  if (!inviteToken) {
    inviteToken = crypto.randomBytes(12).toString('hex');
    db.prepare('UPDATE groups SET invite_token = ? WHERE id = ?').run(inviteToken, groupId);
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(groupId) as { id: string; name: string; email: string }[];

  res.json({ ...group, members, cardLastFour: group.card_number_last_four, inviteToken });
});

// Join group via invite token (user becomes member immediately)
groupsRouter.post('/join/:token', requireAuth, requireBankLinked, (req, res) => {
  const { userId } = (req as any).user;
  const { token } = req.params;

  const group = db.prepare('SELECT id, name FROM groups WHERE invite_token = ?').get(token) as { id: string; name: string } | undefined;
  if (!group) return res.status(404).json({ error: 'Invalid invite link' });

  db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(group.id, userId);
  res.json({ groupId: group.id, groupName: group.name, joined: true });
});

// Delete group (host only)
groupsRouter.delete('/:groupId', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;

  const group = db.prepare('SELECT created_by FROM groups WHERE id = ?').get(groupId) as { created_by: string } | undefined;
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== userId) return res.status(403).json({ error: 'Only the host can delete this group' });

  db.transaction(() => {
    // Clean up all related data
    const receiptIds = db.prepare('SELECT id FROM receipts WHERE group_id = ?').all(groupId) as { id: string }[];
    for (const r of receiptIds) {
      db.prepare('DELETE FROM item_claims WHERE receipt_item_id IN (SELECT id FROM receipt_items WHERE receipt_id = ?)').run(r.id);
      db.prepare('DELETE FROM receipt_items WHERE receipt_id = ?').run(r.id);
      db.prepare('DELETE FROM receipt_splits WHERE receipt_id = ?').run(r.id);
    }
    db.prepare('DELETE FROM receipts WHERE group_id = ?').run(groupId);

    const txIds = db.prepare('SELECT id FROM transactions WHERE group_id = ?').all(groupId) as { id: string }[];
    for (const t of txIds) {
      db.prepare('DELETE FROM transaction_allocations WHERE transaction_id = ?').run(t.id);
    }
    db.prepare('DELETE FROM transactions WHERE group_id = ?').run(groupId);

    db.prepare('DELETE FROM virtual_cards WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
  })();

  res.json({ ok: true });
});

// Leave group (non-host members only)
groupsRouter.post('/:groupId/leave', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;

  const group = db.prepare('SELECT created_by FROM groups WHERE id = ?').get(groupId) as { created_by: string } | undefined;
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by === userId) return res.status(400).json({ error: 'The host cannot leave the group. Delete it instead.' });

  const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
  if (!member) return res.status(404).json({ error: 'You are not a member of this group' });

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
  res.json({ ok: true });
});

// Remove member from group (host only)
groupsRouter.delete('/:groupId/members/:memberId', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId, memberId } = req.params;

  const group = db.prepare('SELECT created_by FROM groups WHERE id = ?').get(groupId) as { created_by: string } | undefined;
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== userId) return res.status(403).json({ error: 'Only the host can remove members' });
  if (memberId === userId) return res.status(400).json({ error: 'You cannot remove yourself. Delete the group instead.' });

  const member = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, memberId);
  if (!member) return res.status(404).json({ error: 'Member not found in this group' });

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, memberId);
  res.json({ ok: true });
});

// Get virtual cards for user's groups with total spent (completed receipts)
groupsRouter.get('/virtual-cards/list', requireAuth, (req, res) => {
  const { userId } = (req as any).user;

  const cards = db.prepare(`
    SELECT g.id as groupId, g.name as groupName, vc.card_number_last_four as cardLastFour,
           COALESCE(
             (SELECT SUM(
               COALESCE(r.total, (SELECT SUM(price) FROM receipt_items WHERE receipt_id = r.id))
             ) FROM receipts r WHERE r.group_id = g.id AND r.status = 'completed'),
             0
           ) as groupTotal
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `).all(userId) as { groupId: string; groupName: string; cardLastFour: string | null; groupTotal: number }[];

  res.json(cards.map((c) => ({ ...c, active: true, groupTotal: c.groupTotal ?? 0 })));
});

// Create transaction (on receipt upload or manual total entry)
groupsRouter.post('/:groupId/transactions', requireAuth, requireBankLinked, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  const { splitMode } = req.body;

  if (!['EVEN_SPLIT', 'FULL_CONTROL'].includes(splitMode)) {
    return res.status(400).json({ error: 'splitMode must be EVEN_SPLIT or FULL_CONTROL' });
  }

  const memberCheck = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
  if (!memberCheck) return res.status(404).json({ error: 'Group not found' });

  const group = db.prepare('SELECT created_by FROM groups WHERE id = ?').get(groupId) as { created_by: string } | undefined;
  if (!group || group.created_by !== userId) {
    return res.status(403).json({ error: 'Only the group creator can start a payment' });
  }

  const id = genId();
  const deadline = addMinutes(new Date(), 15);
  db.prepare(`
    INSERT INTO transactions (id, group_id, created_by, status, split_mode, allocation_deadline_at)
    VALUES (?, ?, ?, 'PENDING_ALLOCATION', ?, ?)
  `).run(id, groupId, userId, splitMode, deadline);

  const row = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
  res.status(201).json({
    id: row.id,
    group_id: row.group_id,
    created_by: row.created_by,
    status: row.status,
    split_mode: row.split_mode,
    tip_amount: row.tip_amount ?? 0,
    allocation_deadline_at: row.allocation_deadline_at,
    created_at: row.created_at,
  });
});
