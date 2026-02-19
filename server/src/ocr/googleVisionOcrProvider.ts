/**
 * Google Cloud Vision API (DOCUMENT_TEXT_DETECTION) receipt OCR.
 * Set RECEIPT_OCR_PROVIDER=google and GOOGLE_CLOUD_VISION_API_KEY in env.
 */
import fs from 'node:fs';
import type { RawOcrOutput, RawOcrLineItem } from './types.js';

const VISION_ANNOTATE_URL = 'https://vision.googleapis.com/v1/images:annotate';

function getApiKey(): string {
  const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('GOOGLE_CLOUD_VISION_API_KEY is not set. Add it to your server .env (and restrict the key in GCP).');
  }
  return key.trim();
}

/** True if the line looks like address/phone (not a receipt line item). */
function looksLikeAddressOrPhone(desc: string): boolean {
  const d = desc.toLowerCase();
  // State/zip patterns (e.g. "TX 77054" or "Houston, TX 77054")
  if (/\b[a-z]{2}\s+\d{5}(-\d{4})?\b/.test(d)) return true;
  if (/,?\s*(tx|ca|ny|fl|il|wa|az|co)\s*,?\s*\d/.test(d)) return true;
  if (/\b(trail|street|st\.?|ave\.?|blvd|road|rd\.?|drive|dr\.?)\b/.test(d)) return true;
  // Phone: xxx-xxx-xxxx or (xxx) xxx-xxxx
  if (/\d{3}[-.)]\s*\d{3}[-.]\s*\d{4}/.test(desc)) return true;
  if (/^\d{3}-\d{3}-\d{4}$/.test(desc.trim())) return true;
  return false;
}

/** Summary line labels we should not treat as line items. */
const SUMMARY_LABELS = new Set(['total', 'subtotal', 'tax', 'tip', 'sales tax', 'gratuity', 'please pay this amount', 'amount due']);

/** Parse a line that may end with a price. Only accept amounts that look like real item prices (0.01–999.99). */
function parseLineWithPrice(line: string): { desc: string; price: number } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Match price at end: optional $, digits, optional .dd (exactly 2 decimals = typical price)
  const priceMatch = trimmed.match(/\$?\s*([\d,]+(?:\.\d{2})?)\s*$/);
  if (!priceMatch) return null;
  const price = parseFloat(priceMatch[1].replace(/,/g, ''));
  if (Number.isNaN(price) || price <= 0 || price > 999.99) return null;
  const desc = trimmed.slice(0, priceMatch.index).trim();
  if (!desc || desc.length > 120) return null;
  if (looksLikeAddressOrPhone(desc)) return null;
  const descNorm = desc.toLowerCase().replace(/\s+/g, ' ').trim();
  if (SUMMARY_LABELS.has(descNorm) || SUMMARY_LABELS.has(descNorm.replace(/[^a-z\s]/g, '').trim())) return null;
  return { desc, price };
}

/** Find totals from lines that look like receipt summary (subtotal, tax, total). Skip gratuity/suggested lines. */
function extractTotals(lines: string[]): { subtotal?: number; tax?: number; tip?: number; total?: number } {
  const totals: { subtotal?: number; tax?: number; tip?: number; total?: number } = {};
  const monetaryRe = /(\d{1,6}(?:\.\d{2})?)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();
    if (lower.includes('suggested') || lower.includes('gratuity') || (lower.includes('%') && lower.includes('total'))) continue;
    const numbers = line.match(monetaryRe);
    let value = numbers ? parseFloat(numbers[numbers.length - 1].replace(/,/g, '')) : NaN;
    if (lower.trim() === 'total' && Number.isNaN(value) && i + 1 < lines.length) {
      const nextNum = lines[i + 1].match(monetaryRe);
      if (nextNum) value = parseFloat(nextNum[nextNum.length - 1].replace(/,/g, ''));
    }
    if (Number.isNaN(value) || value <= 0 || value > 99999) continue;
    if (lower.includes('subtotal') && !lower.includes('based on')) totals.subtotal = value;
    else if (lower.includes('sales tax') || (lower.includes('tax') && !lower.includes('subtotal'))) totals.tax = value;
    else if (lower.includes('tip') && !lower.includes('suggested')) totals.tip = value;
    else if (lower.includes('please pay') || /^\s*total\s*[\d.,$]/.test(lower) || (lower.trim() === 'total')) totals.total = value;
  }
  return totals;
}

export async function googleVisionOcr(imagePath: string): Promise<RawOcrOutput> {
  const apiKey = getApiKey();
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');

  const res = await fetch(`${VISION_ANNOTATE_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn('Vision API error:', res.status, errText.slice(0, 300));
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const data = (await res.json()) as {
    responses?: Array<{
      fullTextAnnotation?: { text?: string };
      error?: { message?: string };
    }>;
  };

  const response = data.responses?.[0];
  if (response?.error) {
    throw new Error(response.error.message || 'Vision API error.');
  }

  const fullText = response?.fullTextAnnotation?.text ?? '';
  if (!fullText.trim()) {
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const lines = fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  console.log('[Receipt] Vision OCR: line count=', lines.length, 'preview=', lines.slice(0, 5));
  const lineItems: RawOcrLineItem[] = [];
  let merchantName: string | undefined;
  const totals = extractTotals(lines);
  console.log('[Receipt] Vision extracted totals:', totals);

  for (let i = 0; i < lines.length; i++) {
    const parsed = parseLineWithPrice(lines[i]);
    if (parsed) {
      lineItems.push({ desc: parsed.desc, descClean: parsed.desc, lineTotal: parsed.price, price: parsed.price });
    } else if (i === 0 && lines[i].length > 0 && lines[i].length < 80 && !/\d+\.\d{2}/.test(lines[i])) {
      merchantName = lines[i];
    }
  }

  const subtotalFromItems = lineItems.reduce((s, i) => s + (i.lineTotal ?? i.price ?? 0), 0);
  const output = {
    text: fullText,
    merchantName,
    subtotal: totals.subtotal ?? (lineItems.length ? subtotalFromItems : undefined),
    tax: totals.tax,
    tip: totals.tip,
    total: totals.total,
    lineItems: lineItems.length ? lineItems : undefined,
  };
  console.log('[Receipt] Vision mapped output:', {
    merchantName: output.merchantName,
    subtotal: output.subtotal,
    tax: output.tax,
    total: output.total,
    lineItemCount: lineItems.length,
    lineItemSample: lineItems.slice(0, 5).map((i) => ({ desc: i.desc ?? i.descClean, price: i.lineTotal ?? i.price })),
  });
  return output;
}
