# Tabby App — UX Flow for Figma / Redesign

Use this document to understand the app’s flow from a **user experience and screen-to-screen** perspective. It describes every screen, who sees what, what actions are available, and how users move through the app. No implementation details—only flows, states, and UX.

---

## 1. User roles (who sees what)

- **Guest (not logged in):** Sees only Login/Signup. Can open an invite link (`/join/xxx`); the app stores the link and, after login, sends them to Accept Invite.
- **Logged-in user — Group creator (host):** The person who created the group. Only they can: upload receipts, confirm receipt data, confirm item selections, add tip, and complete payment. They can remove members and delete the group.
- **Logged-in user — Group member (non-host):** Can join via invite link, view group and receipt, select their own items once the host has confirmed the receipt, and see (read-only) tip and totals. Cannot upload receipts, confirm, or pay. Can leave the group.

---

## 2. App shell and global navigation

- **After login:** User lands on **Home (Landing)**. A **bottom navigation bar** is always visible with: **Home**, **Groups**, **Create group (center)**, **Activity**.
- **Top-right:** Notifications bell (with unread count when applicable). **Profile/settings** is reachable from Home, Groups, Activity, Account via a profile/avatar control that opens a sheet with: Account, Settings, Wallet.
- **Back behavior:** Many screens have a back arrow; it typically goes to the previous screen (e.g. Group detail → Groups, Receipt items → Receipt scan or Group detail).

---

## 3. Screens (in order of user journey)

### 3.1 Pre-auth

**Login / Signup**
- **Purpose:** Authenticate or create account (email + password; signup also asks for name).
- **Actions:** Switch between Login / Signup; Submit; “Forgot password” (can open Forgot Password flow).
- **After success:** User is taken to **Home**. If they had an invite link stored, they are taken to **Accept Invite** instead.

**Forgot Password**
- **Purpose:** Request password reset (email).
- **Actions:** Enter email; Submit; Back to Login.

---

### 3.2 Accept Invite (conditional)

- **When:** User has opened an invite link (`/join/xxx`) and is now logged in (or just signed up).
- **Purpose:** Show group name and let user join the group.
- **Actions:** “Join group” (requires payment method / bank linked; if not, they may be sent to Account or a link-bank step); “Cancel” or “Back” → Home.
- **After join:** Navigate to **Group detail** for that group. Invite link is cleared.

---

### 3.3 Home (Landing)

- **Purpose:** Dashboard: active card, list of groups, recent groups, quick access to notifications and profile.
- **Content:**
  - **Active card:** One virtual card (last 4 digits, balance/total). Tapping goes to **Card details** for that group.
  - **My groups:** Short list of groups (e.g. 2). Each row: group name, member count; tap → **Group detail**.
  - **“View all groups”** or similar → **Groups**.
  - **Recent groups:** Groups that have been settled (e.g. payment completed) and are “older”; tap → **Group detail**.
  - **“Create group”** (if present) → **Create group**.
- **Actions:** Notifications bell → **Notifications**. Profile/avatar → Profile sheet (Account, Settings, Wallet). Tap group → Group detail. Tap card → Card details.

---

### 3.4 Groups

- **Purpose:** List all groups the user is in (active and recent in one list, or split into sections).
- **Content:** Each row: group name, member count, maybe last four of card. Optional: delete (host) or leave (member) from long-press or menu.
- **Actions:** Tap a group → **Group detail**. “Create group” (e.g. FAB or button) → **Create group**. Profile → Profile sheet.

---

### 3.5 Create group

- **Purpose:** Create a new group (name; optionally add members by email).
- **Actions:** Enter group name; optionally add emails; “Create” → group is created. Then: “Go to group” → **Group detail** for the new group, or “View all groups” → **Groups**.

---

### 3.6 Group detail (core screen — multiple states)

This is the main hub for one group. **What the user sees depends on: (1) whether they are host or member, (2) whether there is a receipt, (3) whether items are selected and confirmed, (4) whether the group has already been settled.**

