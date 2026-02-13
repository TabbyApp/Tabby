# Plaid API setup (Sandbox)

Tabby uses [Plaid](https://plaid.com) so users can link a bank account. In **Sandbox** you get fake banks and fake money—no real accounts or charges.

---

## 1. Create a Plaid account

1. Go to **[dashboard.plaid.com](https://dashboard.plaid.com)** and sign up (free).
2. Confirm your email and log in.

---

## 2. Get your API keys

1. In the Dashboard, open **Developers → Keys** (or go to [dashboard.plaid.com/developers/keys](https://dashboard.plaid.com/developers/keys)).
2. You’ll see:
   - **Client ID** – a long string (e.g. `5f7a2b3c4d5e6f...`).
   - **Secrets** – one per environment:
     - **Sandbox** – use this for local development.
     - Development / Production – for later.

3. Copy your **Client ID** and your **Sandbox** secret (click to reveal, then copy).

---

## 3. Add keys to the Tabby server

1. In the repo, go to the **server** folder:
   ```bash
   cd server
   ```

2. Create a `.env` file (if it doesn’t exist):
   ```bash
   touch .env
   ```

3. Open `server/.env` and add (replace with your real values):
   ```env
   PLAID_CLIENT_ID=your_client_id_here
   PLAID_SECRET=your_sandbox_secret_here
   ```

4. **Important:**  
   - Use the **Sandbox** secret, not Development or Production.  
   - Don’t commit `.env` (it should be in `.gitignore`).

5. Restart the server so it picks up the new env vars:
   ```bash
   npm run dev
   ```

---

## 4. Test in the app

1. Start **backend** and **frontend** (see main [README](../README.md)).
2. Log in, open **Account** (profile).
3. Tap **“Add bank account (Plaid)”**.
4. Plaid Link will open (search or pick any bank).
5. Use **Sandbox** credentials:
   - **Username:** `user_good`
   - **Password:** `pass_good`
   - If it asks for a 2FA code: `1234`
6. Complete the flow. You should be returned to Tabby and see the new bank account under Payment Methods (e.g. “Bank •••• 0000”).

---

## 5. If something goes wrong

| Issue | What to do |
|--------|------------|
| “Plaid is not configured” | Add `PLAID_CLIENT_ID` and `PLAID_SECRET` to `server/.env` and restart the server. |
| Link never opens | Check browser console and server logs. Ensure keys are for **Sandbox**. |
| “Invalid credentials” in Link | In Sandbox always use `user_good` / `pass_good`. |
| 503 from `/api/plaid/link-token` | Env vars not loaded. Restart server from the `server` directory. |

---

## 6. Sandbox vs Production

- **Sandbox (what you have now):**  
  Fake banks, fake data, no real money. Good for building and testing.

- **Production:**  
  Real bank connections and (if you add a processor) real payments. Requires going through Plaid’s approval and using Production keys + HTTPS.

For local development and testing invites/flows, Sandbox is enough.

---

## Quick reference

| Item | Value |
|------|--------|
| Dashboard | [dashboard.plaid.com](https://dashboard.plaid.com) |
| Keys | Developers → Keys |
| Sandbox login (in Link) | `user_good` / `pass_good` |
| Env file | `server/.env` |
| Env vars | `PLAID_CLIENT_ID`, `PLAID_SECRET` (Sandbox secret) |
