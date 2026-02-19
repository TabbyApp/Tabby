/**
 * Receipt processing pipeline: preprocess -> OCR -> parse -> confidence.
 * Runs synchronously in the upload request.
 */
import type { RawOcrOutput, ParsedReceipt, ParsedLineItem, ParsedTotals, ConfidenceMap } from './ocr/types.js';
import { getOcrProvider } from './ocr/index.js';

// TODO: future orientation/deskew/contrast; for now return same path
export async function preprocessImage(imagePath: string): Promise<string> {
  return imagePath;
}

function parseRawToStructured(raw: RawOcrOutput): ParsedReceipt {
  const lineItems: ParsedLineItem[] = [];
  if (Array.isArray(raw.lineItems)) {
    for (const line of raw.lineItems) {
      const name = (line.descClean ?? line.desc ?? '').trim();
      const price = line.lineTotal ?? line.price ?? 0;
      if (!name || typeof price !== 'number' || Number.isNaN(price) || price <= 0 || price > 99999) continue;
      if (name.length > 120) continue;
      const qty = line.qty != null && line.qty >= 1 ? line.qty : undefined;
      const unitPrice = qty != null && qty > 0 ? Math.round((price / qty) * 100) / 100 : undefined;
      lineItems.push({ name, price, qty, unitPrice });
    }
  }

  let subtotal = raw.subtotal;
  let tax = raw.tax;
  let tip = raw.tip;
  let total = raw.total;

  const sumItems = lineItems.reduce((s, i) => s + i.price, 0);
  if (subtotal == null || Number.isNaN(subtotal)) subtotal = sumItems;
  if (total == null || Number.isNaN(total)) {
    const candidates = [subtotal, tax, tip].filter((n): n is number => typeof n === 'number' && !Number.isNaN(n));
    total = candidates.length > 0 ? Math.max(...candidates) : sumItems;
  }
  if (tax == null) tax = 0;
  if (tip == null) tip = 0;

  const totals: ParsedTotals = { subtotal, tax, tip, total };

  return {
    merchantName: raw.merchantName?.trim() || undefined,
    receiptDate: raw.receiptDate?.trim() || null,
    totals,
    lineItems,
  };
}

function computeConfidence(parsed: ParsedReceipt): ConfidenceMap {
  const sumItems = parsed.lineItems.reduce((s, i) => s + i.price, 0);
  const { subtotal, tax, tip, total } = parsed.totals;
  const computed = (subtotal ?? 0) + (tax ?? 0) + (tip ?? 0);

  let totalConf = 0.5;
  if (typeof total === 'number' && !Number.isNaN(total)) totalConf = 0.85;
  if (Math.abs((computed - (total ?? 0))) < 0.02) totalConf = 0.95;

  let subtotalConf = 0.5;
  if (typeof subtotal === 'number' && !Number.isNaN(subtotal)) subtotalConf = 0.8;
  if (Math.abs(sumItems - (subtotal ?? 0)) < 0.02) subtotalConf = 0.95;

  const lineItemConfidences = parsed.lineItems.map(() => 0.8);

  return {
    merchantName: parsed.merchantName ? 0.85 : 0.3,
    receiptDate: parsed.receiptDate ? 0.8 : 0.3,
    subtotal: subtotalConf,
    tax: typeof tax === 'number' && !Number.isNaN(tax) ? 0.75 : 0.4,
    tip: typeof tip === 'number' && !Number.isNaN(tip) ? 0.75 : 0.5,
    total: totalConf,
    lineItems: lineItemConfidences,
  };
}

export interface ProcessReceiptResult {
  parsed: ParsedReceipt;
  confidence: ConfidenceMap;
}

export async function processReceipt(imagePath: string): Promise<ProcessReceiptResult> {
  const providerName = process.env.RECEIPT_OCR_PROVIDER || 'mock';
  console.log('[Receipt] processReceipt: imagePath=', imagePath, 'provider=', providerName);

  const pathAfterPreprocess = await preprocessImage(imagePath);
  const provider = getOcrProvider();
  const raw: RawOcrOutput = await provider.ocr(pathAfterPreprocess);

  console.log('[Receipt] OCR raw output:', {
    merchantName: raw.merchantName,
    subtotal: raw.subtotal,
    tax: raw.tax,
    tip: raw.tip,
    total: raw.total,
    lineItemCount: raw.lineItems?.length ?? 0,
  });

  const parsed = parseRawToStructured(raw);
  console.log('[Receipt] Parsed structured:', {
    merchantName: parsed.merchantName,
    totals: parsed.totals,
    lineItemCount: parsed.lineItems.length,
    lineItemSample: parsed.lineItems.slice(0, 5).map((i) => ({ name: i.name, price: i.price })),
  });

  const confidence = computeConfidence(parsed);
  return { parsed, confidence };
}
