export * from './types.js';
export { mockOcrProvider } from './mockOcrProvider.js';
export { tabScannerOcr } from './tabScannerOcrProvider.js';
export { googleVisionOcr } from './googleVisionOcrProvider.js';
export { documentAiOcr } from './documentAiOcrProvider.js';
export { mindeeOcr } from './mindeeOcrProvider.js';

import type { ReceiptOcrProvider } from './types.js';
import { mockOcrProvider } from './mockOcrProvider.js';
import { tabScannerOcr } from './tabScannerOcrProvider.js';
import { googleVisionOcr } from './googleVisionOcrProvider.js';
import { documentAiOcr } from './documentAiOcrProvider.js';
import { mindeeOcr } from './mindeeOcrProvider.js';

const PROVIDER = (process.env.RECEIPT_OCR_PROVIDER || 'mock').toLowerCase();

export function getOcrProvider(): ReceiptOcrProvider {
  if (PROVIDER === 'tabscanner') return { ocr: tabScannerOcr };
  if (PROVIDER === 'google') return { ocr: googleVisionOcr };
  if (PROVIDER === 'documentai') return { ocr: documentAiOcr };
  if (PROVIDER === 'mindee') return { ocr: mindeeOcr };
  return mockOcrProvider;
}
