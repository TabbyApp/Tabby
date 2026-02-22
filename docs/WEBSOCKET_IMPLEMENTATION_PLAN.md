# WebSocket implementation plan

This doc is the full plan for replacing polling with WebSockets so the app updates in real time without hitting Supabase Realtime message caps.

---

## Goals

- **Replace all 10s polling** with server-push over WebSockets.
- **Keep Supabase Realtime for item claims** (no change).
- **Notify only affected users** (e.g. group members) to limit traffic.
- **Auth**: only authenticated clients can connect; each socket is tied to a user.

---

## Events (server → client)

| Event | Payload | When to emit | Who should refetch |
|-------|---------|--------------|--------------------|
| `groups:changed` | `{}` | Group created, deleted, user joined/left, member removed, group updated | Everyone who got the event: refresh groups list (bootstrap). |
| `group:updated` | `{ groupId: string }` | Receipt added/updated/completed, transaction created/finalized/settled, group metadata/split mode changed | Group members: invalidate group cache, refetch group + receipts if viewing that group. |
| `activity:changed` | `{ groupId?: string }` | Transaction settled, receipt split settled | Group members (or all): refresh Activity page data. |

Frontend reaction:

- On `groups:changed`: call `refreshBootstrap()` / `loadGroups()`.
- On `group:updated`: call `invalidateGroupCache(payload.groupId)`; if current screen is group detail or receipt items for that group, refetch.
- On `activity:changed`: if on Activity page, refetch activity.

---

## Server architecture

1. **HTTP server**
   - Use `http.createServer(app)` instead of `app.listen()`.
   - Attach Socket.io to the same server (same port).
   - No extra port or service.

2. **Socket auth**
   - Client connects with token in `auth` or `query` (e.g. `?token=JWT`).
   - Server runs auth middleware on connect: verify JWT, set `socket.data.userId`.
   - Store `userId → Set<socketId>` in memory so we can emit to “user X”.
   - On disconnect, remove socket from that map.

3. **Emit helpers** (in `server/src/socket.ts`)
   - `getGroupMemberIds(groupId): Promise<string[]>` — query `group_members`.
   - `emitToUsers(userIds: string[], event, payload)` — send to all sockets for those users.
   - `emitToGroup(groupId, event, payload)` — get member IDs, then `emitToUsers(memberIds, event, payload)`.
   - Export these so route handlers can call them after mutations.

4. **Where to emit**
   - **Groups**: after create → `emitToGroup(groupId, 'groups:changed')` and `emitToGroup(groupId, 'group:updated', { groupId })` (creator is in group). After delete → get member IDs before delete, then `emitToUsers(ids, 'groups:changed')`. After leave / remove member / join → same idea: affected users get `groups:changed`; for join/leave/remove also `group:updated` for that group. After update (e.g. split mode) → `emitToGroup(groupId, 'group:updated', { groupId })`.
   - **Receipts**: after create (POST `/` or upload), confirm, retry, add item, complete → `emitToGroup(receipt.group_id, 'group:updated', { groupId })`. Optionally also `activity:changed` when receipt is completed if it affects activity.
   - **Transactions**: after create → `emitToGroup(groupId, 'group:updated', { groupId })`. After finalize → same. After settle → `emitToGroup(groupId, 'group:updated', { groupId })` and `emitToGroup(groupId, 'activity:changed', { groupId })`. Fallback (timer) → same as settle.
   - **Invites**: after accept (user joins group) → `emitToUsers([joinerId, ...existingMemberIds], 'groups:changed')` and `emitToGroup(groupId, 'group:updated', { groupId })`.

---

## Frontend architecture

1. **Socket provider**
   - One Socket.io client per logged-in user (e.g. in a context that wraps the app after login).
   - Connect when `user` is set, disconnect when user logs out or token is cleared.
   - Send token in connection options (e.g. `auth: { token }` or `query: { token }`).
   - Base URL: derive from `VITE_API_URL` (e.g. `https://api.example.com` → `wss://api.example.com`). Fallback: same origin or `ws://localhost:3001` for dev.

2. **Listeners**
   - `groups:changed` → call `refreshBootstrap()` (or parent’s `loadGroups()`).
   - `group:updated` → call `invalidateGroupCache(payload.groupId)`; expose a way for GroupDetailPage and ReceiptItemsPage to refetch when they’re showing that group (e.g. context value “lastGroupUpdated” or callback).
   - `activity:changed` → set a “activity invalidated” flag or callback so ActivityPage refetches when mounted/visible.

