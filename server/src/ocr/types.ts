/**
 * OCR and receipt parsing types.
 * RawOcrOutput is what providers return; ParsedReceipt is the structured schema used by the app.
 */

export interface RawOcrLineItem {
  desc?: string;
  descClean?: string;
  lineTotal?: number;
  price?: number;
  qty?: number;
}

export interface RawOcrOutput {
  text?: string;
  merchantName?: string;
  receiptDate?: string;
  subtotal?: number;
  tax?: number;
  tip?: number;
  total?: number;
  lineItems?: RawOcrLineItem[];
}

export interface ParsedLineItem {
  name: string;
  price: number;
  qty?: number;
  unitPrice?: number;
}

export interface ParsedTotals {
  subtotal?: number;
  tax?: number;
  tip?: number;
  total?: number;
}

export interface ParsedReceipt {
  merchantName?: string;
  receiptDate?: string | null;
  totals: ParsedTotals;
  lineItems: ParsedLineItem[];
}

export interface ConfidenceMap {
  merchantName: number;
  receiptDate: number;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  lineItems: number[];
}

export interface ReceiptOcrProvider {
  ocr(imagePath: string): Promise<RawOcrOutput>;
}
