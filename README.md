# Tabby

Group payments made invisible — one card, everyone pays their share instantly.

## Run locally

**Terminal 1 – backend**
```bash
cd server && npm install && npm run dev
```

**Terminal 2 – frontend**
```bash
npm install && npm run dev
```

Frontend: http://localhost:3000  
API: http://localhost:3001

## Test account (demo data)

To seed a test account with sample groups:
```bash
cd server && npm run seed
```

Then log in with:
- **Email:** test@tabby.com
- **Password:** password123

The seed also creates a second user (**test2@tabby.com** / **password123**) so you can test invites with one machine.

### Testing invites locally

1. **Main window:** Log in as **test@tabby.com**, open a group, tap **Invite** (person+ icon), then **Copy link**.
2. **Incognito/Private window:** Open the copied link (e.g. `http://localhost:3000/invite/...`).
3. When prompted, log in as **test2@tabby.com** with **password123**.
4. Tap **Accept Invite**. The group should appear in test2’s account.

New signups start with an empty account.

## Phone sign-in (OTP / 2FA)

You can sign in with a **phone number** instead of email: open the **Phone** tab on the login screen, enter your number, then enter the 6-digit code. Without Twilio configured, the server logs the code and (in dev) returns it in the API response so you can copy it.

**To send real SMS via Twilio Verify:**
1. Create a Verify Service at [Twilio Console → Verify → Services](https://console.twilio.com/us1/develop/verify/services)
2. **Set Friendly Name to "Tabby"** (this appears in SMS: "Your Tabby verification code is: ...")
   - Click your service → Edit → Set Friendly Name to `Tabby` → Save
3. Copy the **Verify Service SID** (starts with `VA...`)
4. Set in `server/.env`:
   ```env
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_VERIFY_SERVICE_SID=VA...
   ```
5. Install Twilio: `cd server && npm install twilio`
6. Restart the server

**Note:** If SMS messages appear as notifications but not in your inbox, this is normal for Twilio Verify—they use short codes that some carriers deliver as notifications. The code is still valid and can be entered in the app.

When **creating a group**, you can add members by **phone number**; anyone with a Tabby account for that number is added directly (no invite link).

## Plaid (bank linking, sandbox)

To let users add a bank account (for invites and future charging), set up Plaid in **Sandbox** (fake banks, no real money):

1. Sign up at [dashboard.plaid.com](https://dashboard.plaid.com) and get your **Client ID** and **Sandbox** secret from **Developers → Keys**.
2. Create `server/.env` with:
   ```env
   PLAID_CLIENT_ID=your_client_id
   PLAID_SECRET=your_sandbox_secret
   ```
3. Restart the server. In the app, go to **Account → Add bank account (Plaid)**. When Link asks for credentials, use **user_good** / **pass_good**.

Full steps and troubleshooting: **[docs/PLAID_SETUP.md](docs/PLAID_SETUP.md)**.

## OCR (receipt scanning)

Receipt uploads run Tesseract.js OCR to auto-extract line items. Works best with clear photos of printed receipts. If OCR misses items, add them manually on the itemization screen.
