# Glossary

Quick reference for terms, acronyms, and concepts used throughout the Tabby codebase.

---

## Product Terms

| Term | Definition |
|------|-----------|
| **Group** | A payment session. One group = one bill-splitting event. Created by a host, joined by members. |
| **Host** | The user who created the group. Has elevated permissions (set tip, confirm payment, delete group, remove members). Also referred to as "creator" in code (`created_by`). |
| **Member** | Any user who has joined a group. The host is also a member. |
| **Session** | Synonym for group. A session starts when the group is created and ends when the transaction settles. |
| **Transaction** | The financial record for a group payment. Contains the split mode, amounts, tip, and allocations. |
| **Allocation** | The final amount each member owes after a transaction is finalized. Stored in `transaction_allocations`. |
| **Receipt** | An uploaded image of a bill, processed by OCR to extract line items. |
| **Item** | A single line item from a receipt (e.g., "Burger $15.99"). Stored in `receipt_items`. |
| **Claim** | When a member selects an item they ordered. Multiple members can claim the same item (shared). Stored in `item_claims`. |
| **Split** | The calculated share each member owes. Can be even (equal) or itemized (based on claims). |
| **Settlement** | The moment payment is confirmed and locked. Currently simulated (status set to SETTLED). |
| **Archive** | After settlement, a group becomes historical. Visible in Activity tab but no longer active. |
| **Virtual Card** | A mock card number generated per group. Cosmetic in MVP — not connected to any payment network. |
| **Invite Token** | A 24-character hex string used to generate invite links and QR codes for group joining. |

---

## Split Modes

| Mode | Code Value | Behavior |
|------|-----------|----------|
| **Even Split** | `EVEN_SPLIT` | Total divided equally among all members. Host sets tip. |
| **Item Split / Full Control** | `FULL_CONTROL` | Members claim individual items. Cost split per-item based on claims. Unclaimed items split evenly. Tip allocated proportionally. |

---

## Transaction Statuses

| Status | Code Value | Meaning |
|--------|-----------|---------|
| **Pending** | `PENDING_ALLOCATION` | Transaction is active. Receipt can be uploaded, items claimed, tip set. |
| **Finalized** | `FINALIZED` | Allocations calculated but not yet settled. (Currently unused — goes straight to SETTLED.) |
| **Settled** | `SETTLED` | Payment complete. Allocations are locked. Transaction is done. |

---

## Technical Terms

| Term | Definition |
|------|-----------|
| **JWT** | JSON Web Token. Used for authentication. Contains userId and email, signed with a secret key. |
| **Access Token** | Short-lived JWT (15 min) sent in `Authorization: Bearer` header on every API request. |
| **Refresh Token** | Long-lived JWT (7 days) stored as HTTP-only cookie. Used to get new access tokens. |
| **OCR** | Optical Character Recognition. Converts receipt images to text/data. Tabby uses TabScanner API. |
| **TabScanner** | Third-party API service for receipt OCR. Extracts line items with names and prices. |
| **Multer** | Express middleware for handling `multipart/form-data` (file uploads). |
| **better-sqlite3** | Node.js SQLite driver. Provides synchronous, fast access to SQLite databases. |
| **bcryptjs** | Password hashing library. Uses salt rounds (10) to securely hash passwords. |
| **Vite** | Frontend build tool. Provides fast dev server with hot module replacement (HMR). |
| **SWC** | Speedy Web Compiler. Vite plugin for fast TypeScript/JSX compilation. |
| **Framer Motion** | React animation library. Used for modals, dropdowns, and page transitions. |
| **Tailwind CSS** | Utility-first CSS framework. Classes like `bg-blue-500 text-white px-4 py-2`. |
| **shadcn/ui** | Component library (Radix UI + Tailwind). Provides base UI primitives in `src/components/ui/`. |
| **Persistent Tab** | A page component that stays mounted in the DOM and is shown/hidden via CSS. Prevents remount costs. |
| **PageState** | The navigation state object in `App.tsx` that determines which page to show and with what params. |
| **Fallback** | Automatic even-split applied when a transaction's 15-minute deadline expires without confirmation. |

---

## Acronyms

| Acronym | Full Form |
|---------|-----------|
| **API** | Application Programming Interface |
| **CORS** | Cross-Origin Resource Sharing |
| **CRUD** | Create, Read, Update, Delete |
| **DB** | Database |
| **HMR** | Hot Module Replacement |
| **HTTP** | HyperText Transfer Protocol |
| **JWT** | JSON Web Token |
| **MVP** | Minimum Viable Product |
| **OCR** | Optical Character Recognition |
| **OTP** | One-Time Password |
| **PK** | Primary Key |
| **REST** | Representational State Transfer |
| **SHA** | Secure Hash Algorithm |
| **SPA** | Single Page Application |
| **SQL** | Structured Query Language |
| **SSL** | Secure Sockets Layer |
| **UUID** | Universally Unique Identifier |

---

## Code Identifiers

Common variable names and what they represent:

| Variable | Found In | Meaning |
|----------|----------|---------|
| `isDark` | Frontend components | `theme === 'dark'` boolean |
| `isCreator` | GroupDetailPage, backend | Current user is the group host |
| `activeTx` | GroupDetailPage | The active `PENDING_ALLOCATION` transaction |
| `evenTx` | GroupDetailPage | Active transaction with `split_mode = 'EVEN_SPLIT'` |
| `fullTx` | GroupDetailPage | Active transaction with `split_mode = 'FULL_CONTROL'` |
| `fullTxDetails` | GroupDetailPage | Detailed transaction data (items, claims, members) for breakdown |
| `pageState` | App.tsx | Current navigation state (page + params) |
| `onNavigate` | All page components | Callback to change page |
| `requireAuth` | Backend middleware | Express middleware requiring valid JWT |
| `requireBankLinked` | Backend middleware | Express middleware requiring `bank_linked = 1` |
| `ensureCreator` | Backend routes | Helper that throws if user isn't the transaction creator |
| `ensureMember` | Backend routes | Helper that throws if user isn't a group member |
