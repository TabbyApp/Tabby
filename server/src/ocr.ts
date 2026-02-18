/**
 * OCR receipt parsing via TabScanner API.
 * Process endpoint returns a token; we wait ~5s then poll the result endpoint until done.
 */
import fs from 'node:fs';
import path from 'node:path';

const TABSCANNER_PROCESS_URL = 'https://api.tabscanner.com/api/2/process';
const TABSCANNER_RESULT_URL = 'https://api.tabscanner.com/api/result';
const INITIAL_WAIT_MS = 5500;
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_MS = 25_000;

interface TabScannerProcessResponse {
  token?: string;
  duplicate?: boolean;
  duplicateToken?: string;
  success?: boolean;
  status_code?: number;
  code?: number;
  message?: string;
}

interface LineItem {
  lineTotal?: number;
  descClean?: string;
  desc?: string;
  price?: number;
  qty?: number;
}

interface TabScannerResultResponse {
  status?: 'done' | 'pending' | 'failed';
  success?: boolean;
  status_code?: number;
  code?: number;
  result?: {
    lineItems?: LineItem[];
  };
}

function getApiKey(): string {
  const key = process.env.TABSCANNER_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('TABSCANNER_API_KEY is not set. Add it to your environment.');
  }
  return key.trim();
}

function mapLineItems(lineItems: LineItem[] | undefined): { name: string; price: number }[] {
  if (!Array.isArray(lineItems)) return [];
  const items: { name: string; price: number }[] = [];
  for (const line of lineItems) {
    const name = (line.descClean ?? line.desc ?? '').trim();
    const price = line.lineTotal ?? line.price ?? 0;
    if (!name || typeof price !== 'number' || Number.isNaN(price) || price <= 0 || price > 99999) continue;
    if (name.length > 120) continue;
    items.push({ name, price });
  }
  return items;
}

export async function extractReceiptItems(imagePath: string): Promise<{ name: string; price: number }[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('Receipt scanning is not configured. Use "Manual Entry" to add items by hand.');
  }

  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const fileName = path.basename(imagePath) || (ext === '.png' ? 'receipt.png' : 'receipt.jpg');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), fileName);

  const processRes = await fetch(TABSCANNER_PROCESS_URL, {
    method: 'POST',
    headers: {
      apikey: apiKey,
    },
    body: form,
  });

  const processBody = await processRes.text();
  let processJson: TabScannerProcessResponse;
  try {
    processJson = JSON.parse(processBody) as TabScannerProcessResponse;
  } catch {
    console.warn('TabScanner process non-JSON response:', processRes.status, processBody.slice(0, 200));
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  if (!processRes.ok) {
    console.warn('TabScanner process error:', processJson.code ?? processRes.status, processJson.message ?? processRes.status);
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  if (!processJson.success) {
    console.warn('TabScanner process not success:', processJson.message ?? 'TabScanner rejected the image', processJson);
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const token = processJson.duplicate && processJson.duplicateToken
    ? processJson.duplicateToken
    : processJson.token;

  if (!token) {
    console.warn('TabScanner no token in response:', processJson);
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  await new Promise((r) => setTimeout(r, INITIAL_WAIT_MS));

  const startedAt = Date.now();
  let last: TabScannerResultResponse = {};

  while (Date.now() - startedAt < MAX_POLL_MS) {
    const resultRes = await fetch(`${TABSCANNER_RESULT_URL}/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: {
        apikey: apiKey,
      },
    });

    const contentType = resultRes.headers.get('content-type') ?? '';
    const body = await resultRes.text();
    if (!contentType.includes('application/json')) {
      console.warn('TabScanner result non-JSON response:', resultRes.status, body.slice(0, 200));
      throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
    }
    try {
      last = JSON.parse(body) as TabScannerResultResponse;
    } catch {
      console.warn('TabScanner result parse error:', body.slice(0, 200));
      throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
    }

    if (last.status === 'done' && last.result?.lineItems) {
      return mapLineItems(last.result.lineItems);
    }

    if (last.status === 'failed') {
      console.warn('TabScanner result failed:', last.code, last);
      throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.warn('TabScanner result timeout');
  throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
}
