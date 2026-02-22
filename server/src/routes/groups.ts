import { Router } from 'express';
import crypto from 'crypto';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireBankLinked } from '../middleware/auth.js';
import { emitToGroup, emitToUsers, getGroupMemberIds } from '../socket.js';

export const groupsRouter = Router();

function genId() {
  return crypto.randomUUID();
}

/** Express req.params can be string | string[]; normalize to string for route params. */
function param(p: string | string[] | undefined): string {
  return Array.isArray(p) ? p[0] ?? '' : p ?? '';
}

function addMinutes(date: Date, mins: number): string {
  return new Date(date.getTime() + mins * 60 * 1000).toISOString();
}

function generateCardNumber(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateSupportCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// List user's groups with virtual card info
groupsRouter.get('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;

  const { rows: groups } = await query<{ id: string; name: string; created_by: string; created_at: string; card_number_last_four: string | null; member_count: string; support_code: string | null; last_settled_at: string | null }>(`
    SELECT g.id, g.name, g.created_by, g.created_at, g.support_code, g.last_settled_at,
           vc.card_number_last_four,
           (SELECT COUNT(*)::text FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE gm.user_id = $1
    ORDER BY g.created_at DESC
  `, [userId]);

  res.json(groups.map((g) => ({
    id: g.id,
    name: g.name,
    memberCount: parseInt(g.member_count, 10),
    cardLastFour: g.card_number_last_four,
    createdAt: g.created_at,
    supportCode: g.support_code,
    lastSettledAt: g.last_settled_at,
  })));
});

// Public: preview join link (no auth) - returns group name for /join/:token
groupsRouter.get('/join-preview/:token', async (req, res) => {
  const { token } = req.params;
  const { rows } = await query<{ name: string }>('SELECT name FROM groups WHERE invite_token = $1', [token]);
  if (rows.length === 0) return res.status(404).json({ error: 'Invalid invite link' });
  res.json({ groupName: rows[0].name });
});

// IMPORTANT: specific routes must come before /:groupId
// Get virtual cards for user's groups with total spent (completed receipts)
groupsRouter.get('/virtual-cards/list', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;

  const { rows: cards } = await query<{ groupId: string; groupName: string; cardLastFour: string | null; groupTotal: string }>(`
    WITH receipt_totals AS (
      SELECT r.group_id,
        COALESCE(r.total, (SELECT COALESCE(SUM(price), 0) FROM receipt_items WHERE receipt_id = r.id)) AS total
      FROM receipts r
      WHERE r.status = 'completed'
    ),
    group_totals AS (
      SELECT group_id, COALESCE(SUM(total), 0) AS total FROM receipt_totals GROUP BY group_id
    )
    SELECT g.id AS "groupId", g.name AS "groupName", vc.card_number_last_four AS "cardLastFour",
           COALESCE(gt.total, 0)::float AS "groupTotal"
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    LEFT JOIN group_totals gt ON g.id = gt.group_id
    WHERE gm.user_id = $1
    ORDER BY g.created_at DESC
  `, [userId]);

  res.json(cards.map((c) => ({ ...c, active: true, groupTotal: c.groupTotal ?? 0 })));
});

