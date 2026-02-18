/**
 * Mock OCR provider: returns deterministic sample receipt data for dev without external API.
 */
import type { RawOcrOutput, ReceiptOcrProvider } from './types.js';

export const mockOcrProvider: ReceiptOcrProvider = {
  async ocr(_imagePath: string): Promise<RawOcrOutput> {
    // Deterministic sample so the app works end-to-end without TabScanner key
    const lineItems = [
      { desc: 'Latte', lineTotal: 5.5, price: 5.5, qty: 1 },
      { desc: 'Avocado Toast', lineTotal: 12, price: 12, qty: 1 },
      { desc: 'Croissant', lineTotal: 4.25, price: 4.25, qty: 1 },
      { desc: 'Espresso', lineTotal: 3.22, price: 3.22, qty: 1 },
    ];
    const subtotal = 5.5 + 12 + 4.25 + 3.22; // 24.97
    const tax = 2.25;
    const total = subtotal + tax; // 27.22
    return {
      merchantName: 'Sample Coffee Shop',
      receiptDate: new Date().toISOString().slice(0, 10),
      subtotal,
      tax,
      tip: 0,
      total,
      lineItems,
    };
  },
};
