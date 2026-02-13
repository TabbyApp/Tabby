# Core User Flows

This document walks through every major user flow in Tabby, step by step. Each flow shows the frontend actions, API calls, and backend operations.

---

## 1. Group Creation

### User Experience

1. User taps **"+"** button on home screen → CreateExpensePage
2. Taps **"Create Group"** → CreateGroupPage
3. Enters group name (e.g., "Friday Dinner")
4. Optionally adds member emails
5. Taps **"Create"**
6. Sees success screen → navigates to GroupDetailPage

### Technical Flow

```
Frontend: CreateGroupPage
    │
    ├── api.groups.create(name, memberEmails)
    │   │
    │   ▼  Backend: POST /api/groups
    │   1. Generate group ID (UUID)
    │   2. Generate invite_token (24-char hex)
    │   3. INSERT into groups
    │   4. INSERT creator into group_members
    │   5. Generate virtual card (random 4 digits)
    │   6. INSERT into virtual_cards
    │   7. For each memberEmail: find user, INSERT into group_members
    │   8. Return { id, name, memberCount, cardLastFour }
    │
    ├── Show success state
    │
    └── onNavigate({ page: 'groupDetail', groupId })
```

---

## 2. Joining a Group via Invite

### User Experience

1. User receives an invite link: `https://tabby.app/?invite=abc123def456`
2. Opens the link
3. If not logged in: sees login/signup page → logs in
4. If bank not linked: sees bank linking page → links bank
5. Automatically joins the group and sees the GroupDetailPage

### Technical Flow

```
App.tsx on mount:
    │
    ├── Read ?invite=TOKEN from URL
    │   └── Store in sessionStorage (survives auth redirect)
    │
    ├── After user is authenticated + bank_linked:
    │   ├── Read token from sessionStorage
    │   ├── api.groups.joinByToken(token)
    │   │   │
    │   │   ▼  Backend: POST /api/groups/join/:token
    │   │   1. Find group by invite_token
    │   │   2. Check if user already a member
    │   │   3. INSERT into group_members (if not already)
    │   │   4. Return { groupId, groupName, joined: true }
    │   │
    │   ├── Clear sessionStorage
    │   └── onNavigate({ page: 'groupDetail', groupId })
```

### Invite Link Generation

On `GroupDetailPage`, the invite link is constructed client-side:

```typescript
const inviteLink = `${window.location.origin}/?invite=${group.inviteToken}`;
```

The QR code encodes this same URL using `qrcode.react`.

---

## 3. Even Split Payment

### User Experience

1. Host opens group → GroupDetailPage
2. Split mode is set to **"Even"** (default)
3. Host taps **"Upload Receipt"** → takes a photo
4. OCR processes the receipt → total is extracted
5. Host adjusts **tip** via slider
6. Sees per-person amount: `(total + tip) / members`
7. Host taps **"Confirm & Pay"**
8. Processing animation plays → success screen
9. Transaction settles

### Technical Flow

```
GroupDetailPage (Even Split):
    │
    ├── 1. Upload Receipt
    │   ├── Create transaction: api.transactions.create(groupId, 'EVEN_SPLIT')
    │   │   └── Backend creates tx with PENDING_ALLOCATION, 15-min deadline
    │   │
    │   ├── Upload file: api.transactions.uploadReceipt(txId, file)
    │   │   │
    │   │   ▼  Backend: POST /api/transactions/:id/receipt
    │   │   1. Save file via multer
    │   │   2. Run OCR (TabScanner: upload → wait → poll → extract)
    │   │   3. Create receipt record
    │   │   4. Create receipt_items from OCR results
    │   │   5. Calculate subtotal from items
    │   │   6. Update transaction subtotal + total
    │   │   7. Return { receipt_id, items, subtotal }
    │   │
    │   └── Reload group data
    │
    ├── 2. Set Tip
    │   ├── Host moves tip slider
    │   ├── (Local state update for UI)
    │   └── api.transactions.setTip(txId, tipAmount) called on confirm
    │
    ├── 3. Confirm & Pay
    │   ├── api.transactions.setTip(txId, tipAmount)
    │   ├── api.transactions.finalize(txId)
    │   │   │
    │   │   ▼  Backend: POST /api/transactions/:id/finalize
    │   │   1. Get all group member IDs
    │   │   2. total = subtotal + tip
    │   │   3. perPerson = total / memberCount
    │   │   4. Round to cents (penny goes to first member)
    │   │   5. CREATE transaction_allocations for each member
    │   │   6. UPDATE transaction: status = SETTLED, timestamps
    │   │   7. UPDATE receipt: status = completed
    │   │   8. Return { allocations: [{user_id, amount, name}] }
    │   │
    │   └── onNavigate({ page: 'processing', splits: allocations })
    │
    └── 4. ProcessingPaymentPage
        ├── Show spinner for 2.5 seconds
        ├── Show success screen with breakdown
        └── Auto-redirect to group detail after 2 more seconds
```

