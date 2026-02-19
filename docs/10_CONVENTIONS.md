# Coding Conventions & Standards

## Project Conventions

### Naming

| Entity | Convention | Example |
|--------|-----------|---------|
| React components | PascalCase | `GroupDetailPage` |
| Component files | PascalCase.tsx | `GroupDetailPage.tsx` |
| Utility files | camelCase.ts | `api.ts` |
| CSS classes | Tailwind utilities | `bg-slate-800 text-white` |
| Database tables | snake_case | `group_members` |
| Database columns | snake_case | `created_at`, `user_id` |
| API routes | kebab-case | `/api/groups/virtual-cards/list` |
| API request body | camelCase | `{ splitMode, tipAmount }` |
| API response | snake_case | `{ tip_amount, created_at }` |
| State variables | camelCase | `activeTx`, `fullTxDetails` |
| Constants | UPPER_SNAKE | `PENDING_ALLOCATION`, `MAX_VISIBLE_AVATARS` |
| TypeScript types | PascalCase | `PageType`, `SplitMode` |

> **Note:** API request/response casing is inconsistent (mix of camelCase and snake_case). This is a known tech debt. Future work should standardize on one convention with a serialization layer.

### File Organization

```
# Frontend component pattern:
src/components/
├── MyPage.tsx          # Full page component
├── MyComponent.tsx     # Reusable component
├── ui/                 # Generic UI primitives (shadcn/ui)
└── figma/              # Figma import helpers

# Backend route pattern:
server/src/routes/
├── auth.ts             # /api/auth/*
├── users.ts            # /api/users/*
├── groups.ts           # /api/groups/*
├── receipts.ts         # /api/receipts/*
└── transactions.ts     # /api/transactions/*
```

### Component Structure

Every page component follows this order:

```tsx
// 1. Imports
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

// 2. Types/Interfaces
interface MyPageProps { ... }
type LocalType = { ... };

// 3. Constants
const MAX_ITEMS = 10;

// 4. Component
export function MyPage({ onNavigate, theme }: MyPageProps) {
  // 5. Theme
  const isDark = theme === 'dark';
  
  // 6. Auth
  const { user } = useAuth();
  
  // 7. State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 8. Effects
  useEffect(() => { ... }, []);
  
  // 9. Derived values
  const isCreator = data?.created_by === user?.id;
  
  // 10. Event handlers
  const handleSubmit = async () => { ... };
  
  // 11. Error state
  if (error) return <ErrorView />;
  
  // 12. Loading state
  if (loading) return <LoadingView />;
  
  // 13. Render
  return ( ... );
}
```

### Backend Route Structure

```typescript
// 1. Imports
import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

// 2. Router
export const myRouter = Router();

// 3. Helper functions
function myHelper() { ... }

// 4. Routes (GET before POST before PUT before DELETE)
myRouter.get('/', requireAuth, (req, res) => { ... });
myRouter.post('/', requireAuth, (req, res) => { ... });
```

---

## TypeScript Guidelines

### Strict Mode

TypeScript strict mode is enabled. Key rules:

- No implicit `any` — always type function parameters
- No unused variables — remove or prefix with `_`
- Null checks required — use optional chaining (`?.`) and nullish coalescing (`??`)

### Type Patterns Used

```typescript
// Props interfaces
interface PageProps {
  groupId: string;
  onNavigate: (target: PageType | PageState) => void;
  theme: 'light' | 'dark';
}

// Union types for states
type SplitMode = 'EVEN_SPLIT' | 'FULL_CONTROL';
type ConfirmAction = 'delete' | 'leave' | 'remove' | null;

// API response types are inline in api.ts
request<{ id: string; name: string }>('/endpoint')

// Backend uses `as any` for DB results (tech debt)
const row = db.prepare('SELECT ...').get(id) as any;
```

### Known Tech Debt

- Backend DB queries use `as any` casting instead of proper types
- Some frontend state types are inline and complex (should be extracted)
- API response types between frontend and backend are not shared

---

## Styling Guidelines

### Tailwind CSS

- Use utility classes exclusively — no custom CSS files for components
- Dark mode: conditional classes via `isDark` boolean, not Tailwind's `dark:` prefix
- Consistent spacing: use Tailwind scale (`p-4`, `gap-3`, `mb-2`)