**Always visible (conceptually):**
- Header: Back (→ Groups), group name.
- Invite: Copy invite link; share (e.g. “Share this link to join [group name]”).
- Members: List or avatars of members. Host can open a member menu to **remove member** (with confirmation). Non-host can **leave group** (with confirmation). Host can **delete group** (with confirmation).
- Optional: Virtual card summary (last 4, balance) → tap to **Card details**.

**State A — No receipt yet (item-split mode)**

- **Host sees:** “Upload a receipt” / “Scan receipt.” Subtext: “Upload your receipt and choose what you ordered to split by item.”
- **Member sees:** “Waiting for receipt.” Subtext: “The group creator needs to upload a receipt first.”
- **Action (host only):** “Scan receipt” (or “Upload receipt”) → **Receipt scan**.

**State B — Receipt uploaded, not yet confirmed by host**

- **Everyone sees:** “Select your items” with short explanation that a receipt was uploaded and they can split by item.
- **Host:** Can open the receipt to **review and confirm** it first (see Receipt items — Review).
- **Member:** Can open “Select your items” but may see “Waiting for host to confirm” until the host has confirmed the receipt; then they can select items.
- **Action:** “Select your items” → **Receipt items** (review for host, or item selection for everyone after confirm).

**State C — Receipt confirmed; everyone can select items**

- **Everyone:** “Select your items” is the main CTA. Members choose which items are theirs; host does too and can also **confirm selections** when all items are claimed.
- **Action:** “Select your items” → **Receipt items** (item-split view). After host confirms selections → back to Group detail in State D.

**State D — Items confirmed; tip and payment (no transaction yet)**

- **Everyone sees:** A summary card: “Your items” subtotal, tax, tip (%), “Your total.” For host, tip is editable; for members, tip is read-only and updates when host changes it.
- **Host sees:** “Add tip” (e.g. 10 / 15 / 18 / 20% + slider), then a primary button: “Complete payment • $X.XX.”
- **Member sees:** Same summary and “Only the group creator can add tip and complete payment.”
- **Action (host):** Set tip, tap “Complete payment” → backend creates and finalizes the transaction → **Processing payment**. Members don’t tap anything here; they just see the summary.

**State E — Payment already settled (post-transaction)**

- **Everyone sees:** A “last settled” or “last payment” summary: who paid what, breakdown (subtotal, tax, tip per person). Receipt/items may be listed. No “Upload receipt” or “Complete payment” in the same way; this is a view-only state for that past settlement.
- **Action:** Can still use invite, members, leave/remove/delete as above. Optionally “Add another receipt” or “Start new split” if the product allows a new round.

**Even-split mode (if the app supports it):**  
Host may have a toggle or choice for “Split evenly” vs “Split by item.” For even split, the flow may skip item selection and go straight to total → tip → complete payment. Design should account for this branch if it exists.

---

### 3.7 Receipt scan

- **Purpose:** Capture or pick a receipt image for the current group.
- **Content:** Camera or “choose from library”; preview of the image.
- **Actions:** “Use photo” / “Upload” → backend runs OCR. Then either: **“Return to group”** (e.g. for even split) → **Group detail**, or **“Continue to items”** → **Receipt items** (review or item split).
- **States:** Uploading / processing (loading); success (then navigate); error (retry or back).

---

### 3.8 Receipt items (two main modes)

**Mode 1 — Review receipt (host only, when OCR just finished)**

- **When:** Receipt status is “needs review” (e.g. right after upload). Only host sees this.
- **Purpose:** Correct merchant, totals (subtotal, tax, tip, total), and line items (name, price). Validation can show “Reconciles” or “Doesn’t reconcile” if numbers don’t add up.
- **Actions:** Edit fields; “Confirm receipt” → receipt is locked and everyone can select items. “Back” → Receipt scan or Group detail.
- **If OCR failed:** “Retry” or “Add items manually” (if supported).

**Mode 2 — Select your items (everyone, after receipt is confirmed)**

