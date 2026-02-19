/**
 * OCR receipt parsing via Mindee API.
 * Enqueue image → poll until Processed → fetch result → extract line items.
 */
import fs from 'node:fs';
import path from 'node:path';

const MINDEE_BASE = 'https://api-v2.mindee.net';
const MINDEE_ENQUEUE_URL = `${MINDEE_BASE}/v2/products/extraction/enqueue`;

const POLL_INTERVAL_MS = 800;
const MAX_POLL_MS = 60_000;

const MINDEE_MODEL_ID = '951265b1-352e-455d-9463-6d470b865295';

interface MindeeJob {
  id: string;
  status: 'Processing' | 'Failed' | 'Processed';
  polling_url: string;
  result_url?: string | null;
  error?: { detail?: string };
}

interface MindeeField {
  value?: string | number | null;
  fields?: Record<string, MindeeField>;
  items?: MindeeField[];
}

interface MindeeInference {
  id: string;
  result: {
    fields?: Record<string, MindeeField>;
  };
}

interface MindeeResultResponse {
  inference?: MindeeInference;
}

function getApiKey(): string {
  const key = process.env.MINDEE_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('MINDEE_API_KEY is not set. Add it to your environment.');
  }
  return key.trim();
}

function extractPrice(val: unknown): number | null {
  if (typeof val === 'number' && !Number.isNaN(val) && val > 0 && val < 99999) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(n) && n > 0 && n < 99999) return n;
  }
  return null;
}

function extractReceiptTotalValue(val: unknown): number | null {
  if (typeof val === 'number' && !Number.isNaN(val) && val > 0 && val < 999999) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(n) && n > 0 && n < 999999) return n;
  }
  return null;
}

function extractName(val: unknown): string {
  if (typeof val === 'string' && val.trim()) return val.trim().slice(0, 120);
  return '';
}

/**
 * Recursively find line-item-like arrays (objects with name + price) in Mindee result.
 */
function mapLineItemsFromFields(fields: Record<string, MindeeField> | undefined): { name: string; price: number }[] {
  const items: { name: string; price: number }[] = [];
  if (!fields || typeof fields !== 'object') return items;

  const nameKeys = ['description', 'product', 'name', 'item_name', 'title', 'label'];
  const priceKeys = ['total_amount', 'price', 'amount', 'total', 'unit_price'];

  function scanField(f: MindeeField): void {
    if (f.items && Array.isArray(f.items)) {
      for (const it of f.items) {
        if (it.fields) {
          let name = '';
          let price: number | null = null;
          for (const k of Object.keys(it.fields)) {
            const v = it.fields[k]?.value;
            if (nameKeys.some(nk => k.toLowerCase().includes(nk))) name = extractName(v) || name;
            if (priceKeys.some(pk => k.toLowerCase().includes(pk)) && price === null) price = extractPrice(v);
          }
          if (name && price !== null) items.push({ name, price });
        } else if (it.value != null) {
          // simple value - skip or use as name if we see a pattern
        }
        scanField(it);
      }
    }
    if (f.fields) {
      for (const v of Object.values(f.fields)) scanField(v);
    }
  }

  for (const v of Object.values(fields)) scanField(v);
  return items;
}

const RECEIPT_TOTAL_KEYS = ['total', 'total_amount', 'grand_total', 'amount', 'final_total', 'receipt_total'];

function extractReceiptTotal(fields: Record<string, MindeeField> | undefined): number | null {
  if (!fields || typeof fields !== 'object') return null;
  for (const key of RECEIPT_TOTAL_KEYS) {
    const f = fields[key];
    if (!f) continue;
    const v = f.value ?? (f.fields && typeof f.fields.value === 'object' ? f.fields.value?.value : undefined);
    const n = extractReceiptTotalValue(v);
    if (n != null && n > 0) return n;
  }
  return null;
}

export type ReceiptExtractionResult = {
  items: { name: string; price: number }[];
  receiptTotal?: number | null;
};

export async function extractReceiptItems(imagePath: string): Promise<ReceiptExtractionResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Receipt scanning is not configured. Use "Manual Entry" to add items by hand.');
  }

  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const fileName = path.basename(imagePath) || (ext === '.png' ? 'receipt.png' : 'receipt.jpg');

  const form = new FormData();
  form.append('model_id', MINDEE_MODEL_ID);
  form.append('file', new Blob([buffer], { type: mime }), fileName);

  const enqueueRes = await fetch(MINDEE_ENQUEUE_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
    },
    body: form,
  });

  const enqueueBody = await enqueueRes.text();
  let enqueueJson: { job?: MindeeJob };
  try {
    enqueueJson = JSON.parse(enqueueBody) as { job?: MindeeJob };
  } catch {
    console.warn('Mindee enqueue non-JSON:', enqueueRes.status, enqueueBody.slice(0, 200));
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  if (!enqueueRes.ok) {
    const err = enqueueJson as { detail?: string; title?: string };
    console.warn('Mindee enqueue error:', enqueueRes.status, err.detail ?? err.title ?? enqueueBody.slice(0, 200));
    if (enqueueRes.status === 401) {
      throw new Error('OCR is not configured. Check MINDEE_API_KEY in server/.env and ensure the key is valid.');
    }
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const job = enqueueJson.job;
  if (!job?.id || !job.polling_url) {
    console.warn('Mindee no job in response:', enqueueJson);
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const startedAt = Date.now();
  let resultUrl: string | null = null;

  while (Date.now() - startedAt < MAX_POLL_MS) {
    const pollRes = await fetch(`${job.polling_url}?redirect=false`, {
      method: 'GET',
      headers: { Authorization: apiKey },
    });
    const pollBody = await pollRes.text();
    let pollJson: { job?: MindeeJob };
    try {
      pollJson = JSON.parse(pollBody) as { job?: MindeeJob };
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    const j = pollJson.job;
    if (!j) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      continue;
    }

    if (j.status === 'Failed') {
      console.warn('Mindee job failed:', j.error?.detail ?? pollBody);
      throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
    }

    if (j.status === 'Processed' && j.result_url) {
      resultUrl = j.result_url;
      break;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!resultUrl) {
    console.warn('Mindee result timeout');
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const resultRes = await fetch(resultUrl, {
    method: 'GET',
    headers: { Authorization: apiKey },
  });
  const resultBody = await resultRes.text();
  let resultJson: MindeeResultResponse;
  try {
    resultJson = JSON.parse(resultBody) as MindeeResultResponse;
  } catch {
    console.warn('Mindee result non-JSON:', resultRes.status, resultBody.slice(0, 200));
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const fields = resultJson.inference?.result?.fields;
  const items = mapLineItemsFromFields(fields);
  const receiptTotal = extractReceiptTotal(fields);

  if (items.length === 0) {
    throw new Error('No line items found on the receipt. Try "Manual Entry" to add items by hand.');
  }

  return { items, receiptTotal: receiptTotal ?? null };
}
