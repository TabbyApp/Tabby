# Authentication Flow

## Overview

Tabby uses a **JWT-based authentication** system with short-lived access tokens and long-lived refresh tokens. This is a standard pattern for SPAs (Single Page Applications).

## Token Types

| Token | Lifetime | Storage | Purpose |
|-------|----------|---------|---------|
| **Access Token** | 15 minutes | `localStorage` | Authenticate API requests |
| **Refresh Token** | 7 days | HTTP-only cookie + DB hash | Get new access tokens |

## Signup Flow

```
┌─────────┐     POST /api/auth/signup     ┌─────────┐
│ Frontend │ ─────────────────────────────→ │ Backend │
│          │  { email, password, name }    │         │
│          │                               │         │
│          │  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │         │
│          │  { accessToken, user }        │         │
│          │  + Set-Cookie: refreshToken   │         │
└─────────┘                               └─────────┘

Backend steps:
1. Validate email, password (≥6 chars), name
2. Check email uniqueness (lowercase)
3. Hash password with bcryptjs (10 rounds)
4. Insert into `users` table
5. Generate access token (JWT, 15min)
6. Generate refresh token (JWT, 7d)
7. Hash refresh token (SHA-256) and store in `refresh_tokens` table
8. Set refreshToken as HTTP-only cookie
9. Return accessToken + user object

Frontend steps:
1. Store accessToken in localStorage via setAccessToken()
2. Update AuthContext user state
3. Users can link their bank from the Account page
```

## Login Flow

```
┌─────────┐     POST /api/auth/login      ┌─────────┐
│ Frontend │ ─────────────────────────────→ │ Backend │
│          │  { email, password }           │         │
│          │                               │         │
│          │  ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │         │
│          │  { accessToken, user }        │         │
│          │  + Set-Cookie: refreshToken   │         │
└─────────┘                               └─────────┘

Backend steps:
1. Find user by email (lowercase)
2. Compare password hash with bcryptjs
3. Generate and return tokens (same as signup)
```

## App Initialization (Page Load)

```
App mounts
    │
    ▼
AuthContext checks localStorage
    │
    ├── No token → loading = false, user = null → Show LoginSignup
    │
    └── Token exists
        │
        ▼
    GET /api/users/me (with Bearer token)
        │
        ├── 200 OK → Set user, loading = false → Show App
        │
        └── 401 Unauthorized
            │
            ▼
        POST /api/auth/refresh (cookie-based)
            │
            ├── 200 OK → New accessToken → Retry /users/me
            │
            └── 401 → Clear tokens → Show LoginSignup
```

## Token Refresh Flow

When any API call returns 401:

```
api.ts request() function:
    │
    ├── Send request with Bearer token
    │
    ├── Response: 401
    │   │
    │   ▼
    │   POST /api/auth/refresh
    │   (sends refreshToken cookie automatically)
    │   │
    │   ├── 200 → Store new accessToken → Retry original request
    │   │
    │   └── 401 → Refresh token expired/invalid → Clear all tokens
    │
    └── Response: 200+ → Return data normally
```

### Backend Refresh Logic

```
1. Read refreshToken from cookie (or body)
2. Verify JWT signature
3. Hash the token (SHA-256)
4. Look up hash in refresh_tokens table
5. If found and not expired:
   a. Generate new accessToken
   b. Return it
6. If not found or expired:
   a. Return 401
```

## Logout Flow

```
Frontend:
1. Call api.auth.logout()
2. Clear accessToken from localStorage
3. Set user = null in AuthContext

Backend:
1. Read refreshToken from cookie
2. Hash it and delete from refresh_tokens table
3. Clear the refreshToken cookie
4. Return { ok: true }
```

## Security Details

### Password Hashing

```typescript
// Signup: hash the password
const hash = bcryptjs.hashSync(password, 10);
// 10 rounds of salt generation

// Login: compare
const match = bcryptjs.compareSync(password, stored_hash);
```

