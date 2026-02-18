# Bugs & Features — Implementation Plan

## Bugs to Fix

| # | Issue | Status |
|---|-------|--------|
| 1 | No phone signup/login option in UI | Done |
| 2 | Invite doesn't work in groups | Pending (join link exists; may need URL routing for /join/:token) |
| 3 | Virtual card on home: fake data, shows to users with no groups | Done |
| 4 | CardDetailsPage: all fake data (transactions, members, balance) | Done |
| 5 | TabScanner API key not set error | Done (graceful message: use Manual Entry) |
| 6 | Manual entry: can't add items (no receipt created for manual flow) | Done |

## Features to Add

| # | Feature | Status |
|---|---------|--------|
| 7 | Post-purchase: view-only page, show who paid what, no add receipt | Pending |
| 8 | After 15min: group archived to recent | Pending |
| 9 | Group unique identifier for support (multiple lookup methods, secure) | Pending |
| 10 | Profile photo upload (persisted, shows in groups) | Pending |

## Completed Changes

- **LoginSignup**: Email/Phone tab; phone flow: enter number → Send Code → enter OTP → Verify
- **TabScanner**: When API key not set, returns friendly error suggesting Manual Entry
- **LandingPage**: Active Card hidden when user has no groups; uses real card data
- **CardDetailsPage**: Accepts groupId, fetches real group data (name, card, balance, members)
- **Manual entry**: POST /receipts (create empty receipt) + frontend creates receipt before navigating to ReceiptItemsPage
