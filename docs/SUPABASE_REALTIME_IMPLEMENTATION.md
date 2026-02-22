# Supabase Realtime Implementation Plan

This document is the step-by-step plan for making the item-split screen update in real time when anyone in the group selects items. It also lists **what you need to do in Supabase** and in your deployments.

---

## Quick: What You Have To Do On Your End

1. **Supabase Dashboard** – Same project as your Tabby DB:
   - **Settings → API:** copy **Project URL** and **anon public** key.
   - **Database → Replication:** add the **`item_claims`** table to the `supabase_realtime` publication (or run `ALTER PUBLICATION supabase_realtime ADD TABLE item_claims;` in SQL Editor).

2. **Environment variables (frontend only):**
   - **Local:** In `tabby2/Tabby/.env` (or wherever your frontend reads env):  
     `VITE_SUPABASE_URL=<your Project URL>`  
     `VITE_SUPABASE_ANON_KEY=<your anon key>`
   - **Production (Render):** In your **frontend** service’s Environment, add the same two variables, then **redeploy** the frontend so the build picks them up.

3. **After code is implemented:** Run the new migration (adds `receipt_id` to `item_claims`) the same way you run migrations today (e.g. backend deploy or manual `npm run migrate` in server). No Supabase env vars are needed on the backend.

That’s it from your side. The rest is code: migration, backend setting `receipt_id` on claim inserts, and frontend subscribing to Realtime and refetching when claims change.

---

## Part 1: What You Do (Supabase Dashboard & Env)

### 1.1 Get Supabase URL and Anon Key

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select the project you use for Tabby (the one whose Postgres is in `DATABASE_URL`).
2. Go to **Project Settings** (gear) → **API**.
3. Copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon public** key (under "Project API keys").

You will use these in the frontend only (not in the backend).

### 1.2 Enable Realtime for `item_claims`

Realtime must be enabled for the table that stores claims.

**Option A – Dashboard (recommended)**

1. In Supabase Dashboard go to **Database** → **Replication** (or **Publications**).
2. Open the **supabase_realtime** publication.
3. Add the **`item_claims`** table to the publication (so its changes are broadcast).

**Option B – SQL**

In **SQL Editor** run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE item_claims;
```

(If you see “table already in publication”, it’s already enabled.)

### 1.3 Environment Variables for the Frontend

The frontend needs to talk to Supabase Realtime. It does **not** use your backend for this.

**Local (e.g. `.env` in repo root or `tabby2/Tabby/.env`):**

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key_here
```

Replace with your actual Project URL and anon public key from step 1.1.

**Production (Render – Frontend service):**

1. Open Render Dashboard → your **frontend** (web) service.
2. **Environment** → Add:
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
3. Save and **redeploy** the frontend so the build picks up the new vars.

**Important:**  
- Use the **same** Supabase project that your backend uses (same DB as in `DATABASE_URL`).  
- Only the **frontend** needs these; the backend keeps using `DATABASE_URL` and does not need Supabase JS or these keys.

---

## Part 2: Database Change (So We Can Filter by Receipt)

Realtime can filter by column. Right now `item_claims` has only `receipt_item_id` and `user_id`, so we can’t filter by receipt. We add `receipt_id` to `item_claims` and keep it in sync on every insert/delete.

### 2.1 New Migration (Codebase)

A new migration file will:

1. Add column `receipt_id TEXT` to `item_claims` (nullable first).
2. Backfill: set `receipt_id` from `receipt_items` (join on `receipt_item_id`).
3. Set `receipt_id` to `NOT NULL` and add a foreign key to `receipts(id)`.
4. Add an index on `receipt_id` for fast Realtime filtering.

**File:** `server/migrations/002_item_claims_receipt_id.sql` (created in implementation step below).

### 2.2 Backend Code Changes

- **Receipts route** (`PUT /:receiptId/items/:itemId/claims`): when inserting into `item_claims`, include `receipt_id` (you already have `receiptId`).
- **Transactions route** (`PUT /:id/items/:itemId/claims`): when inserting into `item_claims`, include `receipt_id` (you get it from the receipt linked to the transaction).

After deployment, run the new migration (same way you run migrations today, e.g. on Render backend startup or manually).

---

## Part 3: Frontend Implementation (Codebase)

### 3.1 Install Supabase Client

In the **frontend** app (e.g. `tabby2/Tabby`):

```bash
npm install @supabase/supabase-js
```

### 3.2 Supabase Client Singleton

Create a small module that creates the Supabase client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use it only for Realtime (no auth or table access from the client if you don’t need it). Example:

**File:** `frontend/lib/supabase.ts` (or similar)

