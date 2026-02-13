import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
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

    const memberCheck = db.prepare(
      'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
    ).get(groupId, userId);

    if (!memberCheck) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const fullPath = path.join(uploadsDir, file.filename);

    // Run OCR first - if it fails, return error so user can try again (no receipt created)
    let items: { name: string; price: number }[];
    try {
      const ocrPromise = extractReceiptItems(fullPath);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Couldn\'t read the image. Please try again.')), 35_000)
      );
      items = await Promise.race([ocrPromise, timeout]);
    } catch (ocrErr) {
      // Delete the uploaded file since we're not keeping it
      try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
      const msg = ocrErr instanceof Error ? ocrErr.message : 'Couldn\'t read the image.';
      console.warn('OCR failed:', msg);
      return res.status(422).json({ error: 'Couldn\'t read the image. Please try again with a clearer photo.' });
    }

    const id = genId();
    const filePath = `/uploads/${file.filename}`;

    db.prepare(
      'INSERT INTO receipts (id, group_id, uploaded_by, file_path, total, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, groupId, userId, filePath, total ? parseFloat(total) : null, 'pending');

    let sortOrder = 0;
    for (const item of items) {
      try {
        db.prepare(
          'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).run(genId(), id, item.name, item.price, sortOrder++);
      } catch {
        // skip constraint errors
      }
    }

    const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id);
    res.status(201).json(receipt);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

receiptsRouter.get('/', requireAuth, (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ error: 'groupId query param required' });
    }
    const memberCheck = db.prepare(
      'SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?'
    ).get(groupId, userId);
    if (!memberCheck) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const receipts = db.prepare(
      'SELECT id, group_id, status, total, created_at, transaction_id FROM receipts WHERE group_id = ? ORDER BY created_at DESC'
    ).all(groupId) as { id: string; group_id: string; status: string; total: number | null; created_at: string; transaction_id: string | null }[];

    const withSplits = receipts.map((r) => {
      try {
        let splits: { user_id: string; amount: number; status: string; name: string }[];
        if (r.transaction_id) {
          splits = db.prepare(
            `SELECT ta.user_id, ta.amount, 'completed' as status, u.name
             FROM transaction_allocations ta
             JOIN users u ON ta.user_id = u.id
             WHERE ta.transaction_id = ?`
          ).all(r.transaction_id) as { user_id: string; amount: number; status: string; name: string }[];
        } else {
          splits = db.prepare(
            `SELECT rs.user_id, rs.amount, rs.status, u.name
             FROM receipt_splits rs
             JOIN users u ON rs.user_id = u.id
             WHERE rs.receipt_id = ?`
          ).all(r.id) as { user_id: string; amount: number; status: string; name: string }[];
        }
        return { ...r, splits };
      } catch {
        return { ...r, splits: [] };
      }
    });

    res.json(withSplits);
  } catch (err) {
    console.error('Receipts list error:', err);
    res.status(500).json({ error: 'Failed to load receipts' });
  }
});

receiptsRouter.get('/splits/me', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const rows = db.prepare(`
    SELECT rs.id, rs.receipt_id, rs.amount, rs.status, rs.created_at,
           r.group_id,
           g.name as group_name
    FROM receipt_splits rs
    JOIN receipts r ON rs.receipt_id = r.id
    JOIN groups g ON r.group_id = g.id
    WHERE rs.user_id = ?
    ORDER BY rs.created_at DESC
    LIMIT 50
  `).all(userId) as { id: string; receipt_id: string; amount: number; status: string; created_at: string; group_id: string; group_name: string }[];
  res.json(rows);
});

