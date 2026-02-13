# Tabby — Project Overview

## What is Tabby?

Tabby is a **real-time group payment splitting app**. It solves the problem of splitting bills at restaurants, bars, outings, activities, and travel — so that money is handled **in the moment**, not chased down later.

The core philosophy: **Groups pay together once, split instantly, and leave with payment completed.** No one sends money later. No Venmo requests. No "I'll get you back." Payment happens inside Tabby.

## Product Concept

A **group session** in Tabby is equivalent to **one transaction session**. The lifecycle is:

1. A user creates a group (e.g., "Dinner at Nobu").
2. Members join via invite link or QR code.
3. A receipt is uploaded (OCR extracts items).
4. Members claim their items — or the host picks "Even Split."
5. The host sets a tip and confirms payment.
6. Tabby simulates charges for everyone.
7. The transaction settles. The group archives to history.

There are **no persistent wallets, no running balances, and no reimbursement flows**. Each group = one payment event.

## Current State

Tabby is an **MVP (Minimum Viable Product)** with simulated settlement. Real payment processing (Stripe, Plaid) is not yet integrated. The app demonstrates the full user flow with:

- Simulated bank linking
- Virtual card generation (mock)
- OCR-powered receipt scanning (via TabScanner API)
- Real-time item splitting
- Simulated payment settlement

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript | UI components and state management |
| **Build Tool** | Vite 6 + SWC | Fast development server and production builds |
| **Styling** | Tailwind CSS v4 | Utility-first CSS framework |
| **Animations** | Framer Motion | Smooth transitions and micro-interactions |
| **Icons** | Lucide React | Consistent icon set |
| **Backend** | Node.js + Express | REST API server |
| **Database** | SQLite (better-sqlite3) | Embedded relational database |
| **Auth** | JWT (jsonwebtoken) | Access + refresh token authentication |
| **File Upload** | Multer | Multipart form handling |
| **OCR** | TabScanner API | Receipt text extraction |
| **Password Hashing** | bcryptjs | Secure password storage |
| **QR Codes** | qrcode.react | Invite QR code generation |

## Repository Structure

```
Tabby/
├── docs/                          # Documentation (you are here)
├── data/
│   └── tabby.db                   # SQLite database file (auto-created)
├── server/                        # Backend API
│   ├── src/
│   │   ├── index.ts               # Express server entry point
│   │   ├── db.ts                  # Database schema and migrations
│   │   ├── ocr.ts                 # TabScanner OCR integration
│   │   ├── ocr-worker.ts          # Tesseract.js fallback (standalone)
│   │   ├── seed.ts                # Database seeding script
│   │   ├── middleware/
│   │   │   └── auth.ts            # JWT auth middleware
│   │   └── routes/
│   │       ├── auth.ts            # Login, signup, refresh, logout
│   │       ├── users.ts           # Profile, bank linking, payment methods
│   │       ├── groups.ts          # Group CRUD, invites, virtual cards, transactions
│   │       ├── receipts.ts        # Receipt upload, items, claims, splits
│   │       └── transactions.ts    # Transaction lifecycle, finalization, settlement
│   ├── package.json
│   └── tsconfig.json
├── src/                           # Frontend React app
│   ├── main.tsx                   # App entry point
│   ├── App.tsx                    # Router and page manager
│   ├── index.css                  # Tailwind CSS styles
│   ├── styles/
│   │   └── globals.css            # CSS custom properties
│   ├── contexts/
│   │   └── AuthContext.tsx         # Authentication state provider
│   ├── lib/
│   │   └── api.ts                 # API client (all HTTP calls)
│   └── components/
│       ├── SplashScreen.tsx        # App launch animation
│       ├── LandingPage.tsx         # Home screen
│       ├── LoginSignup.tsx         # Auth forms
│       ├── LinkBankPage.tsx        # Bank linking (stub)
│       ├── GroupsPage.tsx          # Groups list
│       ├── GroupDetailPage.tsx     # Group session (core page)
│       ├── CreateGroupPage.tsx     # Create new group
│       ├── CreateExpensePage.tsx   # Quick actions menu
│       ├── ReceiptScanPage.tsx     # Receipt upload
│       ├── ReceiptItemsPage.tsx    # Item claiming interface
│       ├── ProcessingPaymentPage.tsx # Payment animation
│       ├── ActivityPage.tsx        # Transaction history
│       ├── AccountPage.tsx         # User profile editing
│       ├── VirtualWalletPage.tsx   # Virtual cards list
│       ├── CardDetailsPage.tsx     # Card details (placeholder)
│       ├── SettingsPage.tsx        # App settings
│       ├── TransactionAllocationPage.tsx # Even split allocation
│       ├── ProfileSheet.tsx        # Bottom sheet menu
│       ├── TabbyCatLogo.tsx        # App logo SVG
│       ├── ErrorBoundary.tsx       # React error boundary
│       ├── figma/                  # Figma import helpers
│       └── ui/                    # shadcn/ui base components
├── package.json                   # Frontend dependencies
└── vite.config.ts                 # Vite configuration
```

## Key Design Decisions

1. **SQLite over Postgres/MySQL** — For MVP simplicity. Single file, zero config, synchronous reads. Will migrate to Postgres when scaling.
2. **No real payments** — Settlement is simulated. The `SETTLED` status is written immediately on finalize. Real Stripe/Plaid integration is a future phase.
3. **No React Router** — Navigation is managed via a custom `pageState` in `App.tsx`. Pages are rendered conditionally. Persistent tabs (Home, Groups, Activity) stay mounted for performance.
4. **Mobile-first design** — The app renders inside a phone-shaped frame. All UI targets touch interactions (tap, swipe, bottom sheets).
5. **TabScanner for OCR** — Tesseract.js was too inaccurate for receipts. TabScanner provides a cloud API with better line-item extraction. A Tesseract fallback script exists but is unused.

## Team Roles (Expected)

| Role | Responsibility |
|------|---------------|
| **Frontend** | React components, state management, UI/UX |
| **Backend** | Express routes, database schema, API design |
| **Design** | Figma mockups, design system, UX flows |
| **DevOps** | Deployment, CI/CD, environment management |
| **Product** | Feature specs, user stories, prioritization |
