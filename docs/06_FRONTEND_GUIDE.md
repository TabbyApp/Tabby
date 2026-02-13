# Frontend Guide

## Overview

The Tabby frontend is a React 18 single-page application built with Vite and TypeScript. It renders as a **mobile app simulation** inside a phone-shaped frame in the browser.

## Project Structure

```
src/
├── main.tsx                    # Entry point — renders AuthProvider → App
├── App.tsx                     # Page router, theme, auth flow, navigation
├── index.css                   # Tailwind CSS v4 compiled styles
├── styles/
│   └── globals.css             # CSS custom properties
├── contexts/
│   └── AuthContext.tsx          # Global auth state (user, login, logout)
├── lib/
│   └── api.ts                  # Centralized API client
└── components/
    ├── [Page components]       # Full-screen page views
    ├── figma/                  # Figma import helpers
    └── ui/                     # shadcn/ui primitives
```

## Page Components Reference

| Component | Route/Page Key | Purpose | Persistent? |
|-----------|---------------|---------|-------------|
| `SplashScreen` | (initial) | App launch animation | No |
| `LandingPage` | `home` | Main home screen | **Yes** |
| `LoginSignup` | (auth) | Login / signup forms | No |
| `LinkBankPage` | `link_bank` | Bank linking stub | No |
| `GroupsPage` | `groups` | Groups list with search | **Yes** |
| `GroupDetailPage` | `groupDetail` | Core group session page | No |
| `CreateGroupPage` | `createGroup` | New group form | No |
| `CreateExpensePage` | `create` | Quick actions menu | No |
| `ReceiptScanPage` | `receiptScan` | Receipt upload camera | No |
| `ReceiptItemsPage` | `receiptItems` | Item claiming interface | No |
| `ProcessingPaymentPage` | `processing` | Settlement animation | No |
| `TransactionAllocationPage` | `transactionAllocation` | Even split confirm | No |
| `ActivityPage` | `activity` | Transaction history | **Yes** |
| `AccountPage` | `account` | Profile editing | No |
| `VirtualWalletPage` | `wallet` | Virtual cards list | No |
| `CardDetailsPage` | `cardDetails` | Card info (placeholder) | No |
| `SettingsPage` | `settings` | App settings & theme | No |

## Navigation System

### How It Works

There is **no React Router**. Navigation is managed by `App.tsx` through a state object:

```typescript
type PageType = 'home' | 'groups' | 'activity' | 'create' | 'createGroup' | 
  'account' | 'settings' | 'wallet' | 'cardDetails' | 'link_bank';

type PageState = {
  page: PageType | 'groupDetail' | 'receiptScan' | 'receiptItems' | 
    'processing' | 'transactionAllocation';
  groupId?: string;
  transactionId?: string;
  receiptId?: string;
  splits?: { user_id: string; amount: number; name: string }[];
};
```

### Navigating Between Pages

Every page receives an `onNavigate` prop:

```typescript
// Navigate to a simple page
onNavigate('groups');

// Navigate with parameters
onNavigate({ page: 'groupDetail', groupId: 'abc123' });

// Navigate with multiple parameters
onNavigate({ 
  page: 'receiptItems', 
  groupId: 'abc', 
  transactionId: 'tx1', 
  receiptId: 'r1' 
});
```

### Persistent vs. Non-Persistent Pages

Three tabs stay **permanently mounted** to avoid expensive remounts:

```typescript
const PERSISTENT_TABS = ['home', 'groups', 'activity'];
```

These are shown/hidden via CSS:
```tsx
<div style={{ display: currentPage === 'home' ? 'contents' : 'none' }}>
  <LandingPage ... />
</div>
```

All other pages mount/unmount on navigation.

## Component Patterns

### Standard Page Structure

Every page follows this pattern:

```tsx
interface MyPageProps {
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
  // Page-specific props (groupId, etc.)
}

export function MyPage({ onNavigate, theme }: MyPageProps) {
  const isDark = theme === 'dark';
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load data on mount
    api.someEndpoint()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (error) return <ErrorView />;
  if (loading) return <LoadingView />;

  return (
    <div className={`h-[calc(100vh-48px-24px)] flex flex-col ${isDark ? 'bg-slate-900' : 'bg-[#F2F2F7]'}`}>
      {/* Header */}
      {/* Content */}
    </div>
  );
}
```

### Height Calculation

Pages use `h-[calc(100vh-48px-24px)]` to account for:
- **48px** — iOS-style status bar at the top
- **24px** — Home indicator at the bottom

### Dark Mode

Every component receives `theme: 'light' | 'dark'` and uses a boolean:

```tsx
const isDark = theme === 'dark';
// Then conditionally apply classes:
className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}
```

Theme is controlled from `SettingsPage` and stored in `App.tsx` state.

### Error Handling

Pages display inline error states with retry:

```tsx
if (error) {
  return (
    <div className="...">
      <p>{error}</p>
      <button onClick={retry}>Retry</button>
      <button onClick={() => onNavigate('home')}>Go back</button>
    </div>
  );
}
```

