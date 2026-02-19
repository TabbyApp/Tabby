/**
 * Minimal happy-path test: validation on fixed receipt; optional full pipeline with mock OCR.
 * Run from server dir: npx tsx src/test-receipt-flow.ts
 */
import { validateReceipt } from './receiptValidation.js';

const fixedReceipt = {
  totals: { subtotal: 24.97, tax: 2.25, tip: 0, total: 27.22 },
  lineItems: [
    { name: 'Latte', price: 5.5 },
    { name: 'Avocado Toast', price: 12 },
    { name: 'Croissant', price: 4.25 },
    { name: 'Espresso', price: 3.22 },
  ],
};

function runValidationTest() {
  const validation = validateReceipt(fixedReceipt);
  if (!validation.isValid) {
    console.error('FAIL: expected receipt to validate. issues:', validation.issues);
    process.exit(1);
  }
  const sumItems = fixedReceipt.lineItems.reduce((s, i) => s + i.price, 0);
  if (Math.abs(sumItems - (fixedReceipt.totals.subtotal ?? 0)) > 0.03) {
    console.error('FAIL: line items sum', sumItems, 'vs subtotal', fixedReceipt.totals.subtotal);
    process.exit(1);
  }
  console.log('OK: validation happy path (fixed receipt)');
}

function runMismatchTest() {
  const badReceipt = {
    totals: { subtotal: 10, tax: 1, tip: 0, total: 11 },
    lineItems: [{ name: 'A', price: 5 }, { name: 'B', price: 3 }], // sum 8 != subtotal 10
  };
  const validation = validateReceipt(badReceipt);
  if (validation.isValid) {
    console.error('FAIL: expected validation to fail for mismatched subtotal');
    process.exit(1);
  }
  if (!validation.issues.some((i) => i.includes('subtotal') || i.includes('Line items sum'))) {
    console.error('FAIL: expected issue about subtotal/line items');
    process.exit(1);
  }
  console.log('OK: validation correctly flags mismatch');
}

runValidationTest();
runMismatchTest();
console.log('All tests passed.');
