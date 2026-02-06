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

New signups start with an empty account.

## OCR (receipt scanning)

Receipt uploads use the [TabScanner](https://tabscanner.com/) API to extract line items. Set your API key in the server environment:

```bash
export TABSCANNER_API_KEY=your_api_key
```

Then run the server as above. Works best with clear photos of printed receipts. If OCR misses items, add them manually on the itemization screen.
