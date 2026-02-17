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
    const ok = ALLOWED_MIMES.includes(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error('Please upload PNG or JPG'));
  },
});

export const receiptsRouter = Router();

function genId() {
  return crypto.randomUUID();
}

receiptsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { groupId, total } = req.body;
    const file = req.file;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const { rows: memberRows } = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );

    if (memberRows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const fullPath = path.join(uploadsDir, file.filename);

    let items: { name: string; price: number }[];
    try {
      const ocrPromise = extractReceiptItems(fullPath);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Couldn\'t read the image. Please try again.')), 35_000)
      );
      items = await Promise.race([ocrPromise, timeout]);
    } catch (ocrErr) {
      try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
      const msg = ocrErr instanceof Error ? ocrErr.message : 'Couldn\'t read the image.';
      console.warn('OCR failed:', msg);
      return res.status(422).json({ error: 'Couldn\'t read the image. Please try again with a clearer photo.' });
    }

    const id = genId();
    const filePath = `/uploads/${file.filename}`;

    await query(
      'INSERT INTO receipts (id, group_id, uploaded_by, file_path, total, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, groupId, userId, filePath, total ? parseFloat(total) : null, 'pending']
    );

    let sortOrder = 0;
    for (const item of items) {
      try {
        await query(
          'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
          [genId(), id, item.name, item.price, sortOrder++]
        );
      } catch {
        // skip constraint errors
      }
    }

    const { rows } = await query('SELECT * FROM receipts WHERE id = $1', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

receiptsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ error: 'groupId query param required' });
    }
    const { rows: memberRows } = await query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (memberRows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const { rows: receipts } = await query<{ id: string; group_id: string; status: string; total: number | null; created_at: string; transaction_id: string | null }>(
      'SELECT id, group_id, status, total, created_at, transaction_id FROM receipts WHERE group_id = $1 ORDER BY created_at DESC',
      [groupId]
    );

    const withSplits = await Promise.all(receipts.map(async (r) => {
      try {
        let splits: { user_id: string; amount: number; status: string; name: string }[];
        if (r.transaction_id) {
          const { rows: splitRows } = await query<{ user_id: string; amount: number; status: string; name: string }>(
            `SELECT ta.user_id, ta.amount, 'completed' as status, u.name
             FROM transaction_allocations ta
             JOIN users u ON ta.user_id = u.id
             WHERE ta.transaction_id = $1`,
            [r.transaction_id]
          );
          splits = splitRows;
        } else {
          const { rows: splitRows } = await query<{ user_id: string; amount: number; status: string; name: string }>(
            `SELECT rs.user_id, rs.amount, rs.status, u.name
             FROM receipt_splits rs
             JOIN users u ON rs.user_id = u.id
             WHERE rs.receipt_id = $1`,
            [r.id]
          );
          splits = splitRows;
        }
        return { ...r, splits };
      } catch {
        return { ...r, splits: [] };
      }
    }));

    res.json(withSplits);
  } catch (err) {
    console.error('Receipts list error:', err);
    res.status(500).json({ error: 'Failed to load receipts' });
  }
});

receiptsRouter.get('/splits/me', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { rows } = await query<{ id: string; receipt_id: string; amount: number; status: string; created_at: string; group_id: string; group_name: string }>(`
    SELECT rs.id, rs.receipt_id, rs.amount, rs.status, rs.created_at,
           r.group_id,
           g.name as group_name
    FROM receipt_splits rs
    JOIN receipts r ON rs.receipt_id = r.id
    JOIN groups g ON r.group_id = g.id
    WHERE rs.user_id = $1
    ORDER BY rs.created_at DESC
    LIMIT 50
  `, [userId]);
  res.json(rows);
});

receiptsRouter.get('/:receiptId', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId } = req.params;

  const { rows } = await query(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = $1 AND gm.user_id = $2',
    [receiptId, userId]
  );
  const receipt = rows[0] as any;

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  const { rows: items } = await query<{ id: string; name: string; price: number; sort_order: number }>(
    'SELECT id, name, price, sort_order FROM receipt_items WHERE receipt_id = $1 ORDER BY sort_order, id',
    [receiptId]
  );

  const claims: Record<string, string[]> = {};
  if (items.length > 0) {
    const itemIds = items.map((i) => i.id);
    const { rows: claimRows } = await query<{ receipt_item_id: string; user_id: string }>(
      'SELECT receipt_item_id, user_id FROM item_claims WHERE receipt_item_id = ANY($1)',
      [itemIds]
    );
    for (const row of claimRows) {
      if (!claims[row.receipt_item_id]) claims[row.receipt_item_id] = [];
      claims[row.receipt_item_id].push(row.user_id);
    }
  }

  const { rows: members } = await query<{ id: string; name: string; email: string }>(`
    SELECT u.id, u.name, u.email
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = $1
  `, [receipt.group_id]);

  res.json({ ...receipt, items, claims, members });
});