---

## 4. Item Split (Full Control) Payment

### User Experience

1. Host opens group → switches to **"Item split"** mode
2. Host taps **"Upload Receipt"** → takes a photo
3. OCR processes → items listed on ReceiptItemsPage
4. Each member is selected via tabs at the top
5. Tap items to assign them to the selected member
6. Multiple members can share an item (split cost)
7. Tap **"Confirm Selections"** → returns to GroupDetailPage
8. GroupDetailPage shows **item breakdown** per member
9. Host adjusts **tip** via slider
10. Host taps **"Confirm & Pay"**
11. Processing animation → settlement

### Technical Flow

```
GroupDetailPage (Full Control):
    │
    ├── 1. Upload Receipt
    │   ├── Create transaction: api.transactions.create(groupId, 'FULL_CONTROL')
    │   ├── Upload file: api.transactions.uploadReceipt(txId, file)
    │   └── Navigate to ReceiptItemsPage
    │
    ├── 2. ReceiptItemsPage — Assign Items
    │   ├── Load items: api.transactions.get(txId)
    │   │   └── Returns items, claims, members
    │   │
    │   ├── Select member tab → select items
    │   │   └── api.transactions.setClaims(txId, itemId, [userId1, userId2])
    │   │       │
    │   │       ▼  Backend: PUT /api/transactions/:id/items/:itemId/claims
    │   │       1. Delete existing claims for this item
    │   │       2. INSERT new claims
    │   │       3. Return { userIds }
    │   │
    │   ├── (Optional) Add manual items
    │   │   └── api.receipts.addItem(receiptId, name, price)
    │   │
    │   └── Tap "Confirm Selections"
    │       └── onNavigate({ page: 'groupDetail', groupId })
    │
    ├── 3. GroupDetailPage — Review Breakdown
    │   ├── Fetch transaction details: api.transactions.get(txId)
    │   ├── Display per-member breakdown:
    │   │   ├── Member avatar + name
    │   │   ├── Each item claimed (with split indicator)
    │   │   ├── Member subtotal
    │   │   └── Subtotal / Tip / Grand Total
    │   │
    │   ├── Tip slider (host only)
    │   └── "Edit Selections" button → back to ReceiptItemsPage
    │
    ├── 4. Confirm & Pay
    │   ├── api.transactions.setTip(txId, fullTipAmount)
    │   ├── api.transactions.finalize(txId)
    │   │   │
    │   │   ▼  Backend: POST /api/transactions/:id/finalize (FULL_CONTROL)
    │   │   1. Get all group member IDs
    │   │   2. Get receipt items + claims
    │   │   3. For each item:
    │   │      a. Get claimers
    │   │      b. If unclaimed → split evenly among ALL members
    │   │      c. If claimed → split among claimers
    │   │   4. Calculate tip share proportional to each member's subtotal
    │   │   5. Round amounts to cents
    │   │   6. CREATE transaction_allocations
    │   │   7. UPDATE transaction: status = SETTLED
    │   │   8. Return allocations
    │   │
    │   └── Navigate to ProcessingPaymentPage
    │
    └── 5. ProcessingPaymentPage → Success
```

### Item Split Calculation Details

For FULL_CONTROL finalization:

```
For each item:
  claimers = users who selected this item
  if no claimers: split among ALL members
  each claimer's share = item.price / claimers.length

Member subtotal = sum of all their item shares
Tip per member = (member_subtotal / total_subtotal) * tip_amount
Member total = member_subtotal + their_tip_share

Amounts are rounded to cents. Rounding differences go to the first member.
```

---

## 5. Receipt OCR Pipeline

### User Experience

1. User taps "Upload Receipt"
2. Takes a photo or picks from gallery
3. Waits 5-15 seconds
4. Items appear in the split interface

### Technical Flow

```
Frontend uploads file (multipart/form-data)
    │
    ▼  Backend receives file via multer
    │
    ├── Save to server/uploads/{uuid}.jpg
    │
    ├── POST image to TabScanner API
    │   └── https://api.tabscanner.com/api/2/process
    │       Body: form-data with image file
    │       Header: apikey: TABSCANNER_API_KEY
    │
    ├── Wait 5.5 seconds (TabScanner processing time)
    │
    ├── Poll TabScanner result every 1 second (max 25s)
    │   └── GET https://api.tabscanner.com/api/result/{token}
    │       └── Check status === 'done'
    │
    ├── Extract lineItems from result
    │   └── Map to { name, price }
    │       ├── name = descClean || desc
    │       ├── price = lineTotal || price
    │       └── Filter: price > 0, price ≤ 99999, name ≤ 120 chars
    │
    ├── Create receipt record in DB
    ├── Create receipt_items for each extracted item
    ├── Calculate and set subtotal
    │
    └── Return { receipt_id, items, subtotal }
```

### Fallback: Tesseract.js (Not Active)

