import { Router } from 'express';
import crypto from 'crypto';
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const plaidRouter = Router();

// Lazy init: read env when first needed (after dotenv has run in index.ts)
let _plaidClient: PlaidApi | null | undefined = undefined;
function getPlaidClient(): PlaidApi | null {
  if (_plaidClient !== undefined) return _plaidClient;
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    _plaidClient = null;
    return null;
  }
  _plaidClient = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret,
        },
      },
    })
  );
  return _plaidClient;
}

function genId() {
  return crypto.randomUUID();
}

/**
 * POST /api/plaid/link-token
 * Create a Link token for the current user (sandbox). Used to open Plaid Link on the frontend.
 */
plaidRouter.post('/link-token', requireAuth, async (req, res) => {
  const plaidClient = getPlaidClient();
  if (!plaidClient) {
    return res.status(503).json({
      error: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to server .env (see docs/PLAID_SETUP.md).',
    });
  }
  const { userId } = (req as any).user;

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'Tabby',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en',
    });
    const linkToken = response.data.link_token;
    if (!linkToken) {
      return res.status(500).json({ error: 'Plaid did not return a link token' });
    }
    res.json({ linkToken });
  } catch (err: any) {
    const data = err?.response?.data;
    const message = data?.error_message || data?.error_code || err?.message || 'Failed to create link token';
    console.error('Plaid linkTokenCreate error:', message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/plaid/exchange
 * Exchange public_token from Plaid Link for access_token, fetch accounts, store as payment_methods.
 */
plaidRouter.post('/exchange', requireAuth, async (req, res) => {
  const plaidClient = getPlaidClient();
  if (!plaidClient) {
    return res.status(503).json({
      error: 'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to server .env.',
    });
  }
  const { userId } = (req as any).user;
  const { public_token: publicToken } = req.body;

  if (!publicToken || typeof publicToken !== 'string') {
    return res.status(400).json({ error: 'public_token is required' });
  }

  try {
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    const accounts = accountsResponse.data.accounts || [];

    db.prepare(
      'INSERT OR REPLACE INTO plaid_items (id, user_id, item_id, access_token) VALUES (?, ?, ?, ?)'
    ).run(genId(), userId, itemId, accessToken);

    const depositoryAccounts = accounts.filter(
      (a: { type?: string }) => a.type === 'depository'
    );
    const created: { id: string; type: string; last_four: string; brand: string | null }[] = [];

    for (const account of depositoryAccounts) {
      const accountId = (account as { account_id?: string }).account_id;
      const mask = (account as { mask?: string }).mask ?? '0000';
      const name = (account as { name?: string }).name ?? 'Bank account';
      if (!accountId) continue;

      const existing = db.prepare(
        'SELECT id FROM payment_methods WHERE user_id = ? AND plaid_account_id = ?'
      ).get(userId, accountId) as { id: string } | undefined;

      if (existing) continue;

      const pmId = genId();
      db.prepare(
        `INSERT INTO payment_methods (id, user_id, type, last_four, brand, plaid_account_id, plaid_item_id) VALUES (?, ?, 'bank', ?, ?, ?, ?)`
      ).run(pmId, userId, mask, name, accountId, itemId);
      created.push({ id: pmId, type: 'bank', last_four: mask, brand: null });
    }

    res.json({ ok: true, paymentMethods: created });
  } catch (err: any) {
    const data = err?.response?.data;
    const message = data?.error_message || data?.error_code || err?.message || 'Failed to link account';
    console.error('Plaid exchange error:', message);
    res.status(400).json({ error: message });
  }
});