// Batch fetch group details - batched queries (no N+1)
groupsRouter.get('/batch', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const idsParam = req.query.ids as string | undefined;
  if (!idsParam) return res.status(400).json({ error: 'ids query param required' });
  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0 || ids.length > 20) return res.status(400).json({ error: 'ids must have 1-20 group ids' });

  type BatchGroup = {
    id: string; name: string; created_by: string;
    members: { id: string; name: string; email: string }[];
    cardLastFour: string | null; inviteToken: string;
    supportCode: string | null; lastSettledAt: string | null;
    lastSettledAllocations?: { user_id: string; name: string; amount: number }[];
    receipts: { id: string; group_id: string; status: string; total: number | null; created_at: string; splits?: unknown[] }[];
    splitModePreference: string;
  };

  // 1) Get groups user is member of, with invite_token, card, support_code, last_settled_at, split_mode_preference
  const { rows: groupRows } = await query<{ id: string; name: string; created_by: string; invite_token: string | null; card_number_last_four: string | null; support_code: string | null; last_settled_at: string | null; split_mode_preference: string }>(`
    SELECT g.id, g.name, g.created_by, g.invite_token, g.support_code, g.last_settled_at, COALESCE(g.split_mode_preference, 'item') as split_mode_preference, vc.card_number_last_four
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE gm.user_id = $1 AND g.id = ANY($2::text[])
  `, [userId, ids]);

  const groupMap = new Map<string, (typeof groupRows)[0]>();
  for (const g of groupRows) groupMap.set(g.id, g);

  // 2) Ensure invite_token exists where missing (only update if NULL to avoid race overwrites)
  const needToken = groupRows.filter((g) => !g.invite_token);
  if (needToken.length > 0) {
    await Promise.all(needToken.map(async (g) => {
      const tok = crypto.randomBytes(12).toString('hex');
      const { rowCount } = await query('UPDATE groups SET invite_token = $1 WHERE id = $2 AND invite_token IS NULL', [tok, g.id]);
      if (rowCount && rowCount > 0) {
        groupMap.set(g.id, { ...g, invite_token: tok });
      } else {
        const { rows } = await query<{ invite_token: string }>('SELECT invite_token FROM groups WHERE id = $1', [g.id]);
        const existing = rows[0]?.invite_token;
        if (existing) groupMap.set(g.id, { ...g, invite_token: existing });
      }
    }));
  }

  // 3) Batch fetch members for all groups
  const { rows: memberRows } = await query<{ group_id: string; id: string; name: string; email: string }>(`
    SELECT gm.group_id, u.id, u.name, u.email
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ANY($1::text[])
  `, [groupRows.map(g => g.id)]);
  const membersByGroup = new Map<string, { id: string; name: string; email: string }[]>();
  for (const m of memberRows) {
    const list = membersByGroup.get(m.group_id) ?? [];
    list.push({ id: m.id, name: m.name, email: m.email });
    membersByGroup.set(m.group_id, list);
  }

  // 4) Batch fetch receipts for all groups
  const { rows: receiptRows } = await query<{ id: string; group_id: string; status: string; total: number | null; created_at: string; transaction_id: string | null }>(`
    SELECT id, group_id, status, total, created_at, transaction_id
    FROM receipts
    WHERE group_id = ANY($1::text[])
    ORDER BY group_id, created_at DESC
  `, [groupRows.map(g => g.id)]);

  const txIds = [...new Set(receiptRows.map(r => r.transaction_id).filter(Boolean) as string[])];

  // 5) Batch fetch splits: transaction_allocations for receipts with transaction_id
  let txAllocations: { transaction_id: string; user_id: string; amount: number; name: string }[] = [];
  if (txIds.length > 0) {
    const { rows: ta } = await query<{ transaction_id: string; user_id: string; amount: number; name: string }>(`
      SELECT ta.transaction_id, ta.user_id, ta.amount, u.name
      FROM transaction_allocations ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.transaction_id = ANY($1::text[])
    `, [txIds]);
    txAllocations = ta;
  }

  // 6) Batch fetch receipt_splits for receipts without transaction_id
  const receiptIdsNoTx = receiptRows.filter(r => !r.transaction_id).map(r => r.id);
  let receiptSplits: { receipt_id: string; user_id: string; amount: number; status: string; name: string }[] = [];
  if (receiptIdsNoTx.length > 0) {
    const { rows: rs } = await query<{ receipt_id: string; user_id: string; amount: number; status: string; name: string }>(`
      SELECT rs.receipt_id, rs.user_id, rs.amount, rs.status, u.name
      FROM receipt_splits rs
      JOIN users u ON rs.user_id = u.id
      WHERE rs.receipt_id = ANY($1::text[])
    `, [receiptIdsNoTx]);
    receiptSplits = rs;
  }

  const txAllocByTx = new Map<string, { user_id: string; amount: number; status: string; name: string }[]>();
  for (const ta of txAllocations) {
    const list = txAllocByTx.get(ta.transaction_id) ?? [];
    list.push({ user_id: ta.user_id, amount: ta.amount, status: 'completed', name: ta.name });
    txAllocByTx.set(ta.transaction_id, list);
  }
  const splitsByReceipt = new Map<string, { user_id: string; amount: number; status: string; name: string }[]>();
  for (const s of receiptSplits) {
    const list = splitsByReceipt.get(s.receipt_id) ?? [];
    list.push({ user_id: s.user_id, amount: s.amount, status: s.status, name: s.name });
    splitsByReceipt.set(s.receipt_id, list);
  }

  type ReceiptRow = (typeof receiptRows)[0];
  const receiptsByGroup = new Map<string, ReceiptRow[]>();
  for (const r of receiptRows) {
    const list = receiptsByGroup.get(r.group_id) ?? [];
    list.push(r);
    receiptsByGroup.set(r.group_id, list);
  }

  // For groups with last_settled_at, fetch allocations for the latest settled transaction
  const settledGroupIds = groupRows.filter((g) => g.last_settled_at).map((g) => g.id);
  const allocsByGroup = new Map<string, { user_id: string; name: string; amount: number }[]>();
  if (settledGroupIds.length > 0) {
    const { rows: allocRows } = await query<{ group_id: string; user_id: string; amount: number; name: string }>(`
      WITH latest_tx AS (
        SELECT DISTINCT ON (group_id) id, group_id FROM transactions
        WHERE group_id = ANY($1::text[]) AND status = 'SETTLED'
        ORDER BY group_id, settled_at DESC
      )
      SELECT lt.group_id, ta.user_id, ta.amount, u.name
      FROM latest_tx lt
      JOIN transaction_allocations ta ON ta.transaction_id = lt.id
      JOIN users u ON u.id = ta.user_id
    `, [settledGroupIds]);
    for (const a of allocRows) {
      const list = allocsByGroup.get(a.group_id) ?? [];
      list.push({ user_id: a.user_id, name: a.name, amount: a.amount });
      allocsByGroup.set(a.group_id, list);
    }
  }

  const out: Record<string, BatchGroup> = {};
  for (const g of groupRows) {
    const group = groupMap.get(g.id)!;
    const members = membersByGroup.get(g.id) ?? [];
    const receipts = receiptsByGroup.get(g.id) ?? [];
    const receiptsWithSplits = receipts.map((r) => {
      const splits = r.transaction_id
        ? (txAllocByTx.get(r.transaction_id) ?? [])
        : (splitsByReceipt.get(r.id) ?? []);
      return { ...r, splits };
    });
    out[g.id] = {
      id: group.id,
      name: group.name,
      created_by: group.created_by,
      members,
      cardLastFour: group.card_number_last_four,
      inviteToken: group.invite_token!,
      supportCode: (group as { support_code?: string }).support_code ?? null,
      lastSettledAt: (group as { last_settled_at?: string }).last_settled_at ?? null,
      receipts: receiptsWithSplits,
      lastSettledAllocations: allocsByGroup.get(g.id),
      splitModePreference: (group as { split_mode_preference?: string }).split_mode_preference ?? 'item',
    };
  }

  res.json(out);
});

