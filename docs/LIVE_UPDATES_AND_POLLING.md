# Live Updates

This doc summarizes how shared, dynamic data stays up to date so users don't need to refresh the app.

---

## Realtime (Supabase)

| Data | Where | How |
|------|--------|-----|
| **Item claims** (who selected which items) | Receipt item-split screen | Supabase Realtime on `item_claims` filtered by `receipt_id`. When any row changes, the receipt is refetched so everyone sees the same selections. See `frontend/hooks/useReceiptClaimsRealtime.ts` and `docs/SUPABASE_REALTIME_IMPLEMENTATION.md`. |

---

## WebSockets (server push)

The backend emits Socket.io events when data changes; the frontend connects once and refetches when it receives an event. No polling.

| Event | When emitted | Frontend reaction |
|-------|----------------|-------------------|
| `groups:changed` | Group created, deleted, user joined/left, member removed | Refresh groups list (bootstrap). |
| `group:updated` | Receipt added/updated/completed, transaction created/finalized/settled, group/split mode changed | Invalidate group cache; refetch group + receipts if viewing that group or receipt. |
| `activity:changed` | Transaction settled, receipt split settled | Refetch Activity page data. |

See `docs/WEBSOCKET_IMPLEMENTATION_PLAN.md` for setup and "what you need to do on your end".

---

## Summary

- **Groups list:** WebSocket `groups:changed` → refresh bootstrap.
- **Group detail + receipts:** WebSocket `group:updated` → refetch when viewing that group.
- **Item selections:** Supabase Realtime (unchanged).
- **Receipt completed by host:** WebSocket `group:updated` → refetch receipt when on item-split for that group.
- **Activity / settlements:** WebSocket `activity:changed` → refetch activity.

Invites are per-token; after accepting, `groups:changed` updates the list.
