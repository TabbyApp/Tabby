/**
 * TabScanner API OCR provider. Requires TABSCANNER_API_KEY in env.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { RawOcrOutput, RawOcrLineItem } from './types.js';

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

interface TabScannerLineItem {
  lineTotal?: number;
  descClean?: string;
  desc?: string;
  price?: number;
  qty?: number;
}

interface TabScannerResultResponse {
  status?: 'done' | 'pending' | 'failed';
  success?: boolean;
  result?: {
    lineItems?: TabScannerLineItem[];
  };
  code?: number;
}

function getApiKey(): string {
  const key = process.env.TABSCANNER_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('TABSCANNER_API_KEY is not set. Add it to your environment.');
  }
  return key.trim();
}

function toRawLineItem(line: TabScannerLineItem): RawOcrLineItem {
  return {
    desc: line.desc,
    descClean: line.descClean,
    lineTotal: line.lineTotal,
    price: line.price,
    qty: line.qty,
  };
}

export async function tabScannerOcr(imagePath: string): Promise<RawOcrOutput> {
  const apiKey = getApiKey();

  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  const fileName = path.basename(imagePath) || (ext === '.png' ? 'receipt.png' : 'receipt.jpg');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), fileName);

  const processRes = await fetch(TABSCANNER_PROCESS_URL, {
    method: 'POST',
    headers: { apikey: apiKey },
    body: form,
  });

  const processBody = await processRes.text();
  let processJson: TabScannerProcessResponse;
  try {
    processJson = JSON.parse(processBody) as TabScannerProcessResponse;
  } catch {
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  if (!processRes.ok || !processJson.success) {
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const token = processJson.duplicate && processJson.duplicateToken
    ? processJson.duplicateToken
    : processJson.token;
  if (!token) {
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  await new Promise((r) => setTimeout(r, INITIAL_WAIT_MS));

  const startedAt = Date.now();
  while (Date.now() - startedAt < MAX_POLL_MS) {
    const resultRes = await fetch(`${TABSCANNER_RESULT_URL}/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { apikey: apiKey },
    });

    const body = await resultRes.text();
    let last: TabScannerResultResponse;
    try {
      last = JSON.parse(body) as TabScannerResultResponse;
    } catch {
      throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
    }

    if (last.status === 'done' && last.result?.lineItems) {
      const lineItems: RawOcrLineItem[] = last.result.lineItems.map(toRawLineItem);
      const subtotal = lineItems.reduce((s, i) => s + (i.lineTotal ?? i.price ?? 0), 0);
      return {
        lineItems,
        subtotal,
        total: subtotal,
      };
    }

    if (last.status === 'failed') {
      throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
}
