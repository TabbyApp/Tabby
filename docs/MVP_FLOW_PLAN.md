# MVP Flow Plan

## Flow Map

```
LoginSignup → LandingPage (home)
     ↓
  [Guard: !bank_linked → LinkBankPage (stub)]
     ↓
LandingPage ↔ GroupsPage ↔ CreateGroupPage
     ↓
GroupDetailPage (groupId)
     ↓ [Creator taps "Pay"]
  Choose split mode: EVEN_SPLIT | FULL_CONTROL
     ↓
  EVEN_SPLIT: TransactionAllocationPage (tip slider, confirm) → ProcessingPaymentPage
  FULL_CONTROL: ReceiptScanPage → ReceiptItemsPage (claims, tip, confirm) → ProcessingPaymentPage
     ↓
  ProcessingPaymentPage (settlement simulated) → GroupDetail or Activity
     ↓
  [Timer expires] → Backend fallback-even → settle
     ↓
  [After settle] → archived, show in ActivityPage (History)
```

## Page State Schema

```ts
type PageType =
  | 'home' | 'groups' | 'groupDetail' | 'activity' | 'create' | 'account' | 'settings'
  | 'wallet' | 'cardDetails' | 'createGroup' | 'linkBank'
  | 'receiptScan' | 'receiptItems' | 'processing' | 'transactionAllocation';

type PageState = {
  page: PageType;
  groupId?: string;
  transactionId?: string;
  receiptId?: string;
  splits?: { user_id: string; amount: number; name: string }[];
};
```

## Key Transitions

| From | To | Required IDs |
|------|-----|--------------|
| home | groupDetail | groupId |
| groupDetail | receiptScan | groupId, transactionId (FULL_CONTROL) |
| groupDetail | transactionAllocation | groupId, transactionId (EVEN_SPLIT) |
| receiptScan | receiptItems | groupId, transactionId, receiptId |
| receiptItems | processing | groupId, transactionId, splits |
| transactionAllocation | processing | groupId, transactionId, splits |
| processing | groupDetail | groupId |

## Assumptions

1. **Auth**: Email/password only for MVP (phone OTP deferred).
2. **Bank linking**: Stub: `POST /users/link-bank` sets `bank_linked=true`; `/me` returns `bank_linked`.
3. **Invites**: Current behavior: add members by email at group creation. No separate invite/accept flow for MVP.
4. **Unclaimed items**: Option 2 — auto-split unclaimed items evenly among all group members.
5. **Archive**: Set `archived_at` when transaction status becomes SETTLED (immediate for MVP).
6. **CreateExpensePage**: Redirect "Upload Receipt" to group selector → groupDetail; or remove and only allow Pay from GroupDetail. We keep FAB → create, but "Upload Receipt" requires group — simplified: CreateExpensePage only offers "Create Group"; Pay/Upload only from GroupDetail.