receiptsRouter.post('/:receiptId/items', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId } = req.params;
  const { name, price } = req.body;

  const { rows } = await query(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = $1 AND gm.user_id = $2',
    [receiptId, userId]
  );
  const receipt = rows[0];

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'name and price are required' });
  }

  const id = genId();
  const { rows: maxRows } = await query<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0)::int as m FROM receipt_items WHERE receipt_id = $1', [receiptId]);
  const maxOrder = maxRows[0]?.m ?? 0;
  await query(
    'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
    [id, receiptId, String(name).trim(), price, maxOrder + 1]
  );

  const { rows: itemRows } = await query('SELECT id, name, price, sort_order FROM receipt_items WHERE id = $1', [id]);
  res.status(201).json(itemRows[0]);
});

receiptsRouter.put('/:receiptId/items/:itemId/claims', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId, itemId } = req.params;
  const { userIds } = req.body;

  const { rows } = await query(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = $1 AND gm.user_id = $2',
    [receiptId, userId]
  );
  const receipt = rows[0] as any;

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  const { rows: itemRows } = await query<{ id: string }>('SELECT id FROM receipt_items WHERE id = $1 AND receipt_id = $2', [itemId, receiptId]);
  if (itemRows.length === 0) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const ids = Array.isArray(userIds) ? (userIds as string[]).filter(Boolean) : [];
  await query('DELETE FROM item_claims WHERE receipt_item_id = $1', [itemId]);
  if (ids.length > 0) {
    const { rows: memberRows } = await query<{ user_id: string }>(
      'SELECT user_id FROM group_members WHERE group_id = $1 AND user_id = ANY($2)',
      [receipt.group_id, ids]
    );
    const validIds = memberRows.map((r) => r.user_id);
    if (validIds.length > 0) {
      const placeholders = validIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO item_claims (receipt_item_id, user_id) VALUES ${placeholders} ON CONFLICT (receipt_item_id, user_id) DO NOTHING`,
        [itemId, ...validIds]
      );
    }
  }

  const { rows: claimRows } = await query<{ user_id: string }>('SELECT user_id FROM item_claims WHERE receipt_item_id = $1', [itemId]);
  res.json({ userIds: claimRows.map((c) => c.user_id) });
});

receiptsRouter.post('/:receiptId/complete', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId } = req.params;

  const { rows } = await query(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = $1 AND gm.user_id = $2',
    [receiptId, userId]
  );
  const receipt = rows[0] as any;

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  const { rows: items } = await query<{ id: string; price: number }>(
    'SELECT id, price FROM receipt_items WHERE receipt_id = $1',
    [receiptId]
  );

  const userTotals: Record<string, number> = {};
  for (const item of items) {
    const { rows: claimRows } = await query<{ user_id: string }>('SELECT user_id FROM item_claims WHERE receipt_item_id = $1', [item.id]);
    const uids = claimRows.map((c) => c.user_id);
    if (uids.length === 0) continue;
    const share = item.price / uids.length;
    for (const uid of uids) {
      userTotals[uid] = (userTotals[uid] ?? 0) + share;
    }
  }

  await query('DELETE FROM receipt_splits WHERE receipt_id = $1', [receiptId]);
  for (const [uid, amount] of Object.entries(userTotals)) {
    if (amount > 0) {
      await query(
        'INSERT INTO receipt_splits (id, receipt_id, user_id, amount, status) VALUES ($1, $2, $3, $4, $5)',
        [genId(), receiptId, uid, amount, 'pending']
      );
    }
  }

  await query('UPDATE receipts SET status = $1 WHERE id = $2', ['completed', receiptId]);

  const { rows: splits } = await query<{ user_id: string; amount: number; name: string }>(`
    SELECT rs.user_id, rs.amount, u.name
    FROM receipt_splits rs
    JOIN users u ON rs.user_id = u.id
    WHERE rs.receipt_id = $1
  `, [receiptId]);
  res.json({ ok: true, splits });
});
