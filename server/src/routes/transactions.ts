import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { extractReceiptItems } from '../ocr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/jpg', 'image/x-png'];
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)?.toLowerCase() || '.jpg';
    const safeExt = ['.png', '.jpg', '.jpeg'].includes(ext) ? ext : '.jpg';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ALLOWED_MIMES.includes(file.mimetype));
  },
});

export const transactionsRouter = Router();

function genId() {
  return crypto.randomUUID();
}

async function ensureMember(userId: string, groupId: string): Promise<void> {
  const { rows } = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  if (rows.length === 0) throw new Error('Group not found');
}

function ensureCreator(userId: string, tx: { created_by: string }): void {
  if (tx.created_by !== userId) throw new Error('Only the creator can perform this action');
}

async function getGroupMemberIds(groupId: string): Promise<string[]> {
  const { rows } = await query<{ user_id: string }>('SELECT user_id FROM group_members WHERE group_id = $1', [groupId]);
  return rows.map((r) => r.user_id);
}

// List transactions for a group (for group detail - find active PENDING)
transactionsRouter.get('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.query;
  if (!groupId || typeof groupId !== 'string') {
    return res.status(400).json({ error: 'groupId required' });
  }
  const { rows: memberRows } = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  if (memberRows.length === 0) return res.status(404).json({ error: 'Group not found' });
  const { rows } = await query<{ id: string; status: string; split_mode: string; tip_amount: number; subtotal: number | null; allocation_deadline_at: string | null; created_at: string; receipt_id: string | null }>(`
    SELECT t.id, t.status, t.split_mode, t.tip_amount, t.subtotal, t.allocation_deadline_at, t.created_at,
           (SELECT id FROM receipts WHERE transaction_id = t.id LIMIT 1) as receipt_id
    FROM transactions t WHERE t.group_id = $1 ORDER BY t.created_at DESC
  `, [groupId]);
  res.json(rows);
});

// List user's transaction activity (for History tab)
transactionsRouter.get('/activity/me', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { rows } = await query<{ id: string; transaction_id: string; amount: number; group_id: string; status: string; created_at: string; settled_at: string | null; archived_at: string | null; group_name: string }>(`
    SELECT ta.id, ta.transaction_id, ta.amount, t.group_id, t.status, t.created_at, t.settled_at, t.archived_at,
           g.name as group_name
    FROM transaction_allocations ta
    JOIN transactions t ON ta.transaction_id = t.id
    JOIN groups g ON t.group_id = g.id
    JOIN group_members gm ON t.group_id = gm.group_id AND gm.user_id = $1
    WHERE ta.user_id = $2
    ORDER BY COALESCE(t.settled_at, t.created_at) DESC
    LIMIT 50
  `, [userId, userId]);
  res.json(rows);
});

// Get transaction state (for allocation UI, receipt items, etc.)
transactionsRouter.get('/:id', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { id } = req.params;

  const { rows: txRows } = await query('SELECT t.* FROM transactions t JOIN group_members gm ON t.group_id = gm.group_id WHERE t.id = $1 AND gm.user_id = $2', [id, userId]);
  const tx = txRows[0] as any;
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });

  const { rows: receiptRows } = await query<{ id: string }>('SELECT id FROM receipts WHERE transaction_id = $1', [id]);
  const receipt = receiptRows[0];
  let items: { id: string; name: string; price: number }[] = [];
  const claims: Record<string, string[]> = {};
  if (receipt) {
    const { rows: itemRows } = await query<{ id: string; name: string; price: number }>(
      'SELECT id, name, price FROM receipt_items WHERE receipt_id = $1 ORDER BY sort_order, id',
      [receipt.id]
    );
    items = itemRows;
    for (const item of items) {
      const { rows: claimRows } = await query<{ user_id: string }>('SELECT user_id FROM item_claims WHERE receipt_item_id = $1', [item.id]);
      claims[item.id] = claimRows.map((x) => x.user_id);
    }
  }

  const { rows: members } = await query<{ id: string; name: string; email: string }>(
    'SELECT u.id, u.name, u.email FROM group_members gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = $1',
    [tx.group_id]
  );

  const { rows: allocRows } = await query<{ user_id: string; amount: number }>(
    'SELECT user_id, amount FROM transaction_allocations WHERE transaction_id = $1',
    [id]
  );

  res.json({
    ...tx,
    receipt_id: receipt?.id,
    items,
    claims,
    members,
    allocations: allocRows.map((a) => ({ user_id: a.user_id, amount: a.amount })),
  });
});