### JWT Structure

**Access Token Payload:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "iat": 1706800000,
  "exp": 1706800900
}
```

**Refresh Token Payload:**
```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "iat": 1706800000,
  "exp": 1707404800
}
```

### JWT Secrets

Configured via environment variables:

```env
JWT_ACCESS_SECRET=your-access-secret
JWT_REFRESH_SECRET=your-refresh-secret
```

**Default values** are hardcoded for local development:
- Access: `'tabby-access-secret-dev'`
- Refresh: `'tabby-refresh-secret-dev'`

> **Production:** Always set unique, random secrets. Never use defaults.

### Refresh Token Storage

Refresh tokens are **not stored in plaintext**. The server stores a SHA-256 hash:

```typescript
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
// Stored in refresh_tokens.token_hash
```

This means even if the database is compromised, refresh tokens cannot be extracted.

### Cookie Configuration

```typescript
res.cookie('refreshToken', token, {
  httpOnly: true,    // Not accessible via JavaScript
  secure: false,     // Set to true in production (HTTPS)
  sameSite: 'lax',   // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
  path: '/',
});
```

## Auth Middleware

### requireAuth

Applied to all protected routes:

```typescript
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  req.user = { userId: payload.userId, email: payload.email };
  next();
}
```

### requireBankLinked

Applied to routes that need bank verification (group creation, joining):

```typescript
function requireBankLinked(req, res, next) {
  const user = db.prepare('SELECT bank_linked FROM users WHERE id = ?')
    .get(req.user.userId);
  if (!user || !user.bank_linked) {
    return res.status(403).json({ error: 'Bank account must be linked' });
  }
  next();
}
```

## Frontend Token Management

### Storage

```typescript
// In api.ts
const TOKEN_KEY = 'tabby_access_token';

function setAccessToken(token: string) {
  accessToken = token;          // In-memory for current session
  localStorage.setItem(TOKEN_KEY, token);  // Persistent
}

function getAccessToken() {
  return accessToken ?? localStorage.getItem(TOKEN_KEY);
}

function clearTokens() {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
}
```

### Automatic Token Attachment

Every API request includes the token:

```typescript
const token = getAccessToken();
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

## Invite Token Handling During Auth

When a user opens an invite link (format: `${origin}/join/TOKEN`):

```
1. App loads with /join/TOKEN in the URL path
2. User is routed to AcceptInvitePage with the token
3. If not logged in: user logs in or signs up first
4. AcceptInvitePage calls api.groups.joinByToken(token) when user accepts
5. On success, user is navigated to the joined group
```

## Flowchart: Complete Auth State Machine

```
                    ┌──────────────┐
                    │   App Load   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Has Token?   │
                    └──┬───────┬───┘
                   Yes │       │ No
                       │       │
               ┌───────▼──┐  ┌─▼────────────┐
               │ Verify   │  │ Show Login/   │
               │ /users/me│  │ Signup        │
               └──┬────┬──┘  └──────┬────────┘
              OK  │    │ 401        │
                  │    │            │ Authenticate
           ┌──────▼┐  ▼            ▼
           │  User │  Refresh   ┌──────────────┐
           │  Set  │  Token?    │ Store Token   │
           └──┬────┘     │     │ Set User      │
              │      ┌───▼──┐  └──────┬────────┘
              │      │Retry │         │
              │      └──┬───┘         │
              │         │             │
              ▼         ▼             ▼
        ┌─────────────────────────────────┐
        │        Bank Linked?             │
        └──────┬──────────────┬───────────┘
           Yes │              │ No
               │              │
        ┌──────▼───┐   ┌─────▼──────────────┐
        │ Check    │   │ Link bank from     │
        │ Invite   │   │ Account page       │
        │ Token    │   └─────┬──────────────┘
        └──┬───────┘         │ After linking
           │                 │
           ▼                 ▼
     ┌───────────────────────────┐
     │       Show Home           │
     └───────────────────────────┘
```
