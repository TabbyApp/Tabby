import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const groupsRouter = Router();

function genId() {
  return crypto.randomUUID();
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
groupsRouter.post('/', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { name, memberEmails } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const groupId = genId();
  const cardId = genId();
  const cardLastFour = generateCardNumber();

  db.transaction(() => {
    db.prepare('INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)').run(groupId, name.trim(), userId);
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
           vc.card_number_last_four
    FROM groups g
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE g.id = ?
  `).get(groupId) as { id: string; name: string; created_by: string; created_at: string; card_number_last_four: string | null } | undefined;

  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(groupId) as { id: string; name: string; email: string }[];

  res.json({ ...group, members, cardLastFour: group.card_number_last_four });
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