### Color Usage

```
Primary action:     bg-blue-500 (buttons, links)
Gradient actions:   from-purple-600 to-indigo-600 (confirm, upload)
Destructive:        bg-red-500, text-red-400
Success:            bg-green-500, text-green-400
Warning:            text-amber-500, text-orange-500

Light backgrounds:  bg-[#F2F2F7] (iOS system gray)
Dark backgrounds:   bg-slate-900
Card light:         bg-white
Card dark:          bg-slate-800
```

### Animation Rules

- **DO** animate: modals, dropdowns, page transitions, interactive feedback
- **DON'T** animate: headers, static content, list items on mount
- Use `active:scale-95` (CSS) for button press feedback
- Use Framer Motion springs for modals: `type: 'spring', damping: 25-30`
- Keep animation durations under 300ms for micro-interactions

### Responsive Design

The app is designed as a **fixed mobile viewport** (max-width ~430px). It renders inside a phone frame. No responsive breakpoints are needed.

---

## Git Conventions

### Branch Naming

```
<username>/<feature-name>
```

Examples:
- `hmachhi/mvp`
- `jdoe/receipt-ocr-fix`
- `asmith/add-stripe-integration`

### Commit Messages

Use imperative mood, present tense:

```
Good:
- "Add invite system with QR codes"
- "Fix even split rounding error"
- "Refactor item split flow to show breakdown on group page"

Bad:
- "Added invite system"
- "Fixed bug"
- "WIP"
```

For larger commits, use a summary + body:

```
Refactor item split flow: confirm selections then review on group page

- ReceiptItemsPage now shows "Confirm Selections" and navigates back
- GroupDetailPage shows full itemized breakdown per member
- Host can adjust tip and hit "Confirm & Pay" from group page
```

### What Not to Commit

These should be in `.gitignore`:

```
node_modules/
server/node_modules/
build/
server/dist/
server/.env
server/uploads/*.jpg
server/uploads/*.png
```

---

## API Design Conventions

### Route Naming

- Use plural nouns: `/groups`, `/receipts`, `/transactions`
- Nest related resources: `/groups/:id/members/:memberId`
- Use verbs for actions: `/groups/:id/leave`, `/transactions/:id/finalize`

### HTTP Methods

| Method | Usage |
|--------|-------|
| `GET` | Read data |
| `POST` | Create resource or perform action |
| `PUT` | Update/replace a field |
| `PATCH` | Partial update |
| `DELETE` | Remove resource |

### Error Responses

All errors return:
```json
{ "error": "Human-readable message" }
```

Status codes:
- `400` — Bad request (missing/invalid params)
- `401` — Not authenticated
- `403` — Not authorized (bank not linked, not the creator)
- `404` — Resource not found
- `409` — Conflict (duplicate email)
- `500` — Internal server error

### Authorization Checks

Every endpoint that accesses group data must verify:
1. User is authenticated (`requireAuth`)
2. User is a member of the group (explicit query)
3. User has the required role (creator check for mutations)

---

## Testing (Future)

Currently there are no automated tests. When adding tests:

### Recommended Stack

| Type | Tool | Purpose |
|------|------|---------|
| Unit tests | Vitest | Frontend utilities, API client |
| Component tests | React Testing Library | Component rendering |
| API tests | Supertest | Backend endpoint testing |
| E2E tests | Playwright | Full user flow testing |

### What to Test First

1. Transaction finalization logic (split calculations)
2. Auth flow (token refresh, logout)
3. OCR result parsing
4. Group membership checks
5. Critical UI flows (create group, split payment)

---

## Performance Conventions

### Frontend

- Keep persistent tabs mounted (Home, Groups, Activity)
- Avoid Framer Motion on static/header content
- Use `WebkitOverflowScrolling: 'touch'` on scrollable containers
- Minimize `backdrop-blur` and heavy shadows
- Use `active:scale-95` instead of Framer Motion for button feedback

### Backend

- Use parameterized queries for all DB access ($1, $2, …)
- Database operations are async (PostgreSQL via pg) — use query() and withTransaction()
- File cleanup: delete uploaded images on OCR failure
- Limit query results (LIMIT 50 for activity/splits)
