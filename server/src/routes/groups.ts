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

// Normalize phone to E.164 (digits; 10 digits => +1)
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length >= 10) return '+' + digits;
  return '';
}

// Helper: send SMS invite for phone invite
async function sendPhoneInviteSMS(phone: string, inviterName: string, groupName: string, inviteLink: string) {
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (twilioAccountSid && twilioAuthToken) {
    try {
      const twilio = (await import('twilio')).default;
      const client = twilio(twilioAccountSid, twilioAuthToken);
      // Use Messaging API (not Verify) for invite links
      const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
      if (twilioFrom) {
        await client.messages.create({
          body: `${inviterName} invited you to join "${groupName}" on Tabby. Join to split bills instantly: ${inviteLink}`,
          from: twilioFrom,
          to: phone,
        });
        return true;
      }
    } catch (err: any) {
      console.error('Failed to send SMS invite:', err?.message);
    }
  }
  return false;
}

// Create group and unique virtual card. Add existing users immediately, create pending invites for non-existing.
groupsRouter.post('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { name, memberPhones } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const inviter = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
  const inviterName = inviter?.name || 'Someone';

  const groupId = genId();
  const cardId = genId();
  const cardLastFour = generateCardNumber();
  const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

  const addedMembers: { phone: string; status: 'joined' | 'invited' }[] = [];
  const smsInvites: { phone: string; link: string }[] = [];

  db.transaction(() => {
    db.prepare('INSERT INTO groups (id, name, created_by) VALUES (?, ?, ?)').run(groupId, name.trim(), userId);
    db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, userId);
    db.prepare('INSERT INTO virtual_cards (id, group_id, card_number_last_four) VALUES (?, ?, ?)').run(cardId, groupId, cardLastFour);

    const phones = Array.isArray(memberPhones) ? memberPhones : [];
    for (const p of phones) {
      const normalized = normalizePhone(String(p).trim());
      if (!normalized) continue;

      const member = db.prepare('SELECT id FROM users WHERE phone = ?').get(normalized) as { id: string } | undefined;
      if (member && member.id !== userId) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(groupId, member.id);
        addedMembers.push({ phone: normalized, status: 'joined' });
      } else {
        // User doesn't exist - create pending invite
        const inviteId = genId();
        const token = crypto.randomBytes(32).toString('hex');
        const inviteLink = `${FRONTEND_BASE}/invite/phone/${token}`;
        db.prepare(
          'INSERT INTO phone_invites (id, group_id, inviter_id, invitee_phone, token, status) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(inviteId, groupId, userId, normalized, token, 'pending');
        addedMembers.push({ phone: normalized, status: 'invited' });
        smsInvites.push({ phone: normalized, link: inviteLink });
      }
    }
  })();

  // Send SMS invites outside transaction (async)
  for (const { phone, link } of smsInvites) {
    sendPhoneInviteSMS(phone, inviterName, name.trim(), link).catch(() => {});
  }

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
    members: addedMembers,
  });
});

// Get virtual cards for user's groups with total spent (completed receipts)
// Must be before /:groupId so "virtual-cards" is not parsed as groupId
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

