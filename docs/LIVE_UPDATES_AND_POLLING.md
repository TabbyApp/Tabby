# Live Updates and Polling

This doc summarizes how shared, dynamic data stays up to date so users don’t need to refresh the app.

---

## Realtime (Supabase)

| Data | Where | How |
|------|--------|-----|
| **Item claims** (who selected which items) | Receipt item-split screen | Supabase Realtime on `item_claims` filtered by `receipt_id`. When any row changes, the receipt is refetched so everyone sees the same selections. See `frontend/hooks/useReceiptClaimsRealtime.ts` and `docs/SUPABASE_REALTIME_IMPLEMENTATION.md`. |

---

## Polling

| Data | Where | Interval | Purpose |
|------|--------|----------|---------|
| **Groups list** (and bootstrap / virtual cards) | App (when logged in) | 10s | New groups and removed groups appear without refresh. `App.tsx`: `loadGroups()` → `refreshBootstrap()`. |
| **Group + receipts** | Group detail page | 10s | New receipts (e.g. someone added a receipt), status changes, and list stay in sync for all members. `GroupDetailPage.tsx`. |
| **Receipt status** | Receipt item-split page | 10s | When the host completes the split, others see “Host has confirmed” / completed state without refresh. `ReceiptItemsPage.tsx`. |
| **Activity / splits** | Activity page | 10s | New transactions and receipt splits (e.g. settlements) show up without refresh. `ActivityPage.tsx`: `api.transactions.activity()` and `api.receipts.mySplits()`. |

---

## Summary

- **Groups:** 10s poll in App.
- **Group detail (receipts list, status):** 10s poll on GroupDetailPage.
- **Item selections:** Supabase Realtime (no polling).
- **Receipt completed by host:** 10s poll on ReceiptItemsPage.
- **Activity / settlements:** 10s poll on ActivityPage.

Invites are per-token (`GET /api/invites/:token`); there is no “list my pending invites” API, so invite lists are not polled. After accepting an invite, the groups poll will pick up the new group.

---

## Why not webhooks for real-time in the app?

**Webhooks** are server-to-server: one service sends an HTTP POST to another server when something happens (e.g. Stripe notifies your backend when a payment completes). Browsers don't have a URL that the internet can POST to, so webhooks **cannot push updates to the user's app**.

To get true real-time in the UI you need the **browser** to have an open channel that the server (or Supabase) can push over:

1. **Supabase Realtime** (what you use for item claims) – The frontend subscribes to DB table changes; Supabase pushes inserts/updates/deletes. You could enable Realtime on more tables (`groups`, `group_members`, `receipts`, etc.) and subscribe in the app so groups, members, and receipts update instantly. No backend "sending" code; Supabase does it from Postgres.
2. **WebSockets** – Your Express server would hold a persistent connection to each client (e.g. with Socket.io) and emit events when data changes (e.g. "group updated", "receipt added"). You'd add WebSocket support to the server and have the frontend listen and refetch or patch state.

Right now, 10s polling is a good balance: no extra infra, and updates feel quick. If you want instant updates everywhere, the next step is usually **Supabase Realtime on more tables**, since you already use it for item claims and don't need to add a WebSocket server.
