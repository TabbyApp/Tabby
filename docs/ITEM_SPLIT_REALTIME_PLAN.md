# Item Split: Dynamic Window & Real-Time Updates

## Goals

1. **Dynamic window** – When someone uploads a receipt, all group members see the item-split flow and a **15-minute window** to select items.
2. **Real-time view** – Everyone sees each other’s selections update live (no manual refresh).
3. **Unclaimed items** – When the window ends (or host finalizes), items no one selected are split only among **members who didn’t select anything** (not among everyone).

---

## Is “webhooks” the right approach?

**No.** Webhooks are for **server-to-server** notifications (e.g. “when X happens, POST to this URL”). They don’t push updates to **browser clients**. To get a “constantly refreshing” view for users, you need one of the options below.

---

## Recommended: Supabase Realtime (best fit)

You already use **Supabase for the DB**. Supabase **Realtime** can push row changes to subscribed clients. No new backend “push” logic on Render.

### How it works

1. **Backend (Render)** – Unchanged. It already writes to Supabase (receipts, `receipt_items`, `item_claims`, transactions).
2. **Frontend** – Subscribes to Supabase Realtime for the relevant data:
   - **Option A (table changes):** Subscribe to Postgres changes on `item_claims` (and optionally `receipt_items`) filtered by `receipt_id` / `transaction_id`.
   - **Option B (channel):** Use a Realtime channel per receipt or transaction, e.g. `receipt:${receiptId}` or `transaction:${transactionId}`, and have the backend broadcast a short message on that channel when claims change (requires one small server endpoint that calls Supabase Realtime from the backend, or use table changes only).

3. **Flow:** User A claims an item → API writes to `item_claims` in Supabase → Realtime broadcasts the change → User B and C’s UIs update.

### Implementation outline

- **Frontend:** Add `@supabase/supabase-js`, create a small hook (e.g. `useReceiptClaims(receiptId)` or `useTransactionClaims(transactionId)`) that:
  - Subscribes to Supabase Realtime (Postgres changes on `item_claims` for that receipt, or a channel).
  - On payload, refetch receipt/transaction detail from your API (or merge minimal claim data) and update state so `ReceiptItemsPage` / `GroupDetailPage` re-render with latest claims.
- **Auth:** Use Supabase anon key + RLS so clients only get changes for groups/receipts they’re allowed to see (or keep Realtime scoped to receipt/transaction ID and rely on your API for auth when loading full detail).
- **Env:** Expose `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the frontend (same Supabase project as your DB).

### Pros

- Real-time, low latency.
- No polling; scales well.
- Fits current stack (DB already in Supabase).

### Cons

- Frontend and deployment must be configured for Supabase (URL + anon key).
- Need to define RLS or channel scope so users only receive updates they’re allowed to see.

---

## Alternative: Polling (simplest)

No new services. Frontend periodically refetches “receipt + claims” (and optionally transaction) while the 15-minute window is active.

### Implementation outline

- **ReceiptItemsPage:** While `receiptId` is set and the allocation window is open (e.g. you have `allocation_deadline_at` or a “pending” status), call `api.receipts.get(receiptId)` every **3–5 seconds** and update `items` / `claims` state. Use a single `setInterval` (or a refetch interval in a data-fetching hook) and clear it on unmount or when window expires.
- **GroupDetailPage:** When there’s a pending receipt/transaction, poll the same receipt/transaction (or group) every **3–5 seconds** and update `receiptDetail` / transaction state so “who selected what” stays fresh.

### Pros

- Easiest to add; no Supabase Realtime or new infra.
- Works with current Render + Supabase DB setup.

### Cons

- Not instant (up to 3–5 s delay).
- More API traffic while the window is open.

---

## 15-minute window and “dynamic window” UX

- **Backend:** You already have `allocation_deadline_at` (15 minutes from transaction creation) and a timer in `server/src/index.ts` that runs every 30s and applies fallback when the deadline has passed. Keep that.
- **Frontend – “dynamic window” when someone uploads:**
  - When a **transaction** is created (or a receipt is linked to it), all members should see the group/transaction in “pending allocation” state with a visible **countdown** (e.g. “14:32 left to select items”). `TransactionAllocationPage` already uses `allocation_deadline_at` for a countdown; reuse the same idea on the screen where you show “Select your items” (e.g. in `GroupDetailPage` and when opening `ReceiptItemsPage`).
  - Ensure that as soon as a receipt is uploaded and linked to a transaction (or a standalone receipt is in “pending” state), the group view shows the item-split entry point and the 15-minute countdown for everyone. That’s the “dynamic window” that appears once someone uploads.

So:

- **Backend:** Keep 15-min deadline and timer; no change required for the window itself.
- **Frontend:** Ensure the UI that shows “Select your items” and the receipt/transaction also shows `allocation_deadline_at` and subscribes to real-time updates (Realtime or polling) so the window feels “live” and everyone sees the same state.

---

## Unclaimed items: split only among members who selected nothing

**Current behavior (in `server/src/routes/transactions.ts`):** Unclaimed total is split evenly among **all** `memberIds`.

**Desired behavior:** Split unclaimed total only among **members who have not selected any item** (0 claims).

### Implementation outline

In the finalize/settlement logic (e.g. where you compute `userTotals` and handle `unclaimedTotal`):

1. Compute the set of **user IDs who have at least one claim:**  
   `usersWithClaims = new Set(claimRows.map(r => r.user_id))`
2. Compute **members with no claims:**  
   `membersWithNoClaims = memberIds.filter(uid => !usersWithClaims.has(uid))`
3. If `unclaimedTotal > 0`:
   - If `membersWithNoClaims.length > 0`: split `unclaimedTotal` evenly among `membersWithNoClaims` only.
   - If `membersWithNoClaims.length === 0` (everyone claimed something but some items are still unclaimed): fall back to splitting among all `memberIds` (or define another rule; same as today is fine).

Apply this in both:

- Transaction finalize (e.g. `transactions.ts` settlement path).
- Any receipt-complete path that computes splits from claims (e.g. `receipts.ts` `POST /:receiptId/complete` or equivalent) if you use that for the same flow.

---

## Summary

| What | Recommendation |
|------|----------------|
| **Real-time updates** | Prefer **Supabase Realtime** (subscribe to `item_claims` / receipt or transaction channel). Use **polling** as a quick first step if you want to ship faster. |
| **Webhooks** | Not used for notifying browsers; skip for this feature. |
| **15-minute window** | Already in place; expose countdown in the item-split UI and show the “dynamic” window as soon as a receipt is uploaded and linked. |
| **Unclaimed items** | Change logic so unclaimed total is split only among members with zero claims; fall back to all members if no one has zero claims. |

If you tell me whether you want to go with **Supabase Realtime** or **polling** first, I can outline the exact code changes (files and steps) for the frontend and the unclaimed-items rule.