// Preview group by join token (public - no auth, for AcceptInvitePage)
groupsRouter.get('/join/:token', async (req, res) => {
  const { token } = req.params;
  const { rows } = await query<{ name: string }>('SELECT g.name FROM groups g WHERE g.invite_token = $1', [token]);
  const group = rows[0];
  if (!group) return res.status(404).json({ error: 'Invalid invite link' });
  res.json({ groupName: group.name });
});

// Create group and unique virtual card
groupsRouter.post('/', requireAuth, requireBankLinked, async (req, res) => {
  const { userId } = (req as any).user;
  const { name, memberEmails } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'Group name is required' });
  }

  const groupId = genId();
  const cardId = genId();
  const cardLastFour = generateCardNumber();
  const inviteToken = crypto.randomBytes(12).toString('hex');
  let supportCode = generateSupportCode();
  let attempts = 0;
  while (attempts++ < 10) {
    const { rowCount } = await query('SELECT 1 FROM groups WHERE support_code = $1', [supportCode]);
    if (!rowCount || rowCount === 0) break;
    supportCode = generateSupportCode();
  }

  await withTransaction(async (client) => {
    await client.query('INSERT INTO groups (id, name, created_by, invite_token, support_code) VALUES ($1, $2, $3, $4, $5)', [groupId, name.trim(), userId, inviteToken, supportCode]);
    await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, userId]);
    await client.query('INSERT INTO virtual_cards (id, group_id, card_number_last_four) VALUES ($1, $2, $3)', [cardId, groupId, cardLastFour]);

    const emails = Array.isArray(memberEmails) ? memberEmails : [];
    for (const email of emails) {
      const e = String(email).trim().toLowerCase();
      if (!e) continue;
      const { rows: memberRows } = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [e]);
      const member = memberRows[0];
      if (member && member.id !== userId) {
        await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT (group_id, user_id) DO NOTHING', [groupId, member.id]);
      }
    }
  });

  const { rows: groupRows } = await query<{ id: string; name: string; created_at: string; card_number_last_four: string; member_count: string }>(`
    SELECT g.id, g.name, g.created_at, vc.card_number_last_four,
           (SELECT COUNT(*)::text FROM group_members WHERE group_id = g.id) as member_count
    FROM groups g
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE g.id = $1
  `, [groupId]);
  const group = groupRows[0]!;

  res.status(201).json({
    ...group,
    memberCount: parseInt(group.member_count, 10),
    cardLastFour: group.card_number_last_four,
    inviteToken,
    supportCode,
  });
  void emitToGroup(groupId, 'groups:changed', {});
  void emitToGroup(groupId, 'group:updated', { groupId });
});