3. **Remove polling**
   - App: remove 10s `loadGroups` interval.
   - GroupDetailPage: remove 10s group+receipts interval.
   - ActivityPage: remove 10s fetch interval.
   - ReceiptItemsPage: remove 10s receipt-status interval (group:updated covers host completed).

4. **Reconnection**
   - Socket.io handles reconnect. On reconnect, re-send auth if needed (or use same token in query). Optional: on connect, emit “sync” so server can re-send last state; for simplicity we can rely on refetch-on-event only.

---

## Edge cases

- **Multiple tabs**: each tab has its own socket; same user gets events in all tabs. Fine.
- **Server restart (e.g. deploy)**: connections drop; client reconnects; next mutation will push again. No sticky session required.
- **Token expiry**: if socket auth fails on reconnect, frontend should disconnect and redirect to login (or refresh token and reconnect).
- **Item claims**: still use Supabase Realtime; no change. WebSocket `group:updated` can still fire when receipt is completed so group detail and receipt list stay in sync.

---

## What you need to do on your end

1. **Frontend env (required for production)**  
   The app connects to the WebSocket server at the **same host** as the API. Set **`VITE_API_URL`** in your frontend environment to your backend’s full URL, e.g.:
   - **Production (Render):** `VITE_API_URL=https://your-backend-service.onrender.com`  
     (no `/api` path – the code turns this into `wss://your-backend-service.onrender.com` for the socket.)
   - **Local:** If you don’t set it, the frontend uses the current page origin (e.g. `http://localhost:3000`). Your API runs on 3001, so for **local dev** either:
     - Run the frontend with a proxy so API and app are same origin, or  
     - Set `VITE_API_URL=http://localhost:3001` so the socket connects to the backend.

2. **Backend env**  
   No new env vars are required. The server uses the same port for HTTP and WebSocket.

3. **Render**  
   No extra service or port. WebSockets work on your existing backend web service. Render supports WebSockets on the same URL; just deploy as usual.

4. **Install deps**  
   - **Server:** `cd server && npm install` (adds `socket.io`).  
   - **Frontend:** `npm install` (adds `socket.io-client`).

5. **Deploy**  
   Deploy backend and frontend as you normally do. Ensure the frontend build has `VITE_API_URL` set in the build env (e.g. in Render’s frontend service env vars) so the client knows where to connect.

---

## File checklist

**Server**

- `server/src/socket.ts` — Socket.io setup, auth, `userId` map, `emitToGroup`, `emitToUsers`, `getGroupMemberIds` (or use existing from transactions).
- `server/src/index.ts` — Create HTTP server from `app`, attach socket, call `listen` on server.
- `server/src/routes/groups.ts` — Emit after create, delete, leave, join, remove member, update.
- `server/src/routes/receipts.ts` — Emit after create, upload (status change), confirm, retry, add item, complete.
- `server/src/routes/transactions.ts` — Emit after create, finalize, settle; in `runFallbackForTransaction` after fallback.
- `server/src/routes/invites.ts` — Emit after accept.

**Frontend**

- `frontend/contexts/SocketContext.tsx` (or hook in App) — Connect with token, listen for `groups:changed`, `group:updated`, `activity:changed`, call callbacks or set state.
- `frontend/App.tsx` — Use socket context; on `groups:changed` call `loadGroups`; on `group:updated` call `invalidateGroupCache` and optionally trigger group-detail refetch; remove 10s poll.
- `frontend/components/GroupDetailPage.tsx` — Subscribe to “group updated for this groupId” and refetch; remove 10s poll.
- `frontend/components/ActivityPage.tsx` — Subscribe to `activity:changed` and refetch; remove 10s poll.
- `frontend/components/ReceiptItemsPage.tsx` — Subscribe to `group:updated` for current groupId and refetch receipt; remove 10s poll.
- `frontend/lib/socket.ts` (optional) — Socket URL builder from `VITE_API_URL`.

**Docs**

- `docs/LIVE_UPDATES_AND_POLLING.md` — Update to describe WebSocket events and remove polling section (or note “replaced by WebSockets”).
