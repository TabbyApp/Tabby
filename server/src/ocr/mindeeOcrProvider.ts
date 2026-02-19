/**
 * Mindee receipt OCR (V2 API) – structured extraction using the Mindee SDK.
 * Validated against data-schema.json: supplier_name, date, total_amount, total_net,
 * total_tax, tips_gratuity, line_items (description, quantity, unit_price, total_price).
 *
 * Setup: Create a receipt extraction model at https://app.mindee.com, then set in .env:
 *   RECEIPT_OCR_PROVIDER=mindee
 *   MINDEE_API_KEY=your_api_key
 *   MINDEE_MODEL_ID=your-model-uuid
 */
import { ClientV2, PathInput } from 'mindee';
import type { RawOcrOutput, RawOcrLineItem } from './types.js';

function getConfig(): { apiKey: string; modelId: string } {
  const apiKey = process.env.MINDEE_API_KEY;
  const modelId = process.env.MINDEE_MODEL_ID;
  if (!apiKey?.trim()) {
    throw new Error('MINDEE_API_KEY is required when RECEIPT_OCR_PROVIDER=mindee.');
  }
  if (!modelId?.trim()) {
    throw new Error('MINDEE_MODEL_ID is required when RECEIPT_OCR_PROVIDER=mindee.');
  }
  return { apiKey: apiKey.trim(), modelId: modelId.trim() };
}

function safeNum(val: number | null | undefined): number | undefined {
  return typeof val === 'number' && !Number.isNaN(val) ? val : undefined;
}

function safeStr(val: string | null | undefined): string | undefined {
  return typeof val === 'string' && val.trim() ? val.trim() : undefined;
}

export async function mindeeOcr(imagePath: string): Promise<RawOcrOutput> {
  const { apiKey, modelId } = getConfig();
  const client = new ClientV2({ apiKey });
  const inputSource = new PathInput({ inputPath: imagePath });
  const inferenceParams = {
    modelId,
    confidence: true,
  };

  const response = await client.enqueueAndGetInference(inputSource, inferenceParams);
  const fields = response?.inference?.result?.fields;
  if (!fields) {
    console.log('[Receipt] Mindee: no result.fields in response');
    return { text: undefined, merchantName: undefined, lineItems: undefined };
  }

  // Schema: supplier_name, date, total_amount, total_net, total_tax, tips_gratuity, line_items
  let merchantName: string | undefined;
  let receiptDate: string | undefined;
  let total: number | undefined;
  let totalNet: number | undefined;
  let totalTax: number | undefined;
  let tip: number | undefined;
  try {
    merchantName = safeStr(fields.getSimpleField('supplier_name').stringValue);
  } catch {
    // optional
  }
  try {
    receiptDate = safeStr(fields.getSimpleField('date').stringValue);
  } catch {
    // optional; date type may expose as string
  }
  try {
    total = safeNum(fields.getSimpleField('total_amount').numberValue);
  } catch {
    // optional
  }
  try {
    totalNet = safeNum(fields.getSimpleField('total_net').numberValue);
  } catch {
    // optional
  }
  try {
    totalTax = safeNum(fields.getSimpleField('total_tax').numberValue);
  } catch {
    // optional
  }
  try {
    tip = safeNum(fields.getSimpleField('tips_gratuity').numberValue);
  } catch {
    // optional
  }

  const lineItems: RawOcrLineItem[] = [];
  try {
    const lineItemsField = fields.getListField('line_items');
    const items = lineItemsField.objectItems ?? [];
    for (const item of items) {
      try {
        const sub = item.fields;
        const desc = safeStr(sub.getSimpleField('description').stringValue);
        const totalPrice = safeNum(sub.getSimpleField('total_price').numberValue);
        const quantity = safeNum(sub.getSimpleField('quantity').numberValue);
        const unitPrice = safeNum(sub.getSimpleField('unit_price').numberValue);
        const name = desc ?? 'Item';
        let price = 0;
        if (typeof totalPrice === 'number' && totalPrice > 0) price = totalPrice;
        else if (typeof unitPrice === 'number' && unitPrice > 0) price = unitPrice;
        if (price > 0 && price <= 99999) {
          lineItems.push({
            desc: name,
            descClean: name,
            lineTotal: price,
            price,
            qty: quantity,
          });
        }
      } catch {
        // skip this line item if any subfield is missing
      }
    }
  } catch (e) {
    console.warn('[Receipt] Mindee: error reading line_items', e);
  }

  const output: RawOcrOutput = {
    text: undefined,
    merchantName,
    receiptDate,
    subtotal: totalNet,
    tax: totalTax,
    tip,
    total,
    lineItems: lineItems.length ? lineItems : undefined,
  };
  console.log('[Receipt] Mindee mapped output:', {
    merchantName: output.merchantName,
    subtotal: output.subtotal,
    tax: output.tax,
    tip: output.tip,
    total: output.total,
    lineItemCount: lineItems.length,
    lineItemSample: lineItems.slice(0, 3).map((i) => ({ name: i.desc ?? i.descClean, price: i.lineTotal ?? i.price })),
  });
  return output;
}
