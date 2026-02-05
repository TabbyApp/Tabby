# Tabby — Full Implementation Checklist

Use this list to get to a **full working application with no misses**. Each item is a concrete implementation task. Order is roughly dependency-friendly; you can parallelize where noted.

---

## 1. Infrastructure & Robustness

| # | Task | Where | Details |
|---|------|--------|---------|
| 1.1 | **Ensure DB and uploads dirs exist and are writable before use** | `server/src/db.ts`, `server/src/routes/receipts.ts` | Create `data/` and `uploads/` with `fs.mkdirSync(..., { recursive: true })`; catch errors and throw a clear message so `SQLITE_CANTOPEN` doesn’t surface as a raw 500. |
| 1.2 | **OCR request timeout and process cleanup** | `server/src/routes/receipts.ts`, `server/src/ocr.ts` | Add a hard timeout (e.g. 20s) that kills the OCR child process on timeout; return 408 or 422 with a clear message instead of hanging or unhandled rejection. |
| 1.3 | **Central 500 handling and request logging** | `server/src/index.ts` | Log every 5xx with request method, path, and error; always return a consistent JSON `{ error: "..." }` and never leak stack traces. |
| 1.4 | **Refresh token on 401 in api.ts** | `src/lib/api.ts` | After 401, call refresh once and retry the same request; if refresh fails, clear tokens and redirect to login (or trigger logout callback). |

---

## 2. Database Schema Additions

| # | Task | Where | Details |
|---|------|--------|---------|
| 2.1 | **Group invites table** | `server/src/db.ts` | e.g. `group_invites (id, group_id, inviter_id, invitee_email, token UNIQUE, status, created_at)`. Index on `token`, `invitee_email`, `group_id`. |
| 2.2 | **Plaid / bank linkage (optional but recommended)** | `server/src/db.ts` | Either add columns to `payment_methods` (e.g. `plaid_item_id`, `plaid_account_id`) or a `plaid_items` table linking user to Plaid access token and account id. |
| 2.3 | **Virtual card “active” flag** | `server/src/db.ts` | Add `active INTEGER DEFAULT 1` to `virtual_cards` so toggling card on/off is persisted. |
| 2.4 | **Receipt OCR metadata (optional)** | `server/src/db.ts` | Optional: add `ocr_confidence REAL`, `ocr_raw_json TEXT` to `receipts` for multi-pass/confidence. |
| 2.5 | **Notifications table** | `server/src/db.ts` | `notifications (id, user_id, type, title, body, link_type, link_id, read_at, created_at)`. Index on `user_id`, `read_at`. |

---

## 3. Auth & Profile (Backend)

| # | Task | Where | Details |
|---|------|--------|---------|
| 3.1 | **PATCH /api/users/me** | `server/src/routes/users.ts` | Accept `name`, `email` (and optionally `password` for change). Validate email uniqueness; update user row; return updated user (no password_hash). |
| 3.2 | **Optional: avatar URL** | `server/src/db.ts`, `users` routes | Add `avatar_url TEXT` to users; include in GET/PATCH me. |

---

## 4. Payment Methods & Plaid (Backend)

| # | Task | Where | Details |
|---|------|--------|---------|
| 4.1 | **Plaid: create link token** | New route e.g. `POST /api/plaid/link-token` | Use Plaid SDK (sandbox); create link token for the current user; return `{ linkToken }` for frontend Plaid Link. |
| 4.2 | **Plaid: exchange public token** | New route e.g. `POST /api/plaid/exchange` | Exchange public token for access token; store in DB (e.g. plaid_items or payment_methods); fetch accounts and create/update `payment_methods` rows (type `bank`, last_four, optional plaid_account_id). |
| 4.3 | **GET payment methods** | Already in GET /users/me | Ensure response includes all payment methods (card + bank from Plaid). |
| 4.4 | **Optional: set default payment method** | `server/src/routes/users.ts` | Add `default_payment_method_id` to users or a `is_default` on payment_methods; use it when charging. |

---

## 5. Invite & Join Flow (Backend)