## State Management

### AuthContext

Global authentication state provided via React Context:

```tsx
const { user, loading, login, signup, logout, setUser } = useAuth();
```

| Property | Type | Purpose |
|----------|------|---------|
| `user` | `User \| null` | Current authenticated user |
| `loading` | `boolean` | True during initial auth check |
| `login(email, password)` | `Promise<void>` | Log in |
| `signup(email, password, name)` | `Promise<void>` | Create account |
| `logout()` | `Promise<void>` | Log out |
| `setUser(u)` | `function` | Manually update user state |

### API Client

All API calls go through `src/lib/api.ts`:

```typescript
import { api } from '../lib/api';

// Examples:
const groups = await api.groups.list();
const group = await api.groups.get(groupId);
await api.transactions.setTip(txId, 5.00);
const { allocations } = await api.transactions.finalize(txId);
```

The client handles:
- JWT token attachment
- Automatic token refresh on 401
- User-friendly error messages
- Network error detection

## Key UI Components

### Bottom Sheet Pattern (Invite, Profile)

Used for modals that slide up from the bottom:

```tsx
<AnimatePresence>
  {isOpen && (
    <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={close}>
      <motion.div className="absolute inset-0 bg-black/40" />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="relative z-50 w-full max-w-[430px] rounded-t-[24px] ..."
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content */}
      </motion.div>
    </div>
  )}
</AnimatePresence>
```

### Dropdown Pattern (Members, Menu)

Used for floating menus:

```tsx
<div className="relative">
  <button onClick={() => setOpen(!open)}>Trigger</button>
  <AnimatePresence>
    {open && (
      <>
        <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          className="absolute top-12 left-0 z-30 ..."
        >
          {/* Menu items */}
        </motion.div>
      </>
    )}
  </AnimatePresence>
</div>
```

### Confirmation Dialog Pattern

Used for destructive actions:

```tsx
{confirmAction && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/40" />
    <motion.div className="relative z-50 w-[calc(100%-2rem)] max-w-[340px] rounded-2xl p-6 ...">
      <Icon />
      <h3>Are you sure?</h3>
      <p>This action cannot be undone.</p>
      <div className="flex gap-3">
        <button onClick={cancel}>Cancel</button>
        <button onClick={confirm}>Confirm</button>
      </div>
    </motion.div>
  </div>
)}
```

## Animations

Tabby uses **Framer Motion** (`motion/react`) for animations. Key patterns:

| Animation | Usage | Config |
|-----------|-------|--------|
| Spring modal | Bottom sheets | `type: 'spring', damping: 30, stiffness: 350` |
| Spring dropdown | Menus | `type: 'spring', damping: 25, stiffness: 400` |
| Page transition | Split mode switch | `opacity + x offset` |
| Scale feedback | Buttons | `active:scale-95` (CSS, not Framer) |

> **Performance Note:** Heavy Framer Motion usage was reduced in the optimization pass. Headers and list items no longer animate on mount. Only interactive elements (modals, dropdowns, page transitions) use motion.

## Styling Conventions

### Tailwind CSS v4

- Utility-first approach
- No custom component CSS files
- Dark mode via conditional classes (not Tailwind dark: prefix)

### Common Color Palette

| Element | Light | Dark |
|---------|-------|------|
| Background | `bg-[#F2F2F7]` | `bg-slate-900` |
| Card | `bg-white` | `bg-slate-800` |
| Primary text | `text-slate-800` | `text-white` |
| Secondary text | `text-slate-500` | `text-slate-400` |
| Primary button | `bg-blue-500` | `bg-blue-500` |
| Action gradient | `from-purple-600 to-indigo-600` | Same |
| Borders | `border-gray-200` | `border-slate-700` |

### Font Stack

Uses the system font stack via Tailwind defaults (SF Pro on iOS/macOS, Roboto on Android).

## File Upload Flow

Receipt uploads use `FormData` (not JSON):

```typescript
// In api.ts — special handling for file uploads
const formData = new FormData();
formData.append('file', file);
const token = getAccessToken();
return fetch(`${API_BASE}/transactions/${id}/receipt`, {
  method: 'POST',
  headers: token ? { Authorization: `Bearer ${token}` } : {},
  body: formData,  // No Content-Type header — browser sets multipart boundary
});
```

## Invite Link Handling

When the app loads, it checks for `?invite=TOKEN` in the URL:

1. `App.tsx` reads `window.location.search` for the invite token
2. If user is not authenticated, token is saved to `sessionStorage`
3. After login + bank linking, the token is retrieved
4. `api.groups.joinByToken(token)` is called
5. User is navigated to the joined group

## Adding a New Page

1. Create `src/components/MyNewPage.tsx`
2. Add the page type to `PageType` or `PageState` in `App.tsx`
3. Add rendering logic in the `App` component's JSX
4. Pass `onNavigate` and `theme` as props
5. Add navigation from other pages using `onNavigate({ page: 'myNew', ... })`