// Upload receipt to transaction (both EVEN_SPLIT and FULL_CONTROL), run OCR to extract total + items
transactionsRouter.post('/:id/receipt', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { id } = req.params;
    const file = req.file;

    const { rows: txRows } = await query('SELECT t.* FROM transactions t JOIN group_members gm ON t.group_id = gm.group_id WHERE t.id = $1 AND gm.user_id = $2', [id, userId]);
    const tx = txRows[0] as any;
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'PENDING_ALLOCATION') return res.status(400).json({ error: 'Transaction already finalized' });
    if (!file) return res.status(400).json({ error: 'No image file provided' });

    const fullPath = path.join(uploadsDir, file.filename);
    let items: { name: string; price: number }[];
    try {
      const ocrPromise = extractReceiptItems(fullPath);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Couldn\'t read the image.')), 35_000)
      );
      items = await Promise.race([ocrPromise, timeout]);
    } catch (ocrErr) {
      try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
      return res.status(422).json({ error: 'Couldn\'t read the image. Please try again with a clearer photo.' });
    }

    const receiptId = genId();
    const filePath = `/uploads/${file.filename}`;
    const subtotal = items.reduce((s, i) => s + i.price, 0);

    await query(`
      INSERT INTO receipts (id, group_id, uploaded_by, file_path, total, status, transaction_id)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6)
    `, [receiptId, tx.group_id, userId, filePath, subtotal, id]);

    let sortOrder = 0;
    for (const item of items) {
      await query(
        'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [genId(), receiptId, item.name, item.price, sortOrder++]
      );
    }

    await query('UPDATE transactions SET subtotal = $1, total = $2 WHERE id = $3', [subtotal, subtotal, id]);

    res.status(201).json({ receipt_id: receiptId, items, subtotal });
  } catch (err) {
    console.error('Transaction receipt upload:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

// Set manual subtotal (creator only, EVEN_SPLIT, when no receipt yet)
transactionsRouter.put('/:id/subtotal', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { id } = req.params;
  const { subtotal } = req.body;

  const { rows: txRows } = await query('SELECT t.* FROM transactions t JOIN group_members gm ON t.group_id = gm.group_id WHERE t.id = $1 AND gm.user_id = $2', [id, userId]);
  const tx = txRows[0] as any;
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'PENDING_ALLOCATION') return res.status(400).json({ error: 'Transaction already finalized' });
  ensureCreator(userId, tx);
  if (tx.split_mode !== 'EVEN_SPLIT') return res.status(400).json({ error: 'Manual total only for even split' });

  const { rows: receiptRows } = await query('SELECT id FROM receipts WHERE transaction_id = $1', [id]);
  if (receiptRows.length > 0) return res.status(400).json({ error: 'Receipt already uploaded' });

  const sub = Math.max(0, Number(subtotal) || 0);
  const tip = tx.tip_amount ?? 0;
  await query('UPDATE transactions SET subtotal = $1, total = $2 WHERE id = $3', [sub, sub + tip, id]);
  res.json({ subtotal: sub, total: sub + tip });
});

// Update tip (creator only)
transactionsRouter.put('/:id/tip', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { id } = req.params;
  const { tipAmount } = req.body;

  const { rows: txRows } = await query('SELECT t.* FROM transactions t JOIN group_members gm ON t.group_id = gm.group_id WHERE t.id = $1 AND gm.user_id = $2', [id, userId]);
  const tx = txRows[0] as any;
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'PENDING_ALLOCATION') return res.status(400).json({ error: 'Transaction already finalized' });
  ensureCreator(userId, tx);

  const tip = Math.max(0, Number(tipAmount) || 0);
  const subtotal = tx.subtotal ?? 0;
  await query('UPDATE transactions SET tip_amount = $1, subtotal = $2, total = $3 WHERE id = $4', [tip, subtotal, subtotal + tip, id]);
  res.json({ tip_amount: tip, subtotal, total: subtotal + tip });
});