- **Purpose:** Each user selects which line items are theirs (tap to claim/unclaim). Shared items are split (e.g. “Split 2 ways”). Users only edit **their own** selections; they can view others’ by switching a “member” selector, but toggles are disabled for others.
- **Default:** The current user’s selection is shown first (not the host’s).
- **Content:** List of receipt line items; each row shows item name, price, and who has claimed it (avatars or names). Summary at bottom: “Your total,” receipt total, and “All items must be selected before submitting” until every item has at least one claimant.
- **Host only:** “Confirm selections” when all items are claimed → confirmation modal (“You’ll add tip and complete payment on the next screen”) → Confirm → **Group detail** (State D: tip + complete payment).
- **Member:** No “Confirm selections”; they just select their items and can go back to Group detail. They see “Only the receipt uploader can confirm. Select your items; the host will complete payment.”
- **Actions:** Back → **Group detail**. Optional: “Add manual item” (host). After host confirms → **Group detail**.

---

### 3.9 Processing payment

- **Purpose:** Show that payment is in progress after the host tapped “Complete payment” on Group detail.
- **Content:** Loading state (e.g. spinner), “Processing payments,” “Charging cards for each member…” and a list of members with amounts.
- **Flow:** Short delay (e.g. 2–3 s), then “Success” or checkmarks; then auto-redirect to **Home** after a few seconds.
- **Who lands here:** Only the host (they’re the one who tapped “Complete payment”). Other members stay on Group detail and see the summary; when the transaction is settled, their data can update in place or on next open.

---

### 3.10 Card details

- **Purpose:** Show one group’s virtual card (last 4, balance/total, support code if any).
- **Actions:** “Back to home” or back → **Home**; optional “View group” → **Group detail** for that group.

---

### 3.11 Activity

- **Purpose:** User’s payment history (e.g. “You paid $X for [group] on [date]”).
- **Content:** List of past transactions / settlements. Tapping a row might show more detail or go to Group detail.
- **Actions:** Back / Home; Profile sheet.

---

### 3.12 Account

- **Purpose:** Profile (name, email, phone), payment method / bank linking.
- **Actions:** Edit profile; link bank / add payment method (required for creating groups and joining); navigate to Settings, Wallet, or back.

---

### 3.13 Settings

- **Purpose:** App settings: Pro account, appearance (theme), notifications, privacy, help & support, logout. May link to Change password, Two-factor auth.
- **Actions:** Each row → its sub-screen (Appearance, Notifications, Privacy, Help, etc.) or external link. Logout → **Login**.

---

### 3.14 Notifications

- **Purpose:** In-app notifications (e.g. invites, payment updates). Unread count on bell on Home.
- **Actions:** Mark read; accept/decline invite (if applicable); back → previous screen (often Home).

---

### 3.15 Modals / overlays (global or in-context)

- **“You’ve been removed from the group.”** Shown to a user when the host removes them. One button: “OK.” After OK, user is on **Home** and the group is gone from their list.
- **“This group was deleted.”** Shown to all members when the host deletes the group. One button: “OK.” After OK, user is on **Home** and the group is gone.
- **Confirmations:** e.g. “Remove member?” / “Leave group?” / “Delete group?” with Cancel and Confirm. Confirm performs the action and closes the modal; navigation (e.g. back to Groups or Home) follows the flow above.
- **Confirm item selections (host):** “Confirm item selections?” with breakdown by member and “You’ll add tip and complete payment on the next screen.” Cancel / Confirm.

---

## 4. Main user journeys (step-by-step)

### Journey 1 — Host: Create group, add receipt, split by item, pay

1. **Home** → “Create group” or **Groups** → “Create group.”
2. **Create group** → Enter name → Create → “Go to group.”
3. **Group detail** (State A) → “Scan receipt.”
4. **Receipt scan** → Take/choose photo → Upload → “Continue to items” (or auto).
5. **Receipt items (Review)** → Fix any totals/items → “Confirm receipt.”
6. **Receipt items (Select)** → Host selects their items → “Confirm selections” when all items claimed → Confirm in modal.
7. **Group detail** (State D) → Set tip → “Complete payment • $X.XX.”
8. **Processing payment** → Success → **Home**.

### Journey 2 — Member: Join via link, select items, wait for host to pay

