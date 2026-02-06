import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const invitesRouter = Router();

function genId() {
  return crypto.randomUUID();
}

// Frontend base URL for invite links (env or default for dev)
const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * GET /api/invites/:token
 * Public (no auth) - returns invite details for showing "Accept invite to <group>"
 */
invitesRouter.get('/:token', (req, res) => {
  const { token } = req.params;
  const invite = db.prepare(
    `SELECT gi.id, gi.group_id, gi.invitee_email, gi.token, gi.status, gi.created_at,
            g.name as group_name,
            u.name as inviter_name
     FROM group_invites gi
     JOIN groups g ON gi.group_id = g.id
     JOIN users u ON gi.inviter_id = u.id
     WHERE gi.token = ?`
  ).get(token) as {
    id: string;
    group_id: string;
    invitee_email: string;
    token: string;
    status: string;
    created_at: string;
    group_name: string;
    inviter_name: string;
  } | undefined;

  if (!invite || invite.status !== 'pending') {
    return res.status(404).json({ error: 'Invite not found or already used' });
  }

  res.json({
    inviteId: invite.id,
    groupId: invite.group_id,
    groupName: invite.group_name,
    inviterName: invite.inviter_name,
    inviteeEmail: invite.invitee_email,
    token: invite.token,
    createdAt: invite.created_at,
  });
});

/**
 * POST /api/invites/:token/accept
 * Authenticated. If no payment methods → 403 PAYMENT_METHOD_REQUIRED.
 * Else add to group_members, mark invite accepted, return group.
 */
invitesRouter.post('/:token/accept', requireAuth, (req, res) => {
  const { token } = req.params;
  const { userId, email } = (req as any).user;

  const invite = db.prepare(
    `SELECT gi.id, gi.group_id, gi.invitee_email, gi.status, g.name
     FROM group_invites gi
     JOIN groups g ON gi.group_id = g.id
     WHERE gi.token = ?`
  ).get(token) as { id: string; group_id: string; invitee_email: string; status: string; name: string } | undefined;

  if (!invite) {
    return res.status(404).json({ error: 'Invite not found' });
  }
  if (invite.status !== 'pending') {
    return res.status(409).json({ error: 'Invite already accepted' });
  }

  // If invite was for a specific email, only that user can accept; otherwise any logged-in user can accept
  const inviteeEmailTrim = (invite.invitee_email || '').trim().toLowerCase();
  if (inviteeEmailTrim) {
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as { id: string; email: string } | undefined;
    if (!user || user.email.toLowerCase() !== inviteeEmailTrim) {
      return res.status(403).json({ error: 'This invite was sent to a different email address' });
    }
  }

  const paymentMethodCount = db.prepare(
    'SELECT COUNT(*) as c FROM payment_methods WHERE user_id = ?'
  ).get(userId) as { c: number };
  if (paymentMethodCount.c === 0) {
    return res.status(403).json({
      code: 'PAYMENT_METHOD_REQUIRED',
      error: 'Add a payment method to join this group',
    });
  }

  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(invite.group_id, userId);
    db.prepare("UPDATE group_invites SET status = 'accepted' WHERE id = ?").run(invite.id);
  })();

  const group = db.prepare(`
    SELECT g.id, g.name, g.created_by, g.created_at,
           vc.card_number_last_four
    FROM groups g
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE g.id = ?
  `).get(invite.group_id) as { id: string; name: string; created_by: string; created_at: string; card_number_last_four: string | null };
  const members = db.prepare(`
    SELECT u.id, u.name, u.email
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(invite.group_id) as { id: string; name: string; email: string }[];

  res.json({
    id: group.id,
    name: group.name,
    createdBy: group.created_by,
    createdAt: group.created_at,
    cardLastFour: group.card_number_last_four,
    members,
  });
});

/**
 * DELETE /api/invites/:token
 * Decline invite (authenticated invitee only). Deletes the invite row.
 */
invitesRouter.delete('/:token', requireAuth, (req, res) => {
  const { token } = req.params;
  const { userId } = (req as any).user;

  const invite = db.prepare(
    'SELECT id, invitee_email FROM group_invites WHERE token = ? AND status = ?'
  ).get(token, 'pending') as { id: string; invitee_email: string } | undefined;
  if (!invite) {
    return res.status(404).json({ error: 'Invite not found or already used' });
  }

  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  if (!user || user.email.toLowerCase() !== invite.invitee_email.toLowerCase()) {
    return res.status(403).json({ error: 'Only the invitee can decline this invite' });
  }

  db.prepare('DELETE FROM group_invites WHERE id = ?').run(invite.id);
  res.status(204).send();
});
