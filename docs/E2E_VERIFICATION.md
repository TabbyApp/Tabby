# End-to-end verification (backend + frontend)

Quick checklist to confirm all wired flows work after the Figma sync and backend integration.

## Setup

1. **Backend** (from repo root):
   ```bash
   cd server && npm install && npm run dev
   ```
   Server runs at `http://localhost:3001`. Uses SQLite (no extra DB setup if using default).

2. **Frontend** (from repo root):
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:3000`. Vite proxies `/api` to `http://localhost:3001`, so no `VITE_API_URL` needed in dev.

3. **Optional**: Seed DB with test user/groups:
   ```bash
   cd server && npm run seed
   ```
   (If you have a seed script; otherwise sign up manually.)

---

## Flows to verify

### Auth
- [ ] **Sign up**: Name + email + password → creates user, stores token, redirects into app (home).
- [ ] **Log in**: Email + password → token stored, user in context, home shows.
- [ ] **Log out**: Settings → Log out → token cleared, back to login screen.
- [ ] **Persistence**: Refresh page while logged in → still logged in (token in localStorage + optional refresh cookie).

### Dashboard
- [ ] **Home after login**: Groups and pending invites load from `GET /api/users/me/dashboard` (no mock data).
- [ ] **Empty state**: New user sees empty groups and no pending invites.

### Groups
- [ ] **Create group**: Create Group → name + optional member emails → `POST /api/groups` then `POST /api/groups/:id/invites` per email; new group appears in list.
- [ ] **Delete group**: Group detail (or list) → delete (creator only) → `DELETE /api/groups/:id` → group removed; UI refetches.
- [ ] **Leave group**: Group detail → leave (non-creator) → `POST /api/groups/:id/leave` → group removed from list; UI refetches.

### Invites
- [ ] **Pending list**: Pending invites on home come from dashboard `pendingInvites` (tokens from API).
- [ ] **Accept from list**: Click Accept on a pending invite → navigate to Accept Invite page with token → Accept → `POST /api/invites/:token/accept` → join group, redirect to group detail; dashboard refetches.
- [ ] **Decline from list**: Click Decline → `DELETE /api/invites/:token` → invite removed; list refetches.
- [ ] **Accept from link**: Open `http://localhost:3000?invite=TOKEN` (or `?token=TOKEN`) while logged in → Accept Invite page with that token → Accept/Decline works.
- [ ] **Payment method required**: Accept invite without a payment method → backend returns `403` with `code: 'PAYMENT_METHOD_REQUIRED'` → frontend redirects to account (or shows error).

### IDs and types
- [ ] All group IDs are strings (UUIDs) from API; no numeric group IDs in API responses.
- [ ] Invite actions use `token` (string), not numeric invite id.

### Error handling
- [ ] Wrong login → error message on LoginSignup.
- [ ] Delete/leave fails (e.g. network) → UI refetches dashboard so list is correct again.
- [ ] Backend down → frontend shows a “Cannot reach server”–style message when calling API.

---

## API alignment (reference)

| Frontend call              | Backend route                          | Auth   |
|---------------------------|----------------------------------------|--------|
| `api.auth.signup`         | `POST /api/auth/signup`                | No     |
| `api.auth.login`          | `POST /api/auth/login`                 | No     |
| `api.auth.logout`         | `POST /api/auth/logout`                | Yes    |
| `api.users.me`            | `GET /api/users/me`                    | Yes    |
| `api.users.dashboard`     | `GET /api/users/me/dashboard`         | Yes    |
| `api.invites.getByToken` | `GET /api/invites/:token`             | No     |
| `api.invites.accept`      | `POST /api/invites/:token/accept`     | Yes    |
| `api.invites.decline`     | `DELETE /api/invites/:token`          | Yes    |
| `api.groups.create`       | `POST /api/groups`                    | Yes    |
| `api.groups.createInvite` | `POST /api/groups/:groupId/invites`   | Yes    |
| `api.groups.delete`      | `DELETE /api/groups/:groupId`         | Yes    |
| `api.groups.leave`        | `POST /api/groups/:groupId/leave`     | Yes    |

Dashboard response includes `groups[].createdBy`; invite accept response includes `id` (group id), `name`, `members`, `cardLastFour` for navigation and UI.