// Get single group with members (optimized: combined auth+group query)
groupsRouter.get('/:groupId', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.params;

  const { rows } = await query<{ id: string; name: string; created_by: string; created_at: string; invite_token: string | null; card_number_last_four: string | null; is_member: number; support_code: string | null; last_settled_at: string | null; split_mode_preference: string; draft_tip_percentage: number | null; draft_receipt_id: string | null }>(`
    SELECT g.id, g.name, g.created_by, g.created_at, g.invite_token, g.support_code, g.last_settled_at, g.split_mode_preference,
           g.draft_tip_percentage, g.draft_receipt_id,
           vc.card_number_last_four,
           (SELECT COUNT(*)::int FROM group_members WHERE group_id = g.id AND user_id = $1) as is_member
    FROM groups g
    LEFT JOIN virtual_cards vc ON g.id = vc.group_id
    WHERE g.id = $2
  `, [userId, groupId]);
  const row = rows[0];

  if (!row || !row.is_member) return res.status(404).json({ error: 'Group not found' });

  let inviteToken = row.invite_token;
  if (!inviteToken) {
    const tok = crypto.randomBytes(12).toString('hex');
    const upd = await query('UPDATE groups SET invite_token = $1 WHERE id = $2 AND invite_token IS NULL', [tok, groupId]);
    if (upd.rowCount && upd.rowCount > 0) {
      inviteToken = tok;
    } else {
      const { rows } = await query<{ invite_token: string }>('SELECT invite_token FROM groups WHERE id = $1', [groupId]);
      inviteToken = rows[0]?.invite_token ?? tok;
    }
  }

  const { rows: members } = await query<{ id: string; name: string; email: string; avatar_url: string | null }>(
    'SELECT u.id, u.name, u.email, u.avatar_url FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = $1',
    [groupId]
  );

  let lastSettledAllocations: { user_id: string; name: string; amount: number }[] = [];
  let lastSettledBreakdown: Record<string, { subtotal: number; tax: number; tip: number }> | undefined;
  let lastSettledItemsPerUser: Record<string, { name: string; price: number }[]> | undefined;
  if (row.last_settled_at) {
    const { rows: txRows } = await query<{ id: string; allocation_breakdown: unknown }>(
      'SELECT id, allocation_breakdown FROM transactions WHERE group_id = $1 AND status = $2 ORDER BY settled_at DESC LIMIT 1',
      [groupId, 'SETTLED']
    );
    const lastTx = txRows[0];
    if (lastTx?.id) {
      const { rows: allocs } = await query<{ user_id: string; amount: number }>(
        'SELECT ta.user_id, ta.amount FROM transaction_allocations ta WHERE ta.transaction_id = $1',
        [lastTx.id]
      );
      if (allocs.length > 0) {
        const userIds = allocs.map((a) => a.user_id);
        const { rows: nameRows } = await query<{ id: string; name: string }>('SELECT id, name FROM users WHERE id = ANY($1)', [userIds]);
        const nameMap = Object.fromEntries(nameRows.map((n) => [n.id, n.name]));
        lastSettledAllocations = allocs.map((a) => ({ user_id: a.user_id, name: nameMap[a.user_id] ?? 'Unknown', amount: a.amount }));
      }
      if (lastTx.allocation_breakdown && typeof lastTx.allocation_breakdown === 'object') {
        lastSettledBreakdown = lastTx.allocation_breakdown as Record<string, { subtotal: number; tax: number; tip: number }>;
      }
      const { rows: recRows } = await query<{ id: string }>('SELECT id FROM receipts WHERE transaction_id = $1 LIMIT 1', [lastTx.id]);
      const receiptId = recRows[0]?.id;
      if (receiptId) {
        const { rows: itemRows } = await query<{ id: string; name: string; price: number }>(
          'SELECT id, name, price FROM receipt_items WHERE receipt_id = $1 ORDER BY sort_order, id',
          [receiptId]
        );
        if (itemRows.length > 0) {
          const { rows: claimRows } = await query<{ receipt_item_id: string; user_id: string }>(
            'SELECT receipt_item_id, user_id FROM item_claims WHERE receipt_item_id = ANY($1)',
            [itemRows.map((i) => i.id)]
          );
          const itemsById = Object.fromEntries(itemRows.map((i) => [i.id, i]));
          const perUser: Record<string, { name: string; price: number }[]> = {};
          for (const c of claimRows) {
            const item = itemsById[c.receipt_item_id];
            if (!item) continue;
            if (!perUser[c.user_id]) perUser[c.user_id] = [];
            perUser[c.user_id].push({ name: item.name, price: item.price });
          }
          lastSettledItemsPerUser = Object.keys(perUser).length > 0 ? perUser : undefined;
        }
      }
    }
  }

  let pendingItemSplit: { receiptId: string; receiptTotal: number; myAmount: number; draftTipPercentage: number } | undefined;
  if (row.draft_receipt_id) {
    const { rows: recRow } = await query<{ total: number | null }>('SELECT total FROM receipts WHERE id = $1', [row.draft_receipt_id]);
    const receiptTotal = recRow[0]?.total != null ? Number(recRow[0].total) : 0;
    const { rows: splitRow } = await query<{ amount: number }>(
      'SELECT amount FROM receipt_splits WHERE receipt_id = $1 AND user_id = $2',
      [row.draft_receipt_id, userId]
    );
    const myAmount = splitRow[0]?.amount != null ? Number(splitRow[0].amount) : 0;
    const draftTip = row.draft_tip_percentage != null ? Number(row.draft_tip_percentage) : 15;
    pendingItemSplit = { receiptId: row.draft_receipt_id, receiptTotal, myAmount, draftTipPercentage: draftTip };
  }

  res.json({
    id: row.id, name: row.name, created_by: row.created_by, created_at: row.created_at,
    members: members.map((m) => ({ ...m, avatarUrl: m.avatar_url })),
    cardLastFour: row.card_number_last_four, inviteToken,
    supportCode: row.support_code, lastSettledAt: row.last_settled_at,
    lastSettledAllocations: lastSettledAllocations.length > 0 ? lastSettledAllocations : undefined,
    lastSettledBreakdown: lastSettledBreakdown ?? undefined,
    lastSettledItemsPerUser: lastSettledItemsPerUser ?? undefined,
    splitModePreference: row.split_mode_preference ?? 'item',
    pendingItemSplit: pendingItemSplit ?? undefined,
  });
});

