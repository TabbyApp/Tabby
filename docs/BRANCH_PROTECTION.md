# Branch Protection & CI Setup

To prevent accidental overwrites and enforce quality, configure GitHub branch protection:

## 1. Protect `master` (or `main`)

**Settings → Branches → Add branch protection rule**

- **Branch name pattern:** `master` (or `main`)
- **Require a pull request before merging:** Yes
  - Require 1 approval
- **Require status checks to pass before merging:** Yes
  - **Require branches to be up to date:** Yes
  - **Status checks:** `frontend`, `server`, `server-migrate`
- **Require conversation resolution before merging:** Optional
- **Do not allow bypassing the above settings:** Recommended for enforceability

## 2. Default branch

Ensure your default branch matches the protection rule (Settings → General → Default branch).

## 3. CI workflow

The `.github/workflows/ci.yml` workflow runs on every push and PR to `master`/`main`:

| Job | What it does |
|-----|--------------|
| **frontend** | `npm ci` + `npm run build` (root) |
| **server** | `npm ci` + `npm run build` (server/) |
| **server-migrate** | Build + run migrations against temp Postgres |

All must pass before merging when branch protection is enabled.