A standalone `ocr-worker.ts` exists for local Tesseract.js OCR but is **not used** in the current flow. It was replaced by TabScanner for accuracy.

---

## 6. 15-Minute Timeout Fallback

### Purpose

If a transaction is created but not finalized within 15 minutes, the system automatically applies an even split with 0% tip.

### Technical Flow

```
server/src/index.ts — Background timer (every 30 seconds):
    │
    ├── Query: SELECT * FROM transactions
    │          WHERE status = 'PENDING_ALLOCATION'
    │          AND allocation_deadline_at < now()
    │
    ├── For each expired transaction:
    │   └── runFallbackForTransaction(txId)
    │       1. Get group members
    │       2. Calculate even split: total / memberCount
    │       3. Set tip to 0
    │       4. Create allocations
    │       5. Set status = SETTLED
    │
    └── Log: "Ran fallback for transaction {id}"
```

---

## 7. Group Management

### Delete Group (Host Only)

```
GroupDetailPage → More menu → "Delete Group" → Confirmation dialog
    │
    ├── api.groups.deleteGroup(groupId)
    │   │
    │   ▼  Backend: DELETE /api/groups/:groupId
    │   1. Verify user is the creator
    │   2. Cascade delete:
    │      - item_claims (via receipt_items via receipts)
    │      - receipt_items (via receipts)
    │      - receipt_splits (via receipts)
    │      - receipts
    │      - transaction_allocations (via transactions)
    │      - transactions
    │      - virtual_cards
    │      - group_members
    │      - groups
    │   3. Return { ok: true }
    │
    └── Navigate to groups list
```

### Leave Group (Non-Host)

```
GroupDetailPage → More menu → "Leave Group" → Confirmation dialog
    │
    ├── api.groups.leaveGroup(groupId)
    │   │
    │   ▼  Backend: POST /api/groups/:groupId/leave
    │   1. Verify user is NOT the creator
    │   2. DELETE FROM group_members WHERE group_id = ? AND user_id = ?
    │   3. Return { ok: true }
    │
    └── Navigate to groups list
```

### Remove Member (Host Only)

```
GroupDetailPage → Members dropdown → X button on member → Confirmation dialog
    │
    ├── api.groups.removeMember(groupId, memberId)
    │   │
    │   ▼  Backend: DELETE /api/groups/:groupId/members/:memberId
    │   1. Verify user is the creator
    │   2. Verify target is not the creator
    │   3. DELETE FROM group_members
    │   4. Return { ok: true }
    │
    └── Refresh group data
```

---

## 8. Activity / History

### User Experience

1. User taps **"Activity"** tab
2. Sees list of past transactions: group name, date, amount paid, status

### Technical Flow

```
ActivityPage on mount:
    │
    ├── api.transactions.activity()
    │   │
    │   ▼  Backend: GET /api/transactions/activity/me
    │   1. JOIN transaction_allocations + transactions + groups
    │   2. WHERE ta.user_id = current_user
    │   3. ORDER BY t.created_at DESC LIMIT 50
    │   4. Return [{id, transaction_id, amount, group_id, status, 
    │              created_at, settled_at, group_name}]
    │
    └── Display list with relative timestamps
        ├── Tap on item → navigate to groupDetail
        └── Empty state if no history
```

---

## 9. Profile Editing

### User Experience

1. User opens Account page
2. Taps on Name, Email, or Phone field
3. Edit modal opens with current value
4. User types new value and taps Save
5. Field updates immediately

### Technical Flow

```
AccountPage:
    │
    ├── Load profile: api.users.me()
    │
    ├── Tap field → open edit modal
    │   └── Set editField = 'name' | 'email' | 'phone'
    │
    ├── Save:
    │   ├── api.users.updateProfile({ [field]: value })
    │   │   │
    │   │   ▼  Backend: PATCH /api/users/me
    │   │   1. Build SET clause from provided fields
    │   │   2. If email: check uniqueness
    │   │   3. UPDATE users SET ... WHERE id = ?
    │   │   4. Return updated user
    │   │
    │   ├── Update local state
    │   └── Close modal
```

---

## 10. Virtual Wallet

### User Experience

1. User taps wallet icon on home screen
2. Sees list of virtual cards (one per group)
3. Each card shows group name, last 4 digits, group total
4. Can tap to view group details

### Technical Flow

```
VirtualWalletPage on mount:
    │
    ├── api.groups.virtualCards()
    │   │
    │   ▼  Backend: GET /api/groups/virtual-cards/list
    │   1. JOIN virtual_cards + groups + group_members
    │   2. LEFT JOIN to sum completed receipt totals
    │   3. Return [{groupId, groupName, cardLastFour, groupTotal, active: true}]
    │
    └── Display card list with gradient designs
```

> **Note:** Virtual cards are purely cosmetic in MVP. They don't connect to any payment network. Each group auto-generates a random 4-digit card number on creation.