// Update group (host only) - e.g. split mode preference (PATCH and PUT for proxy compatibility)
async function updateGroupHandler(req: any, res: any) {
  const { userId } = (req as any).user;
  const { groupId } = req.params;
  const { splitModePreference, draftTipPercentage } = req.body;

  const { rows: groupRows } = await query<{ created_by: string; draft_receipt_id: string | null }>('SELECT created_by, draft_receipt_id FROM groups WHERE id = $1', [groupId]);
  const group = groupRows[0];
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== userId) return res.status(403).json({ error: 'Only the host can update this group' });

  if (splitModePreference !== undefined) {
    if (!['even', 'item'].includes(splitModePreference)) {
      return res.status(400).json({ error: 'splitModePreference must be "even" or "item"' });
    }
    await query('UPDATE groups SET split_mode_preference = $1 WHERE id = $2', [splitModePreference, groupId]);
  }

  if (draftTipPercentage !== undefined) {
    if (!group.draft_receipt_id) return res.status(400).json({ error: 'No pending item split to update tip for' });
    const pct = Math.min(30, Math.max(0, Number(draftTipPercentage)));
    if (Number.isNaN(pct)) return res.status(400).json({ error: 'draftTipPercentage must be a number' });
    await query('UPDATE groups SET draft_tip_percentage = $1 WHERE id = $2', [Math.round(pct), groupId]);
  }

  res.json({ ok: true });
  void emitToGroup(groupId, 'group:updated', { groupId });
}
groupsRouter.patch('/:groupId', requireAuth, updateGroupHandler);
groupsRouter.put('/:groupId', requireAuth, updateGroupHandler);

