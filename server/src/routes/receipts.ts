import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { processReceipt } from '../receiptProcessor.js';
import { validateReceipt } from '../receiptValidation.js';
import type { ParsedReceipt } from '../ocr/types.js';

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
    const { groupId } = req.body;
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

    const id = genId();
    const filePath = `/uploads/${file.filename}`;
    const fullPath = path.join(uploadsDir, file.filename);
    const provider = process.env.RECEIPT_OCR_PROVIDER || 'mock';
    console.log('[Receipt] upload: receiptId=', id, 'groupId=', groupId, 'provider=', provider, 'file=', file.filename);

    // Insert receipt as UPLOADED first (file is already saved by multer)
    db.prepare(
      `INSERT INTO receipts (id, group_id, uploaded_by, file_path, total, status, parsed_output, confidence_map, failure_reason)
       VALUES (?, ?, ?, ?, NULL, 'UPLOADED', NULL, NULL, NULL)`
    ).run(id, groupId, userId, filePath);

    let parsed: ParsedReceipt;
    let confidenceMap: Record<string, unknown>;
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Couldn\'t read the image. Please try again.')), 35_000)
      );
      const result = await Promise.race([processReceipt(fullPath), timeout]);
      parsed = result.parsed;
      confidenceMap = result.confidence as unknown as Record<string, unknown>;
    } catch (ocrErr) {
      const msg = ocrErr instanceof Error ? ocrErr.message : 'Processing failed';
      db.prepare(
        'UPDATE receipts SET status = ?, failure_reason = ? WHERE id = ?'
      ).run('FAILED', msg, id);
      console.warn('[Receipt] processing failed:', msg);
      if (ocrErr instanceof Error && ocrErr.stack) console.warn('[Receipt] stack:', ocrErr.stack);
      return res.status(422).json({ error: 'Couldn\'t read the image. Please try again with a clearer photo.' });
    }

    const totalNum = parsed.totals.total ?? parsed.totals.subtotal ?? null;
    console.log('[Receipt] upload success: receiptId=', id, 'totals=', parsed.totals, 'lineItemCount=', parsed.lineItems.length);
    db.prepare(
      `UPDATE receipts SET status = 'NEEDS_REVIEW', parsed_output = ?, confidence_map = ?, total = ? WHERE id = ?`
    ).run(JSON.stringify(parsed), JSON.stringify(confidenceMap), totalNum, id);

    // Sync receipt_items from parsed for backward compatibility with claims/split UI
    let sortOrder = 0;
    for (const item of parsed.lineItems) {
      try {
        db.prepare(
          'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)'
        ).run(genId(), id, item.name, item.price, sortOrder++);
      } catch {
        // skip constraint errors
      }
    }

    const validation = validateReceipt(parsed);
    console.log('[Receipt] upload validation:', validation.isValid ? 'OK' : 'FAIL', validation.issues?.length ? validation.issues : '');
    const receipt = db.prepare('SELECT * FROM receipts WHERE id = ?').get(id) as Record<string, unknown>;
    const out = {
      ...receipt,
      parsed_output: parsed,
      confidence_map: confidenceMap,
      validation: { isValid: validation.isValid, issues: validation.issues, suggestedFieldsToReview: validation.suggestedFieldsToReview },
    };
    res.status(201).json(out);
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

  let parsed_output: ParsedReceipt | null = null;
  let confidence_map: Record<string, unknown> | null = null;
  let final_snapshot: ParsedReceipt | null = null;
  let validation: { isValid: boolean; issues: string[]; suggestedFieldsToReview: string[] } | null = null;

  if (receipt.parsed_output && typeof receipt.parsed_output === 'string') {
    try {
      parsed_output = JSON.parse(receipt.parsed_output) as ParsedReceipt;
      validation = validateReceipt(parsed_output);
    } catch {
      /* ignore */
    }
  }
  if (receipt.confidence_map && typeof receipt.confidence_map === 'string') {
    try {
      confidence_map = JSON.parse(receipt.confidence_map) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  if (receipt.final_snapshot && typeof receipt.final_snapshot === 'string') {
    try {
      final_snapshot = JSON.parse(receipt.final_snapshot) as ParsedReceipt;
    } catch {
      /* ignore */
    }
  }

  res.json({
    ...receipt,
    items,
    claims,
    members,
    parsed_output: parsed_output ?? undefined,
    confidence_map: confidence_map ?? undefined,
    final_snapshot: final_snapshot ?? undefined,
    validation: validation ?? undefined,
  });
});