| # | Task | Where | Details |
|---|------|--------|---------|
| 5.1 | **POST /api/groups/:groupId/invites** | `server/src/routes/groups.ts` | Admin only. Body: `{ inviteeEmail }`. Create row in `group_invites` with unique token; return `{ inviteId, token, inviteLink }` (invite link = frontend URL + token). |
| 5.2 | **GET /api/invites/:token** | New route e.g. `server/src/routes/invites.ts` | Public or auth-optional. Return `{ groupName, inviterName, inviteeEmail, token }` so frontend can show “Accept invite to &lt;group&gt;”. |
| 5.3 | **POST /api/invites/:token/accept** | Same file | Require auth. If logged-in user’s email matches invitee_email (or token is valid and not yet used): (1) **Require payment method**: if user has no payment_methods, return 403 with code `PAYMENT_METHOD_REQUIRED`. (2) Add user to group_members; mark invite accepted; return group. |
| 5.4 | **GET /api/users/me/invites** | `server/src/routes/users.ts` or invites | Return pending invites for current user (by email). |
| 5.5 | **Add members by email at group creation** | Keep existing | Current behavior (add existing users by email) can remain; optionally also create an “invite” record so they see it in “pending invites” if you want consistency. |

---

## 6. Payment Method Required Before Join (Backend + Frontend)

| # | Task | Where | Details |
|---|------|--------|---------|
| 6.1 | **Enforce in accept-invite** | `server/src/routes/invites.ts` | In POST accept: if `payment_methods` count for user is 0, return 403 `{ code: 'PAYMENT_METHOD_REQUIRED', error: '...' }`. |
| 6.2 | **Frontend: gate on invite-accept** | Invite-accept page/screen | On 403 with `PAYMENT_METHOD_REQUIRED`, redirect to “Add payment method” flow (Plaid or card), then retry accept. |

---

## 7. Virtual Card Toggle (Backend + Frontend)

| # | Task | Where | Details |
|---|------|--------|---------|
| 7.1 | **PATCH /api/groups/:groupId/virtual-card** | `server/src/routes/groups.ts` | Body: `{ active: boolean }`. Update `virtual_cards.active`; return updated card. Member or admin. |
| 7.2 | **VirtualWalletPage: call API on toggle** | `src/components/VirtualWalletPage.tsx` | Replace local-only toggle with `api.groups.updateVirtualCard(groupId, active)`. |

---

## 8. Receipt Pipeline (Backend) — Robust OCR

| # | Task | Where | Details |
|---|------|--------|---------|
| 8.1 | **Image pre-processing** | New module e.g. `server/src/receipt-preprocess.ts` | Given image path: deskew, denoise, increase contrast, optional crop to receipt region. Use sharp or jimp; output temp file path for OCR. |
| 8.2 | **Receipt-specialized extractor (primary)** | New module or integrate API | Use a receipt-trained service: e.g. Google Document AI (Receipt), AWS Textract, or a dedicated receipt API. Output: structured JSON (line items with name/price, total, merchant). |
| 8.3 | **Second extractor** | Same or different service | Run a second model (e.g. Tesseract with different PSM, or another API) on the same pre-processed image. |
| 8.4 | **Vote/merge and confidence** | New module e.g. `server/src/receipt-merge.ts` | Compare two extraction results: by field (item name, price), choose higher-confidence or merge; compute overall confidence score. |
| 8.5 | **Optional: LLM cleanup** | Same or new module | Send merged line items + raw text to an LLM to normalize names, fix obvious errors, resolve conflicts. |
| 8.6 | **Upload flow integration** | `server/src/routes/receipts.ts` | Run: preprocess → extractor1 → extractor2 → merge/vote → optional LLM → confidence. If confidence &lt; threshold, return items as [] or minimal and a flag `manualEntry: true` so frontend shows “We couldn’t read everything; add items manually.” |
| 8.7 | **Keep existing add-item and manual flow** | Already there | No change; used as fallback when OCR confidence is low. |

---

## 9. Charging (Backend)