1. Open invite link → **Accept invite** (or Login/Signup first, then Accept invite).
2. **Accept invite** → “Join group” → **Group detail**.
3. **Group detail:** If receipt not yet confirmed → “Select your items” may show “Waiting for host to confirm.” Once confirmed → “Select your items.”
4. **Receipt items (Select)** → Member selects only their items (default view is “Your” items); can view others’ selections but not edit. No “Confirm selections” button.
5. Back to **Group detail** (State D) → See “Your items,” tax, tip (read-only), “Your total.” Message: only creator can add tip and complete payment.
6. When host completes payment, member’s Group detail can update to show “last settled” (State E) or they see it on next visit.

### Journey 3 — Host: Remove member

1. **Group detail** → Open members → Select a member (not self) → “Remove from group” (or similar).
2. Confirmation modal → Confirm.
3. That member gets the “You’ve been removed from the group” modal and is sent to **Home**; host stays on Group detail (member list updates).

### Journey 4 — Host: Delete group

1. **Group detail** (or **Groups**) → Delete group (e.g. from menu).
2. Confirmation modal → Confirm.
3. All members (including host) get “This group was deleted” modal → OK → **Home**; group disappears from everyone’s list.

### Journey 5 — Member: Leave group

1. **Group detail** or **Groups** → “Leave group.”
2. Confirmation → Confirm.
3. User returns to **Groups** or **Home**; group removed from their list.

---

## 5. Cross-cutting UX notes

- **Real-time updates:** When someone joins a group, the host’s Group detail members list updates without refresh. When the host confirms the receipt, members can select items without refresh. When the host changes tip, members’ “tip” line updates. When payment is settled, everyone’s view can update (e.g. “last settled”).
- **Empty states:** Home with no groups: show “Create a group” or “Join with invite link.” Group with no receipt: “Upload a receipt” (host) / “Waiting for receipt” (member). Receipt items with no claims: “Select your items” and “All items must be selected…”
- **Errors:** Network errors, “Couldn’t read the image” (receipt), invalid token (invite link), “Receipt does not reconcile” (review). Design for inline or toast messages and retry where it makes sense.
- **Permissions:** Disable or hide actions that the current role cannot do (e.g. member never sees “Confirm receipt,” “Confirm selections,” “Complete payment,” “Remove member,” “Delete group”). Show short explanations (“Only the group creator can…”).
- **Navigation consistency:** Back from Group detail → Groups. Back from Receipt items → Group detail (or Receipt scan if that’s where they came from). After “Complete payment” → Processing payment → Home. After Accept invite → Group detail. After Create group → Group detail or Groups.

---

## 6. Screen list (for Figma frames)

Use this as a checklist for screens/frames:

- [ ] Login
- [ ] Signup
- [ ] Forgot password
- [ ] Accept invite
- [ ] Home (with groups; with empty state)
- [ ] Groups (list)
- [ ] Create group
- [ ] Group detail — no receipt (host)
- [ ] Group detail — no receipt (member)
- [ ] Group detail — receipt uploaded, not confirmed (host / member)
- [ ] Group detail — items selected, tip + complete payment (host)
- [ ] Group detail — items selected, tip read-only (member)
- [ ] Group detail — post-settlement (view last payment)
- [ ] Receipt scan (capture; processing; success/error)
- [ ] Receipt items — review (host)
- [ ] Receipt items — select items (with “Confirm selections” for host)
- [ ] Receipt items — select items (member, no confirm button)
- [ ] Receipt items — waiting for host to confirm (member)
- [ ] Processing payment (loading; success)
- [ ] Card details
- [ ] Activity
- [ ] Account
- [ ] Settings (and sub-screens: Appearance, Notifications, Privacy, Help, etc.)
- [ ] Notifications
- [ ] Modal: Removed from group
- [ ] Modal: Group deleted
- [ ] Modal: Confirm remove member / leave / delete group
- [ ] Modal: Confirm item selections (host)
- [ ] Profile sheet (Account, Settings, Wallet)
- [ ] Bottom navigation (Home, Groups, Create, Activity)

---

End of UX flow document. Use this to drive information architecture, user flows, and screen-level redesign in Figma.