- Read `import.meta.env.VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- If either is missing, export `null` or a no-op client so the app doesn’t crash when Realtime isn’t configured.
- Otherwise `createClient(url, key)` and export it.

### 3.3 Realtime Hook for Claims

**File:** `frontend/hooks/useReceiptClaimsRealtime.ts` (or next to existing hooks)

- **Input:** `receiptId: string | null`.
- **Behavior:**
  - If no `receiptId` or no Supabase client, do nothing.
  - Subscribe to Postgres changes:
    - schema: `public`,
    - table: `item_claims`,
    - filter: `receipt_id=eq.${receiptId}`,
    - event: `*` (INSERT, UPDATE, DELETE).
  - On payload, call a **callback** (e.g. `onClaimsChange()`) so the parent can refetch receipt data from your **existing API** (e.g. `api.receipts.get(receiptId)`).
- **Cleanup:** On unmount or when `receiptId` changes, remove the channel subscription (`supabase.removeChannel(channel)` or equivalent).
- Return nothing or a simple `{ connected }` if you want to show connection status.

This way the frontend does not depend on Supabase for auth or for full receipt data; it only uses Realtime to know “something changed” and then refetches from your API.

### 3.4 Use the Hook on the Item-Split Screen

- **ReceiptItemsPage** (and any other screen that shows “who selected what” for one receipt):
  - When you have a `receiptId`, call `useReceiptClaimsRealtime(receiptId, () => { ... })`.
  - In the callback, refetch receipt (items + claims) from your API and update state (same API you use today, e.g. `api.receipts.get(receiptId)`), so the list and checkboxes update.
- **GroupDetailPage** (when it shows receipt detail for the “pending” receipt):
  - When there is a pending receipt id, subscribe with that id and, in the callback, refetch that receipt (or group) data so “who selected what” updates without a full page refresh.

No need to change how you load data the first time; only add the Realtime subscription and refetch on change.

### 3.5 Optional: Transaction Flow

If the item-split UI is keyed by **transaction** instead of receipt, you still have a receipt id (from the transaction’s receipt). Use that same `receiptId` in `useReceiptClaimsRealtime(receiptId, refetch)` so when anyone updates claims for that receipt, everyone’s view updates. No separate “transaction channel” is required if one transaction has one receipt.

---

## Part 4: Order of Operations

1. **You (Supabase):** Add `item_claims` to the Realtime publication (step 1.2). Get URL + anon key (step 1.1).
2. **You (env):** Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` locally and in Render for the **frontend** (step 1.3).
3. **Code:** Add migration `002_item_claims_receipt_id.sql` and run it (e.g. deploy backend so migration runs, or run `npm run migrate` in server).
4. **Code:** Update backend: in both claims endpoints, include `receipt_id` in every `INSERT` into `item_claims` (and ensure deletes remain as they are).
5. **Code:** Frontend: add `@supabase/supabase-js`, create Supabase client module, add `useReceiptClaimsRealtime`, and wire it in ReceiptItemsPage and GroupDetailPage with a refetch callback.
6. **Deploy:** Deploy backend (migration + code), then frontend (with Realtime env vars set). Redeploy frontend so the build sees the new `VITE_*` variables.

---

## Part 5: Checklist (Your Side)

- [ ] Supabase project is the same one used in `DATABASE_URL` for the backend.
- [ ] In Supabase: Realtime enabled for `item_claims` (publication).
- [ ] In Supabase: Copy Project URL and anon public key.
- [ ] Local `.env`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set.
- [ ] Render – Frontend service: same two env vars added; frontend redeployed.
- [ ] Backend: Migration run (so `item_claims.receipt_id` exists and is backfilled).
- [ ] Backend: Both claims endpoints updated to set `receipt_id` on insert.
- [ ] Frontend: Supabase client + hook + wiring done; build and test locally, then deploy.

---

## Part 6: Security Note

The **anon** key is safe to use in the frontend: it’s designed for client-side use. Supabase Realtime will only send Postgres changes for tables in the publication; you are not exposing your DB beyond that. If you later enable Row Level Security (RLS) on `item_claims`, you can restrict which rows are visible in Realtime; for now, the frontend only refetches data via your **existing API**, which already enforces auth and group membership, so you don’t leak data you don’t already expose via the API.

---

## Summary

- **You:** Enable Realtime for `item_claims`, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in frontend env (local + Render), run the new migration, and deploy.
- **Code:** Migration adds `receipt_id` to `item_claims`; backend sets it on every claim insert; frontend adds Supabase client, a small Realtime hook filtered by `receipt_id`, and refetches from your API when a change is received so the item-split view updates for everyone in real time.