// Create invite (group creator only). No email required — returns a shareable link/QR.
// Optional body: { inviteeEmail } for email-specific invites (shows in that user's pending list).
const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';
groupsRouter.post('/:groupId/invites', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  const inviteeEmail = req.body?.inviteeEmail;
  const email = typeof inviteeEmail === 'string' && inviteeEmail.trim()
    ? inviteeEmail.trim().toLowerCase()
    : '';

  const group = db.prepare('SELECT id, created_by FROM groups WHERE id = ?').get(groupId) as { id: string; created_by: string } | undefined;
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (group.created_by !== userId) {
    return res.status(403).json({ error: 'Only the group creator can create invites' });
  }

  const inviteId = genId();
  const token = crypto.randomBytes(24).toString('hex');
  const inviteLink = `${FRONTEND_BASE}/invite/${token}`;

  db.prepare(
    `INSERT INTO group_invites (id, group_id, inviter_id, invitee_email, token, status) VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(inviteId, groupId, userId, email, token);

  res.status(201).json({ inviteId, token, inviteLink });
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
    SELECT u.id, u.name, u.email, u.phone
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(groupId) as { id: string; name: string; email: string; phone: string | null }[];

  const pendingPhoneInvites = db.prepare(`
    SELECT id, invitee_phone, token, created_at
    FROM phone_invites
    WHERE group_id = ? AND status = 'pending'
  `).all(groupId) as { id: string; invitee_phone: string; token: string; created_at: string }[];

  res.json({
    ...group,
    members: members.map((m) => ({ ...m, status: 'joined' as const })),
    pendingInvites: pendingPhoneInvites.map((pi) => ({
      id: pi.id,
      phone: pi.invitee_phone,
      token: pi.token,
      createdAt: pi.created_at,
      status: 'invited' as const,
    })),
    cardLastFour: group.card_number_last_four,
  });
});

// Delete group (creator only). Cascades: group_invites, receipt_splits/item_claims/receipt_items, receipts, group_members, virtual_cards, groups.
groupsRouter.delete('/:groupId', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;

  const group = db.prepare('SELECT id, created_by FROM groups WHERE id = ?').get(groupId) as { id: string; created_by: string } | undefined;
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (group.created_by !== userId) {
    return res.status(403).json({ error: 'Only the group creator can delete the group' });
  }

  db.transaction(() => {
    db.prepare('DELETE FROM group_invites WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM phone_invites WHERE group_id = ?').run(groupId);
    const receipts = db.prepare('SELECT id FROM receipts WHERE group_id = ?').all(groupId) as { id: string }[];
    for (const r of receipts) {
      const items = db.prepare('SELECT id FROM receipt_items WHERE receipt_id = ?').all(r.id) as { id: string }[];
      for (const it of items) {
        db.prepare('DELETE FROM item_claims WHERE receipt_item_id = ?').run(it.id);
      }
      db.prepare('DELETE FROM receipt_items WHERE receipt_id = ?').run(r.id);
      db.prepare('DELETE FROM receipt_splits WHERE receipt_id = ?').run(r.id);
      db.prepare('DELETE FROM receipts WHERE id = ?').run(r.id);
    }
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM virtual_cards WHERE group_id = ?').run(groupId);
    db.prepare('DELETE FROM groups WHERE id = ?').run(groupId);
  })();

  res.status(204).send();
});

// Remove member (creator only). Cannot remove the creator.
groupsRouter.delete('/:groupId/members/:userId', requireAuth, (req, res) => {
  const { userId: currentUserId } = (req as any).user;
  const { groupId, userId: targetUserId } = req.params;

  const group = db.prepare('SELECT id, created_by FROM groups WHERE id = ?').get(groupId) as { id: string; created_by: string } | undefined;
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (group.created_by !== currentUserId) {
    return res.status(403).json({ error: 'Only the group creator can remove members' });
  }
  if (group.created_by === targetUserId) {
    return res.status(400).json({ error: 'Creator cannot be removed. Delete the group or transfer ownership.' });
  }

  const deleted = db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, targetUserId);
  if (deleted.changes === 0) {
    return res.status(404).json({ error: 'Member not found in this group' });
  }
  res.status(204).send();
});

// Leave group (current user). Creator cannot leave.
groupsRouter.post('/:groupId/leave', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;

  const group = db.prepare('SELECT id, created_by FROM groups WHERE id = ?').get(groupId) as { id: string; created_by: string } | undefined;
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (group.created_by === userId) {
    return res.status(400).json({ error: 'Creator cannot leave. Delete the group or transfer ownership.' });
  }

  const deleted = db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
  if (deleted.changes === 0) {
    return res.status(404).json({ error: 'You are not a member of this group' });
  }
  res.status(204).send();
});

// Resend phone invite SMS
groupsRouter.post('/:groupId/phone-invites/:inviteId/resend', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { groupId, inviteId } = req.params;

  const group = db.prepare('SELECT id, name, created_by FROM groups WHERE id = ?').get(groupId) as { id: string; name: string; created_by: string } | undefined;
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (group.created_by !== userId) {
    return res.status(403).json({ error: 'Only the group creator can resend invites' });
  }

  const invite = db.prepare('SELECT invitee_phone, token FROM phone_invites WHERE id = ? AND group_id = ? AND status = ?').get(inviteId, groupId, 'pending') as { invitee_phone: string; token: string } | undefined;
  if (!invite) {
    return res.status(404).json({ error: 'Invite not found or already accepted' });
  }

  const inviter = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
  const inviterName = inviter?.name || 'Someone';
  const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';
  const inviteLink = `${FRONTEND_BASE}/invite/phone/${invite.token}`;

  const sent = await sendPhoneInviteSMS(invite.invitee_phone, inviterName, group.name, inviteLink);
  res.json({ ok: true, message: sent ? 'Invite resent via SMS' : 'Failed to send SMS (check Twilio config)' });
});

// Remove phone invite
groupsRouter.delete('/:groupId/phone-invites/:inviteId', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { groupId, inviteId } = req.params;

  const group = db.prepare('SELECT id, created_by FROM groups WHERE id = ?').get(groupId) as { id: string; created_by: string } | undefined;
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  if (group.created_by !== userId) {
    return res.status(403).json({ error: 'Only the group creator can remove invites' });
  }

  const deleted = db.prepare('DELETE FROM phone_invites WHERE id = ? AND group_id = ?').run(inviteId, groupId);
  if (deleted.changes === 0) {
    return res.status(404).json({ error: 'Invite not found' });
  }
  res.status(204).send();
});