receiptsRouter.get('/:receiptId', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId } = req.params;

  const receipt = db.prepare(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = ? AND gm.user_id = ?'
  ).get(receiptId, userId) as any;

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  const items = db.prepare(
    'SELECT id, name, price, sort_order FROM receipt_items WHERE receipt_id = ? ORDER BY sort_order, id'
  ).all(receiptId) as { id: string; name: string; price: number; sort_order: number }[];

  const claims: Record<string, string[]> = {};
  for (const item of items) {
    const c = db.prepare(
      'SELECT user_id FROM item_claims WHERE receipt_item_id = ?'
    ).all(item.id) as { user_id: string }[];
    claims[item.id] = c.map((x) => x.user_id);
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email
    FROM group_members gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
  `).all(receipt.group_id) as { id: string; name: string; email: string }[];

  res.json({ ...receipt, items, claims, members });
});

receiptsRouter.post('/:receiptId/items', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId } = req.params;
  const { name, price } = req.body;

  const receipt = db.prepare(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = ? AND gm.user_id = ?'
  ).get(receiptId, userId);

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }
  if (!name || typeof price !== 'number') {
    return res.status(400).json({ error: 'name and price are required' });
  }

  const id = genId();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM receipt_items WHERE receipt_id = ?').get(receiptId) as { m: number };
  db.prepare(
    'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).run(id, receiptId, String(name).trim(), price, (maxOrder?.m ?? 0) + 1);

  const item = db.prepare('SELECT id, name, price, sort_order FROM receipt_items WHERE id = ?').get(id);
  res.status(201).json(item);
});

receiptsRouter.put('/:receiptId/items/:itemId/claims', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId, itemId } = req.params;
  const { userIds } = req.body;

  const receipt = db.prepare(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = ? AND gm.user_id = ?'
  ).get(receiptId, userId);

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  const item = db.prepare('SELECT id FROM receipt_items WHERE id = ? AND receipt_id = ?').get(itemId, receiptId);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const ids = Array.isArray(userIds) ? userIds : [];
  db.prepare('DELETE FROM item_claims WHERE receipt_item_id = ?').run(itemId);
  for (const uid of ids) {
    const isMember = db.prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get((receipt as any).group_id, uid);
    if (isMember) {
      db.prepare('INSERT OR IGNORE INTO item_claims (receipt_item_id, user_id) VALUES (?, ?)').run(itemId, uid);
    }
  }

  const claims = db.prepare('SELECT user_id FROM item_claims WHERE receipt_item_id = ?').all(itemId) as { user_id: string }[];
  res.json({ userIds: claims.map((c) => c.user_id) });
});

receiptsRouter.post('/:receiptId/complete', requireAuth, (req, res) => {
  const { userId } = (req as any).user;
  const { receiptId } = req.params;

  const receipt = db.prepare(
    'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = ? AND gm.user_id = ?'
  ).get(receiptId, userId) as any;

  if (!receipt) {
    return res.status(404).json({ error: 'Receipt not found' });
  }

  const items = db.prepare(
    'SELECT id, price FROM receipt_items WHERE receipt_id = ?'
  ).all(receiptId) as { id: string; price: number }[];

  const userTotals: Record<string, number> = {};
  for (const item of items) {
    const claimers = db.prepare('SELECT user_id FROM item_claims WHERE receipt_item_id = ?').all(item.id) as { user_id: string }[];
    const uids = claimers.map((c) => c.user_id);
    if (uids.length === 0) continue;
    const share = item.price / uids.length;
    for (const uid of uids) {
      userTotals[uid] = (userTotals[uid] ?? 0) + share;
    }
  }

  db.prepare('DELETE FROM receipt_splits WHERE receipt_id = ?').run(receiptId);
  for (const [uid, amount] of Object.entries(userTotals)) {
    if (amount > 0) {
      db.prepare(
        'INSERT INTO receipt_splits (id, receipt_id, user_id, amount, status) VALUES (?, ?, ?, ?, ?)'
      ).run(genId(), receiptId, uid, amount, 'pending');
    }
  }

  db.prepare('UPDATE receipts SET status = ? WHERE id = ?').run('completed', receiptId);

  const splits = db.prepare(`
    SELECT rs.user_id, rs.amount, u.name
    FROM receipt_splits rs
    JOIN users u ON rs.user_id = u.id
    WHERE rs.receipt_id = ?
  `).all(receiptId) as { user_id: string; amount: number; name: string }[];
  res.json({ ok: true, splits });
});