| # | Task | Where | Details |
|---|------|--------|---------|
| 9.1 | **POST /api/receipts/:receiptId/charge** | `server/src/routes/receipts.ts` | Idempotent (e.g. receipt status must be `completed` and splits not yet `charged`). For each `receipt_splits` row: charge that user’s default (or first) payment method via Stripe (or mock). Update split status to `charged` or `failed`; store charge id if real. Return `{ charged: number, failed: number, results: [...] }`. |
| 9.2 | **Stripe (or mock) integration** | New file e.g. `server/src/payments.ts` | Stripe: create PaymentIntent or Charge per user using stored payment method id (you’ll need to store Stripe pm id in payment_methods for real cards). For MVP without real money: mock charge = sleep + update status to `charged`. |
| 9.3 | **Default/first payment method** | Charging logic | When charging a user, resolve their payment method (default or first); if none, mark that split as `failed` with reason. |

---

## 10. Frontend: API Client Additions

| # | Task | Where | Details |
|---|------|--------|---------|
| 10.1 | **users.me patch** | `src/lib/api.ts` | `users.updateMe({ name?, email? })` → PATCH /users/me. |
| 10.2 | **Plaid link token & exchange** | `src/lib/api.ts` | `plaid.getLinkToken()`, `plaid.exchangePublicToken(publicToken)`. |
| 10.3 | **Invites** | `src/lib/api.ts` | `invites.getByToken(token)`, `invites.accept(token)`, `invites.myPending()`. |
| 10.4 | **Groups: create invite, update card** | `src/lib/api.ts` | `groups.createInvite(groupId, inviteeEmail)`, `groups.updateVirtualCard(groupId, active)`. |
| 10.5 | **Receipt charge** | `src/lib/api.ts` | `receipts.charge(receiptId)` → POST /receipts/:id/charge. |

---

## 11. Frontend: Account Page

| # | Task | Where | Details |
|---|------|--------|---------|
| 11.1 | **Load real profile** | `src/components/AccountPage.tsx` | On mount, call `api.users.me()`; show name, email (and optional phone/address if you add them later). Remove hardcoded “John Doe” / “john@example.com”. |
| 11.2 | **Edit name / email** | Same | “Edit” opens inline or modal; on save call `api.users.updateMe({ name, email })`; refresh profile. |
| 11.3 | **Payment methods list from API** | Same | Map `user.paymentMethods` to list; show type, last_four, brand. “Manage” → navigate to a dedicated “Payment methods” page or sheet. |
| 11.4 | **Add payment method entry point** | Same | “Add bank account” or “Add card” → Plaid Link or card form; after success refresh me and payment methods. |
| 11.5 | **Optional: phone, address** | Same | Only if you add fields to DB and PATCH me; otherwise remove or hide those rows. |

---

## 12. Frontend: Invite Flow

| # | Task | Where | Details |
|---|------|--------|---------|
| 12.1 | **Group detail: “Invite” button** | `src/components/GroupDetailPage.tsx` | For admin: open UI to enter email and create invite; show invite link (copy) or “Invite sent”. |
| 12.2 | **Invite link handling** | App routing / landing | Support URL like `/invite/:token`. If not logged in, redirect to login then back to invite. If logged in, show “Accept invite to &lt;group&gt;” and “Accept” button. |
| 12.3 | **Accept invite** | Same | Call `api.invites.accept(token)`. On 403 PAYMENT_METHOD_REQUIRED, redirect to add payment method then retry. On success, redirect to group detail. |
| 12.4 | **Pending invites** | Home or profile | Show “You have N pending invites”; list with Accept/Decline; call accept or a decline endpoint if you add it. |

---

## 13. Frontend: Card Details & Virtual Wallet

| # | Task | Where | Details |
|---|------|--------|---------|
| 13.1 | **CardDetailsPage: real data** | `src/components/CardDetailsPage.tsx` | Receive `groupId` (or card id); fetch group + virtual card; show real `card_number_last_four` and group name. Remove hardcoded card number and fake transactions. |
| 13.2 | **Card details: transactions** | Same | If you have no real transaction feed, show “Recent splits” for this group (receipt_splits for receipts in this group) or hide section until you have a feed. |
| 13.3 | **VirtualWalletPage: persist toggle** | `src/components/VirtualWalletPage.tsx` | Already covered in 7.2; ensure “View Details” goes to Card Details with the correct groupId. |