// Join group via invite token (user becomes member immediately)
groupsRouter.post('/join/:token', requireAuth, requireBankLinked, async (req, res) => {
  const { userId } = (req as any).user;
  const { token } = req.params;

  const { rows } = await query<{ id: string; name: string }>('SELECT id, name FROM groups WHERE invite_token = $1', [token]);
  const group = rows[0];
  if (!group) return res.status(404).json({ error: 'Invalid invite link' });

  await query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT (group_id, user_id) DO NOTHING', [group.id, userId]);
  res.json({ groupId: group.id, groupName: group.name, joined: true });
  void emitToGroup(group.id, 'groups:changed', {});
  void emitToGroup(group.id, 'group:updated', { groupId: group.id });
});

// Delete group (host only)
groupsRouter.delete('/:groupId', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const groupId = param(req.params.groupId);

  const { rows: groupRows } = await query<{ created_by: string }>('SELECT created_by FROM groups WHERE id = $1', [groupId]);
  const group = groupRows[0];
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== userId) return res.status(403).json({ error: 'Only the host can delete this group' });

  const memberIds = await getGroupMemberIds(groupId);

  await withTransaction(async (client) => {
    const { rows: receiptRows } = await client.query<{ id: string }>('SELECT id FROM receipts WHERE group_id = $1', [groupId]);
    for (const r of receiptRows) {
      await client.query('DELETE FROM item_claims WHERE receipt_item_id IN (SELECT id FROM receipt_items WHERE receipt_id = $1)', [r.id]);
      await client.query('DELETE FROM receipt_items WHERE receipt_id = $1', [r.id]);
      await client.query('DELETE FROM receipt_splits WHERE receipt_id = $1', [r.id]);
    }
    await client.query('DELETE FROM receipts WHERE group_id = $1', [groupId]);

    const { rows: txRows } = await client.query<{ id: string }>('SELECT id FROM transactions WHERE group_id = $1', [groupId]);
    for (const t of txRows) {
      await client.query('DELETE FROM transaction_allocations WHERE transaction_id = $1', [t.id]);
    }
    await client.query('DELETE FROM transactions WHERE group_id = $1', [groupId]);
    await client.query('DELETE FROM virtual_cards WHERE group_id = $1', [groupId]);
    await client.query('DELETE FROM group_members WHERE group_id = $1', [groupId]);
    await client.query('DELETE FROM groups WHERE id = $1', [groupId]);
  });

  emitToUsers(memberIds, 'groups:changed', {});
  res.json({ ok: true });
});