// Set item claims (FULL_CONTROL)
transactionsRouter.put('/:id/items/:itemId/claims', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { id, itemId } = req.params;
  const { userIds } = req.body;

  const { rows: txRows } = await query('SELECT t.* FROM transactions t JOIN group_members gm ON t.group_id = gm.group_id WHERE t.id = $1 AND gm.user_id = $2', [id, userId]);
  const tx = txRows[0] as any;
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'PENDING_ALLOCATION') return res.status(400).json({ error: 'Transaction already finalized' });

  const { rows: receiptRows } = await query<{ id: string }>('SELECT id FROM receipts WHERE transaction_id = $1', [id]);
  const receipt = receiptRows[0];
  if (!receipt) return res.status(400).json({ error: 'No receipt uploaded yet' });

  const { rows: itemRows } = await query<{ id: string }>('SELECT id FROM receipt_items WHERE id = $1 AND receipt_id = $2', [itemId, receipt.id]);
  if (itemRows.length === 0) return res.status(404).json({ error: 'Item not found' });

  const ids = Array.isArray(userIds) ? userIds : [];
  await query('DELETE FROM item_claims WHERE receipt_item_id = $1', [itemId]);
  for (const uid of ids) {
    const { rows: memberRows } = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [tx.group_id, uid]);
    if (memberRows.length > 0) {
      await query('INSERT INTO item_claims (receipt_item_id, user_id) VALUES ($1, $2) ON CONFLICT (receipt_item_id, user_id) DO NOTHING', [itemId, uid]);
    }
  }
  const { rows: claimRows } = await query<{ user_id: string }>('SELECT user_id FROM item_claims WHERE receipt_item_id = $1', [itemId]);
  res.json({ userIds: claimRows.map((c) => c.user_id) });
});

// Finalize (creator only). Enforces: EVEN always ok; FULL needs all items allocated or auto-split unclaimed.
transactionsRouter.post('/:id/finalize', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { id } = req.params;

  const { rows: txRows } = await query('SELECT t.* FROM transactions t JOIN group_members gm ON t.group_id = gm.group_id WHERE t.id = $1 AND gm.user_id = $2', [id, userId]);
  const tx = txRows[0] as any;
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'PENDING_ALLOCATION') return res.status(400).json({ error: 'Transaction already finalized' });
  ensureCreator(userId, tx);

  const memberIds = await getGroupMemberIds(tx.group_id);
  const tip = tx.tip_amount ?? 0;
  let allocations: { user_id: string; amount: number }[] = [];

  if (tx.split_mode === 'EVEN_SPLIT') {
    const subtotal = tx.subtotal ?? 0;
    const total = subtotal + tip;
    const perPerson = total / memberIds.length;
    const rounded = memberIds.map(() => Math.round(perPerson * 100) / 100);
    const diff = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * 100) / 100;
    if (diff !== 0) rounded[0] += diff;
    allocations = memberIds.map((uid, i) => ({ user_id: uid, amount: rounded[i] }));
  } else {
    const { rows: receiptRows } = await query<{ id: string }>('SELECT id FROM receipts WHERE transaction_id = $1', [id]);
    const receipt = receiptRows[0];
    if (!receipt) return res.status(400).json({ error: 'Upload a receipt before finalizing' });

    const { rows: itemRows } = await query<{ id: string; price: number }>('SELECT id, price FROM receipt_items WHERE receipt_id = $1', [receipt.id]);
    const items = itemRows;
    const userTotals: Record<string, number> = {};
    for (const uid of memberIds) userTotals[uid] = 0;

    let unclaimedTotal = 0;
    for (const item of items) {
      const { rows: claimRows } = await query<{ user_id: string }>('SELECT user_id FROM item_claims WHERE receipt_item_id = $1', [item.id]);
      const uids = claimRows.map((c) => c.user_id);
      if (uids.length === 0) {
        unclaimedTotal += item.price;
      } else {
        const share = item.price / uids.length;
        for (const uid of uids) userTotals[uid] = (userTotals[uid] ?? 0) + share;
      }
    }
    if (unclaimedTotal > 0) {
      const share = unclaimedTotal / memberIds.length;
      for (const uid of memberIds) userTotals[uid] = (userTotals[uid] ?? 0) + share;
    }

    const subtotal = items.reduce((s, i) => s + i.price, 0);
    const total = subtotal + tip;
    const sumUserTotals = Object.values(userTotals).reduce((a, b) => a + b, 0);
    const tipRatio = sumUserTotals > 0 ? tip / sumUserTotals : 1 / memberIds.length;
    for (const uid of memberIds) {
      const base = userTotals[uid] ?? 0;
      userTotals[uid] = base + base * tipRatio;
    }
    const finalSum = Object.values(userTotals).reduce((a, b) => a + b, 0);
    const diff = Math.round((total - finalSum) * 100) / 100;
    const firstUid = memberIds[0];
    if (diff !== 0) userTotals[firstUid] = (userTotals[firstUid] ?? 0) + diff;

    allocations = memberIds.map((uid) => ({ user_id: uid, amount: Math.round((userTotals[uid] ?? 0) * 100) / 100 }));
  }

  const now = new Date().toISOString();
  const finalTotal = (tx.subtotal ?? 0) + (tx.tip_amount ?? 0);
  await query('UPDATE transactions SET status = $1, finalized_at = $2, settled_at = $3, archived_at = $4 WHERE id = $5', ['SETTLED', now, now, now, id]);
  await query("UPDATE receipts SET status = 'completed', total = $1 WHERE transaction_id = $2", [finalTotal, id]);
  await query('DELETE FROM transaction_allocations WHERE transaction_id = $1', [id]);
  for (const a of allocations) {
    if (a.amount > 0) {
      await query('INSERT INTO transaction_allocations (id, transaction_id, user_id, amount) VALUES ($1, $2, $3, $4)', [genId(), id, a.user_id, a.amount]);
    }
  }

  const withNames = await Promise.all(allocations.map(async (a) => {
    const { rows } = await query<{ name: string }>('SELECT name FROM users WHERE id = $1', [a.user_id]);
    return { user_id: a.user_id, amount: a.amount, name: rows[0]?.name ?? 'Unknown' };
  }));
  res.json({ ok: true, allocations: withNames, status: 'SETTLED' });
});