---

## 14. Frontend: Receipt Complete → Charge → Processing

| # | Task | Where | Details |
|---|------|--------|---------|
| 14.1 | **After “Complete” receipt: call charge** | `src/components/ReceiptItemsPage.tsx` or GroupDetailPage | When user completes itemization, instead of only navigating to ProcessingPaymentPage with splits: call `api.receipts.charge(receiptId)` then navigate to ProcessingPaymentPage with real split results (and pass receiptId/groupId). |
| 14.2 | **ProcessingPaymentPage: real outcome** | `src/components/ProcessingPaymentPage.tsx` | Option A: Trigger charge in previous step and pass result (who succeeded/failed). Option B: On mount, call charge and show progress. Show “Charged” vs “Failed” per member; on finish navigate to group detail. |
| 14.3 | **Handle charge failures** | Same | If some splits failed (e.g. no payment method), show which ones and “Update payment method” or “Retry” if you add retry. |

---

## 15. Notifications (Minimal)

| # | Task | Where | Details |
|---|------|--------|---------|
| 15.1 | **Create notification helper** | `server/src/notifications.ts` | e.g. `createNotification(userId, type, title, body, linkType, linkId)`. Call when: user is added to group, invite accepted, receipt ready to claim, charge completed, etc. |
| 15.2 | **GET /api/notifications** | New route `server/src/routes/notifications.ts` | Paginated list for current user; unread first. |
| 15.3 | **PATCH /api/notifications/:id/read** | Same | Mark read. |
| 15.4 | **Frontend: notifications list** | New component or in Profile/Home | Fetch and show list; “Mark all read”; link to group/receipt/activity. |

---

## 16. Create Group Copy & Invite UX

| # | Task | Where | Details |
|---|------|--------|---------|
| 16.1 | **CreateGroupPage: clarify invite vs add** | `src/components/CreateGroupPage.tsx` | Copy: “Add by email (they’ll be members if they have an account)” vs “Or send invite links after creating the group.” Optionally: after create, show “Send invite” for each email that wasn’t found as existing user. |
| 16.2 | **Create invite after group create** | Frontend or backend | For each member email that doesn’t exist, create an invite (POST /groups/:id/invites) so they can sign up and accept later. |

---

## 17. Settings, Privacy, and Optional Fluff

| # | Task | Where | Details |
|---|------|--------|---------|
| 17.1 | **Settings: keep theme only** | `src/components/SettingsPage.tsx` | No backend needed for theme. Notifications toggle can call PATCH /users/me with `notification_preferences` if you add that later. |
| 17.2 | **Privacy** | Optional | If you want “visibility” or “who can invite me,” add DB fields and PATCH me; otherwise skip. |

---

## 18. End-to-End Checks (No Misses)

| # | Task | Details |
|---|------|---------|
| 18.1 | **Signup → add payment (Plaid) → create group → invite by link → accept (with payment gate) → add receipt → OCR/manual items → assign items (multi-split) → complete → charge → see activity** | Run through full flow; fix any missing API or UI. |
| 18.2 | **Logged-out invite link** | Open /invite/:token → login → accept; confirm payment required if no method. |
| 18.3 | **Low OCR confidence** | When extractors disagree or confidence low, confirm manual add-item flow is shown and works. |
| 18.4 | **Charge failure** | User with no payment method in group; complete receipt → charge; confirm that split shows failed and rest charged. |
| 18.5 | **Virtual card toggle** | Toggle off in Virtual Wallet; reload page; confirm card still inactive. |

---

## Summary Count (Approximate)

- **Backend:** ~25 tasks (DB, routes, OCR pipeline, Plaid, charge, notifications).
- **Frontend:** ~15 tasks (Account, Invite, Card Details, Wallet toggle, Charge flow, API client, notifications list).
- **E2E / robustness:** 5 checks.

You can implement in phases: e.g. **Phase 1** = robustness + profile + Account page + invite/accept + payment required. **Phase 2** = Plaid + charge (mock then Stripe). **Phase 3** = Receipt pipeline (preprocess + dual extractor + confidence). **Phase 4** = Notifications and polish.
