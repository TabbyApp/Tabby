/**
 * Standalone OCR worker - runs in a child process so each request gets
 * a fresh process with no shared Tesseract state.
 * Usage: npx tsx src/ocr-worker.ts <imagePath>
 * Output: JSON array of {name, price} to stdout, or exits 1 on error
 */
import { createWorker } from 'tesseract.js';

// Match prices: $10.99, 10.99, $10.9, 10.9, $10, 10 (1-2 decimals or whole)
const PRICE_REGEX = /\$?\s*[\d,]+(?:\.\d{1,2})?(?=\s*$|$)/;
const SKIP_PATTERNS = [
  /^(total|subtotal|tax|tip|amount|balance|change|cash|card|thank|receipt|store|date|time)/i,
  /^\d+\s*items?$/i,
  /^#\d+$/,
  /^[\d\s.]+$/,
  /^\d{1,2}\/\d{1,2}/, // date-like 12/31
];

function parseLineItems(text: string): { name: string; price: number }[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: { name: string; price: number }[] = [];

  for (const line of lines) {
    if (line.length < 2) continue;
    if (SKIP_PATTERNS.some((p) => p.test(line))) continue;

    const priceMatch = line.match(PRICE_REGEX);
    if (!priceMatch) continue;

    const priceStr = priceMatch[0].replace(/[$,]/g, '').trim();
    const price = parseFloat(priceStr);
    if (isNaN(price) || price <= 0 || price > 99999) continue;

    const name = line.slice(0, priceMatch.index).trim().replace(/\s+/g, ' ');
    if (!name || name.length > 120) continue;

    const existing = items.find((i) => i.name.toLowerCase() === name.toLowerCase() && Math.abs(i.price - price) < 0.01);
    if (existing) continue;

    items.push({ name, price });
  }
  return items;
}

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    process.stderr.write('Usage: ocr-worker <imagePath>\n');
    process.exit(1);
  }

  let worker;
  try {
    worker = await createWorker('eng', 1, { logger: () => {} });
    await worker.setParameters({ tessedit_pageseg_mode: '6' }); // uniform block - better for receipts
    const { data } = await worker.recognize(imagePath);
    const items = parseLineItems(data?.text ?? '');
    process.stdout.write(JSON.stringify(items));
  } catch (err) {
    process.stderr.write((err instanceof Error ? err.message : String(err)) + '\n');
    process.exit(1);
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
}

main();