// Leave group (non-host members only)
groupsRouter.post('/:groupId/leave', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const groupId = param(req.params.groupId);

  const { rows: groupRows } = await query<{ created_by: string }>('SELECT created_by FROM groups WHERE id = $1', [groupId]);
  const group = groupRows[0];
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by === userId) return res.status(400).json({ error: 'The host cannot leave the group. Delete it instead.' });

  const { rows: memberRows } = await query<{ id: string }>('SELECT 1 as id FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  if (memberRows.length === 0) return res.status(404).json({ error: 'You are not a member of this group' });

  const memberIds = await getGroupMemberIds(groupId);
  await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  res.json({ ok: true });
  emitToUsers(memberIds, 'groups:changed', {});
  void emitToGroup(groupId, 'group:updated', { groupId });
});

// Remove member from group (host only)
groupsRouter.delete('/:groupId/members/:memberId', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const groupId = param(req.params.groupId);
  const memberId = param(req.params.memberId);

  const { rows: groupRows } = await query<{ created_by: string }>('SELECT created_by FROM groups WHERE id = $1', [groupId]);
  const group = groupRows[0];
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.created_by !== userId) return res.status(403).json({ error: 'Only the host can remove members' });
  if (memberId === userId) return res.status(400).json({ error: 'You cannot remove yourself. Delete the group instead.' });

  const { rows: memberRows } = await query<{ id: string }>('SELECT 1 as id FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, memberId]);
  if (memberRows.length === 0) return res.status(404).json({ error: 'Member not found in this group' });

  const memberIds = await getGroupMemberIds(groupId);
  await query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, memberId]);
  res.json({ ok: true });
  emitToUsers(memberIds, 'groups:changed', {});
  void emitToGroup(groupId, 'group:updated', { groupId });
});

// Create transaction (on receipt upload or manual total entry). For FULL_CONTROL, optional receiptId links existing completed receipt.
groupsRouter.post('/:groupId/transactions', requireAuth, requireBankLinked, async (req, res) => {
  const { userId } = (req as any).user;
  const groupId = param(req.params.groupId);
  const { splitMode, receiptId: bodyReceiptId } = req.body;

  if (!['EVEN_SPLIT', 'FULL_CONTROL'].includes(splitMode)) {
    return res.status(400).json({ error: 'splitMode must be EVEN_SPLIT or FULL_CONTROL' });
  }

  const { rows: memberRows } = await query<{ id: string }>('SELECT 1 as id FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  if (memberRows.length === 0) return res.status(404).json({ error: 'Group not found' });

  const { rows: groupRows } = await query<{ created_by: string }>('SELECT created_by FROM groups WHERE id = $1', [groupId]);
  const group = groupRows[0];
  if (!group || group.created_by !== userId) {
    return res.status(403).json({ error: 'Only the group creator can start a payment' });
  }

  const id = genId();
  const deadline = addMinutes(new Date(), 15);
  await query(
    `INSERT INTO transactions (id, group_id, created_by, status, split_mode, allocation_deadline_at)
     VALUES ($1, $2, $3, 'PENDING_ALLOCATION', $4, $5)`,
    [id, groupId, userId, splitMode, deadline]
  );

  if (splitMode === 'FULL_CONTROL' && bodyReceiptId && typeof bodyReceiptId === 'string') {
    const { rowCount } = await query(
      'UPDATE receipts SET transaction_id = $1 WHERE id = $2 AND group_id = $3 AND status = $4 AND (transaction_id IS NULL OR transaction_id = $1)',
      [id, bodyReceiptId.trim(), groupId, 'completed']
    );
    if (rowCount === 0) {
      await query('DELETE FROM transactions WHERE id = $1', [id]);
      return res.status(400).json({ error: 'Receipt not found or already linked to a transaction' });
    }
  }

  const { rows } = await query('SELECT * FROM transactions WHERE id = $1', [id]);
  const row = rows[0] as any;
  void emitToGroup(groupId, 'group:updated', { groupId });
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