receiptsRouter.post('/:receiptId/confirm', requireAuth, (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { receiptId } = req.params;
    const body = req.body as ParsedReceipt;
    console.log('[Receipt] confirm: receiptId=', receiptId);

    const receipt = db.prepare(
      'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = ? AND gm.user_id = ?'
    ).get(receiptId, userId) as any;

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    if (!body || !body.totals || !Array.isArray(body.lineItems)) {
      return res.status(400).json({ error: 'Invalid receipt payload: totals and lineItems required' });
    }

    const validation = validateReceipt(body);
    if (!validation.isValid) {
      console.log('[Receipt] confirm rejected: validation issues=', validation.issues);
      return res.status(400).json({ error: 'Receipt does not reconcile', validation });
    }

    const totalNum = body.totals.total ?? body.totals.subtotal ?? null;
    console.log('[Receipt] confirm success: receiptId=', receiptId, 'totals=', body.totals, 'lineItemCount=', body.lineItems.length);
    db.prepare(
      'UPDATE receipts SET status = ?, final_snapshot = ?, total = ? WHERE id = ?'
    ).run('DONE', JSON.stringify(body), totalNum, receiptId);

    db.prepare('DELETE FROM receipt_items WHERE receipt_id = ?').run(receiptId);
    let sortOrder = 0;
    for (const item of body.lineItems) {
      db.prepare(
        'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(genId(), receiptId, item.name, item.price, sortOrder++);
    }

    res.json({ ok: true, receipt: { id: receiptId, status: 'DONE', final_snapshot: body } });
  } catch (err) {
    console.error('[Receipt] confirm error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Confirm failed' });
  }
});

receiptsRouter.post('/:receiptId/retry', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { receiptId } = req.params;
    console.log('[Receipt] retry: receiptId=', receiptId);

    const receipt = db.prepare(
      'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = ? AND gm.user_id = ?'
    ).get(receiptId, userId) as any;

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    if (!receipt.file_path) {
      return res.status(400).json({ error: 'No image to retry' });
    }

    const fullPath = path.join(uploadsDir, path.basename(receipt.file_path));
    if (!fs.existsSync(fullPath)) {
      return res.status(400).json({ error: 'Image file no longer available' });
    }

    let parsed: ParsedReceipt;
    let confidenceMap: Record<string, unknown>;
    try {
      const result = await processReceipt(fullPath);
      parsed = result.parsed;
      confidenceMap = result.confidence as unknown as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Processing failed';
      console.warn('[Receipt] retry failed: receiptId=', receiptId, msg);
      if (err instanceof Error && err.stack) console.warn('[Receipt] retry stack:', err.stack);
      db.prepare(
        'UPDATE receipts SET status = ?, failure_reason = ?, parsed_output = NULL, confidence_map = NULL WHERE id = ?'
      ).run('FAILED', msg, receiptId);
      return res.status(422).json({ error: msg });
    }

    const totalNum = parsed.totals.total ?? parsed.totals.subtotal ?? null;
    const validation = validateReceipt(parsed);
    console.log('[Receipt] retry success: receiptId=', receiptId, 'totals=', parsed.totals, 'lineItemCount=', parsed.lineItems.length, 'validation=', validation.isValid ? 'OK' : validation.issues);
    db.prepare(
      'UPDATE receipts SET status = ?, parsed_output = ?, confidence_map = ?, total = ?, failure_reason = NULL WHERE id = ?'
    ).run('NEEDS_REVIEW', JSON.stringify(parsed), JSON.stringify(confidenceMap), totalNum, receiptId);

    db.prepare('DELETE FROM receipt_items WHERE receipt_id = ?').run(receiptId);
    let sortOrder = 0;
    for (const item of parsed.lineItems) {
      db.prepare(
        'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(genId(), receiptId, item.name, item.price, sortOrder++);
    }

    const updated = db.prepare('SELECT * FROM receipts WHERE id = ?').get(receiptId) as Record<string, unknown>;
    res.json({
      ...updated,
      parsed_output: parsed,
      confidence_map: confidenceMap,
      validation: { isValid: validation.isValid, issues: validation.issues, suggestedFieldsToReview: validation.suggestedFieldsToReview },
    });
  } catch (err) {
    console.error('[Receipt] retry error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Retry failed' });
  }
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
