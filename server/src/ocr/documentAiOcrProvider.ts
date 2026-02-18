/**
 * Google Document AI (Invoice/Receipt processor) – structured extraction for many receipt formats.
 * Uses a pretrained Invoice Parser or Expense/Receipt processor; returns entities (line items, totals, vendor).
 *
 * Setup: Enable Document AI, create an Invoice Parser (or Receipt) processor in GCP Console,
 * then set in .env:
 *   RECEIPT_OCR_PROVIDER=documentai
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
 *   DOCUMENT_AI_PROJECT_ID=your-project-id
 *   DOCUMENT_AI_LOCATION=us   (or eu)
 *   DOCUMENT_AI_PROCESSOR_ID=your-processor-id
 */
import fs from 'node:fs';
import path from 'node:path';
import { GoogleAuth } from 'google-auth-library';
import type { RawOcrOutput, RawOcrLineItem } from './types.js';

interface DocAiEntity {
  type?: string;
  mentionText?: string;
  normalizedValue?: {
    text?: string;
    money?: { currencyCode?: string; units?: string; nanos?: number };
  };
  properties?: DocAiEntity[];
}

interface DocAiDocument {
  text?: string;
  entities?: DocAiEntity[];
}

function getConfig() {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.DOCUMENT_AI_PROJECT_ID;
  const location = process.env.DOCUMENT_AI_LOCATION || 'us';
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
  if (!credsPath || !fs.existsSync(credsPath)) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS must point to a service account JSON key file. Document AI does not use an API key.'
    );
  }
  if (!projectId || !processorId) {
    throw new Error('DOCUMENT_AI_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID are required when using RECEIPT_OCR_PROVIDER=documentai.');
  }
  return { credsPath, projectId, location, processorId };
}

function entityMoneyToNumber(entity: DocAiEntity): number | undefined {
  const nv = entity.normalizedValue?.money;
  if (!nv) return undefined;
  const units = Number.parseInt(nv.units ?? '0', 10);
  const nanos = nv.nanos ?? 0;
  if (Number.isNaN(units)) return undefined;
  return units + nanos / 1e9;
}

function entityText(entity: DocAiEntity): string | undefined {
  const t = entity.normalizedValue?.text ?? entity.mentionText;
  return t?.trim() || undefined;
}

function getProp(properties: DocAiEntity[] | undefined, type: string): DocAiEntity | undefined {
  return properties?.find((p) => (p.type ?? '').toLowerCase() === type.toLowerCase());
}

function getPropValue(properties: DocAiEntity[] | undefined, type: string): string | number | undefined {
  const p = getProp(properties, type);
  if (!p) return undefined;
  const money = entityMoneyToNumber(p);
  if (money !== undefined) return money;
  return entityText(p);
}

const DOCUMENT_AI_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export async function documentAiOcr(imagePath: string): Promise<RawOcrOutput> {
  const { projectId, location, processorId } = getConfig();
  const auth = new GoogleAuth({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: [DOCUMENT_AI_SCOPE],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const accessToken = tokenResponse.token;
  if (!accessToken) {
    throw new Error('Failed to get Document AI access token. Check GOOGLE_APPLICATION_CREDENTIALS.');
  }

  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const url = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content: base64,
        mimeType,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn('Document AI error:', res.status, errText.slice(0, 400));
    throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
  }

  const data = (await res.json()) as { document?: DocAiDocument; error?: { message?: string } };
  if (data.error) {
    throw new Error(data.error.message || 'Document AI error.');
  }

  const document = data.document;
  const entityCount = document?.entities?.length ?? 0;
  const entityTypes = document?.entities?.map((e) => e.type).join(', ') ?? 'none';
  console.log('[Receipt] Document AI response: entities=', entityCount, 'types=', entityTypes);

  if (!document?.entities?.length) {
    const fullText = document?.text ?? '';
    console.log('[Receipt] Document AI: no entities, raw text length=', fullText.length, 'preview=', fullText.slice(0, 200));
    if (!fullText.trim()) {
      throw new Error('Couldn\'t read the image. Please try again with a clearer photo.');
    }
    return {
      text: fullText,
      merchantName: undefined,
      lineItems: undefined,
    };
  }

  const entities = document.entities;
  let merchantName: string | undefined;
  let subtotal: number | undefined;
  let tax: number | undefined;
  let tip: number | undefined;
  let total: number | undefined;
  const lineItems: RawOcrLineItem[] = [];

  for (const entity of entities) {
    const type = (entity.type ?? '').toLowerCase();
    if (type === 'supplier_name' || type === 'receiver_name') {
      const t = entityText(entity);
      if (t && !merchantName) merchantName = t;
    } else if (type === 'net_amount' || type === 'subtotal') {
      const v = entityMoneyToNumber(entity);
      if (v !== undefined) subtotal = v;
    } else if (type === 'total_tax_amount' || type === 'tax_amount') {
      const v = entityMoneyToNumber(entity);
      if (v !== undefined) tax = v;
    } else if (type === 'total_amount' || type === 'invoice_amount' || type === 'amount_due') {
      const v = entityMoneyToNumber(entity);
      if (v !== undefined) total = v;
    } else if (type === 'line_item' && entity.properties?.length) {
      const desc = getPropValue(entity.properties, 'description') ?? getPropValue(entity.properties, 'product_code');
      const amount = getPropValue(entity.properties, 'amount') ?? getPropValue(entity.properties, 'line_item_amount');
      const qty = getPropValue(entity.properties, 'quantity');
      const name = typeof desc === 'string' ? desc : String(desc ?? '').trim();
      const price = typeof amount === 'number' ? amount : Number.parseFloat(String(amount ?? 0));
      if (name && !Number.isNaN(price) && price > 0 && price <= 99999) {
        lineItems.push({
          desc: name,
          descClean: name,
          lineTotal: price,
          price,
          qty: typeof qty === 'number' ? qty : undefined,
        });
      }
    }
  }

  if (subtotal === undefined && lineItems.length > 0) {
    subtotal = lineItems.reduce((s, i) => s + (i.lineTotal ?? i.price ?? 0), 0);
  }

  const output = {
    text: document.text,
    merchantName,
    subtotal,
    tax,
    tip,
    total,
    lineItems: lineItems.length ? lineItems : undefined,
  };
  console.log('[Receipt] Document AI mapped output:', {
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
