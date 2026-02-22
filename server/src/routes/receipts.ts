import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import convert from 'heic-convert';
import extractd from 'extractd';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { emitToGroup } from '../socket.js';
import { processReceipt } from '../receiptProcessor.js';
import { validateReceipt } from '../receiptValidation.js';
import type { ParsedReceipt } from '../ocr/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIMES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/x-png',
  'image/heic',
  'image/heif',
  'image/x-adobe-dng', // iPhone ProRAW / raw from photo library
  'image/dng',
  'application/octet-stream', // some clients send raw as octet-stream
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)?.toLowerCase() || '.jpg';
    const safeExt = ['.png', '.jpg', '.jpeg', '.heic', '.heif', '.dng'].includes(ext) ? ext : '.jpg';
    cb(null, `${crypto.randomUUID()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80MB for ProRAW / raw
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname)?.toLowerCase();
    const mimeOk = ALLOWED_MIMES.includes(file.mimetype);
    const rawByExt = file.mimetype === 'application/octet-stream' && ext === '.dng';
    if (mimeOk || rawByExt) cb(null, true);
    else cb(new Error('Please upload PNG, JPG, HEIC, or raw (e.g. ProRAW/DNG) from camera or photo library'));
  },
});

export const receiptsRouter = Router();

function genId() {
  return crypto.randomUUID();
}

/** If the file is HEIC/HEIF or raw (DNG/ProRAW), convert to JPEG and return the new path; otherwise return original path. */
async function ensureJpegForOcr(heicOrJpegPath: string): Promise<{ path: string; pathUrl: string }> {
  const ext = path.extname(heicOrJpegPath).toLowerCase();
  const dir = path.dirname(heicOrJpegPath);
  const base = path.basename(heicOrJpegPath, ext);
  const jpegPath = path.join(dir, base + '.jpg');

  if (ext === '.dng') {
    // iPhone ProRAW / raw from photo library: extract embedded preview via exiftool
    const result = await extractd.generate(heicOrJpegPath, { destination: dir });
    if ((result as { error?: string }).error) {
      throw new Error('Could not read raw/ProRAW image. Try exporting as HEIC or JPEG from Photos.');
    }
    const out = result as { preview: string; source: string };
    fs.unlinkSync(heicOrJpegPath);
    // extractd may write with a different name; ensure we use our expected path for OCR
    if (path.resolve(out.preview) !== path.resolve(jpegPath)) {
      fs.renameSync(out.preview, jpegPath);
    }
    return { path: jpegPath, pathUrl: `/uploads/${path.basename(jpegPath)}` };
  }

  if (ext === '.heic' || ext === '.heif') {
    const inputBuffer = fs.readFileSync(heicOrJpegPath);
    const outputBuffer = await convert({
      buffer: inputBuffer as unknown as ArrayBuffer,
      format: 'JPEG',
      quality: 0.9,
    });
    fs.writeFileSync(jpegPath, Buffer.from(outputBuffer));
    fs.unlinkSync(heicOrJpegPath);
    return { path: jpegPath, pathUrl: `/uploads/${path.basename(jpegPath)}` };
  }

  return { path: heicOrJpegPath, pathUrl: `/uploads/${path.basename(heicOrJpegPath)}` };
}

/** Create empty receipt for manual entry (no image) */
receiptsRouter.post('/', requireAuth, async (req, res) => {
  const { userId } = (req as any).user;
  const { groupId } = req.body;
  if (!groupId) return res.status(400).json({ error: 'groupId is required' });
  const { rows: memberRows } = await query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, userId]);
  if (memberRows.length === 0) return res.status(404).json({ error: 'Group not found' });
  const id = genId();
  await query(
    'INSERT INTO receipts (id, group_id, uploaded_by, file_path, total, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, groupId, userId, null, null, 'pending']
  );
  const { rows } = await query('SELECT * FROM receipts WHERE id = $1', [id]);
  res.status(201).json(rows[0]);
  void emitToGroup(groupId, 'group:updated', { groupId });
});

receiptsRouter.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { groupId } = req.body;
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

    const id = genId();
    let fullPath = path.join(uploadsDir, file.filename);
    const { path: fullPathForOcr, pathUrl: filePath } = await ensureJpegForOcr(fullPath);
    fullPath = fullPathForOcr;
    const provider = process.env.RECEIPT_OCR_PROVIDER || 'mock';
    console.log('[Receipt] upload: receiptId=', id, 'groupId=', groupId, 'provider=', provider, 'file=', path.basename(fullPath));

    // Insert receipt as UPLOADED first (file is already saved by multer; HEIC may have been converted to JPEG)
    await query(
      `INSERT INTO receipts (id, group_id, uploaded_by, file_path, total, status, parsed_output, confidence_map, failure_reason)
       VALUES ($1, $2, $3, $4, NULL, 'UPLOADED', NULL, NULL, NULL)`,
      [id, groupId, userId, filePath]
    );

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
      try { fs.unlinkSync(fullPath); } catch { /* ignore */ }
      const msg = ocrErr instanceof Error ? ocrErr.message : 'Processing failed';
      await query(
        'UPDATE receipts SET status = $1, failure_reason = $2 WHERE id = $3',
        ['FAILED', msg, id]
      );
      console.warn('[Receipt] processing failed:', msg);
      if (ocrErr instanceof Error && ocrErr.stack) console.warn('[Receipt] stack:', ocrErr.stack);
      return res.status(422).json({ error: 'Couldn\'t read the image. Please try again with a clearer photo.' });
    }

    const totalNum = parsed.totals.total ?? parsed.totals.subtotal ?? null;
    console.log('[Receipt] upload success: receiptId=', id, 'totals=', parsed.totals, 'lineItemCount=', parsed.lineItems.length);
    await query(
      `UPDATE receipts SET status = 'NEEDS_REVIEW', parsed_output = $1, confidence_map = $2, total = $3 WHERE id = $4`,
      [JSON.stringify(parsed), JSON.stringify(confidenceMap), totalNum, id]
    );

    // Sync receipt_items from parsed for backward compatibility with claims/split UI
    let sortOrder = 0;
    for (const item of parsed.lineItems) {
      try {
        await query(
          'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
          [genId(), id, item.name, item.price, sortOrder++]
        );
      } catch {
        // skip constraint errors
      }
    }

    const validation = validateReceipt(parsed);
    console.log('[Receipt] upload validation:', validation.isValid ? 'OK' : 'FAIL', validation.issues?.length ? validation.issues : '');
    void emitToGroup(groupId, 'group:updated', { groupId });
    const { rows } = await query('SELECT * FROM receipts WHERE id = $1', [id]);
    const receipt = rows[0] as Record<string, unknown>;
    res.status(201).json({
      ...receipt,
      parsed_output: parsed,
      confidence_map: confidenceMap,
      validation: { isValid: validation.isValid, issues: validation.issues, suggestedFieldsToReview: validation.suggestedFieldsToReview },
    });
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

receiptsRouter.post('/:receiptId/confirm', requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const { receiptId } = req.params;
    const body = req.body as ParsedReceipt;
    console.log('[Receipt] confirm: receiptId=', receiptId);

    const { rows } = await query(
      'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = $1 AND gm.user_id = $2',
      [receiptId, userId]
    );
    const receipt = rows[0] as any;

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
    await query(
      'UPDATE receipts SET status = $1, final_snapshot = $2, total = $3 WHERE id = $4',
      ['DONE', JSON.stringify(body), totalNum, receiptId]
    );

    await query('DELETE FROM receipt_items WHERE receipt_id = $1', [receiptId]);
    let sortOrder = 0;
    for (const item of body.lineItems) {
      await query(
        'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [genId(), receiptId, item.name, item.price, sortOrder++]
      );
    }

    res.json({ ok: true, receipt: { id: receiptId, status: 'DONE', final_snapshot: body } });
    void emitToGroup(receipt.group_id, 'group:updated', { groupId: receipt.group_id });
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

    const { rows: receiptRows } = await query(
      'SELECT r.* FROM receipts r JOIN group_members gm ON r.group_id = gm.group_id WHERE r.id = $1 AND gm.user_id = $2',
      [receiptId, userId]
    );
    const receipt = receiptRows[0] as any;

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
      await query(
        'UPDATE receipts SET status = $1, failure_reason = $2, parsed_output = NULL, confidence_map = NULL WHERE id = $3',
        ['FAILED', msg, receiptId]
      );
      return res.status(422).json({ error: msg });
    }

    const totalNum = parsed.totals.total ?? parsed.totals.subtotal ?? null;
    const validation = validateReceipt(parsed);
    console.log('[Receipt] retry success: receiptId=', receiptId, 'totals=', parsed.totals, 'lineItemCount=', parsed.lineItems.length, 'validation=', validation.isValid ? 'OK' : validation.issues);
    await query(
      'UPDATE receipts SET status = $1, parsed_output = $2, confidence_map = $3, total = $4, failure_reason = NULL WHERE id = $5',
      ['NEEDS_REVIEW', JSON.stringify(parsed), JSON.stringify(confidenceMap), totalNum, receiptId]
    );

    await query('DELETE FROM receipt_items WHERE receipt_id = $1', [receiptId]);
    let sortOrder = 0;
    for (const item of parsed.lineItems) {
      await query(
        'INSERT INTO receipt_items (id, receipt_id, name, price, sort_order) VALUES ($1, $2, $3, $4, $5)',
        [genId(), receiptId, item.name, item.price, sortOrder++]
      );
    }

    void emitToGroup(receipt.group_id, 'group:updated', { groupId: receipt.group_id });
    const { rows: updatedRows } = await query('SELECT * FROM receipts WHERE id = $1', [receiptId]);
    const updated = updatedRows[0] as Record<string, unknown>;
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
  const groupId = (receipt as { group_id: string }).group_id;
  void emitToGroup(groupId, 'group:updated', { groupId });
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

  // Only the host (uploader) may change claims while receipt is in NEEDS_REVIEW/UPLOADED; members wait until host confirms (DONE)
  const uploaderId = (receipt as { uploaded_by?: string }).uploaded_by;
  if (['NEEDS_REVIEW', 'UPLOADED'].includes(receipt.status) && uploaderId !== userId) {
    return res.status(403).json({ error: 'Wait for the host to confirm the receipt before selecting items' });
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
      const placeholders = validIds.map((_, i) => `($1, $${i + 2}, $${validIds.length + 2})`).join(', ');
      await query(
        `INSERT INTO item_claims (receipt_item_id, user_id, receipt_id) VALUES ${placeholders} ON CONFLICT (receipt_item_id, user_id) DO NOTHING`,
        [itemId, ...validIds, receiptId]
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
  void emitToGroup(receipt.group_id, 'group:updated', { groupId: receipt.group_id });
  void emitToGroup(receipt.group_id, 'activity:changed', { groupId: receipt.group_id });
  res.json({ ok: true, splits });
});