// Run fallback for a single expired transaction (used by timer job and route)
export async function runFallbackForTransaction(id: string): Promise<boolean> {
  const { rows } = await query('SELECT * FROM transactions WHERE id = $1', [id]);
  const tx = rows[0] as any;
  if (!tx || tx.status !== 'PENDING_ALLOCATION') return false;
  const deadline = tx.allocation_deadline_at ? new Date(tx.allocation_deadline_at).getTime() : 0;
  if (Date.now() < deadline) return false;

  const memberIds = await getGroupMemberIds(tx.group_id);
  const subtotal = tx.subtotal ?? 0;
  const total = subtotal + 0;
  const perPerson = total / memberIds.length;
  const rounded = memberIds.map(() => Math.round(perPerson * 100) / 100);
  const diff = Math.round((total - rounded.reduce((a, b) => a + b, 0)) * 100) / 100;
  if (diff !== 0) rounded[0] += diff;
  const allocations = memberIds.map((uid, i) => ({ user_id: uid, amount: rounded[i] }));

  const now = new Date().toISOString();
  await query('UPDATE transactions SET status = $1, tip_amount = 0, total = $2, finalized_at = $3, settled_at = $4, archived_at = $5 WHERE id = $6', ['SETTLED', total, now, now, now, id]);
  await query('DELETE FROM transaction_allocations WHERE transaction_id = $1', [id]);
  for (const a of allocations) {
    if (a.amount > 0) {
      await query('INSERT INTO transaction_allocations (id, transaction_id, user_id, amount) VALUES ($1, $2, $3, $4)', [genId(), id, a.user_id, a.amount]);
    }
  }
  return true;
}

transactionsRouter.post('/:id/fallback-even', requireAuth, async (req, res) => {
  const id = String(req.params.id ?? '');
  const { rows } = await query('SELECT * FROM transactions WHERE id = $1', [id]);
  const tx = rows[0] as any;
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'PENDING_ALLOCATION') return res.json({ ok: true, already_processed: true });
  const deadline = tx.allocation_deadline_at ? new Date(tx.allocation_deadline_at).getTime() : 0;
  if (Date.now() < deadline) return res.status(400).json({ error: 'Deadline not yet reached' });
  await runFallbackForTransaction(id);
  res.json({ ok: true });
});

// Settle (simulated). Called after finalize or by timer.
transactionsRouter.post('/:id/settle', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { rows } = await query('SELECT * FROM transactions WHERE id = $1', [id]);
  const tx = rows[0] as any;
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.status !== 'FINALIZED') return res.status(400).json({ error: 'Transaction must be finalized first' });

  const now = new Date().toISOString();
  await query('UPDATE transactions SET status = $1, settled_at = $2, archived_at = $3 WHERE id = $4', ['SETTLED', now, now, id]);

  const { rows: allocs } = await query<{ user_id: string; amount: number; name: string }>(`
    SELECT ta.user_id, ta.amount, u.name
    FROM transaction_allocations ta
    JOIN users u ON ta.user_id = u.id
    WHERE ta.transaction_id = $1
  `, [id]);
  res.json({ ok: true, status: 'SETTLED', allocations: allocs });
});
