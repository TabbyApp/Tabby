# Invite links and Render (fix "Not Found" on /join/:token)

Invite links look like `https://your-frontend.onrender.com/join/2d5fc88cfd38a5376d5f262c`. The app is a single-page app (SPA): only `index.html` exists on the server, and the client reads the URL and shows the accept-invite flow. If Render serves the static site without a rewrite, requests to `/join/...` get **404 Not Found** because there is no file at that path.

## Fix: Rewrite all paths to index.html

Render must **rewrite** (not redirect) all requests to `/index.html` so the SPA can handle `/join/:token` and any other client routes.

### Option A – Render Dashboard (if you didn’t use render.yaml)

1. Open [Render Dashboard](https://dashboard.render.com/) and select your **frontend** static site.
2. Go to **Redirects/Rewrites**.
3. Add a **Rewrite** rule:
   - **Source Path:** `/*`
   - **Destination Path:** `/index.html`
   - **Action:** Rewrite (not Redirect).

Save. After the next deploy (or immediately), invite links like `https://tabby-frontend-xxx.onrender.com/join/TOKEN` will load the app and the client will read the token and show the accept-invite page.

### Option B – render.yaml (Blueprint)

If you deploy with a Blueprint that includes the frontend, the repo’s `render.yaml` already defines a rewrite for the static site:

```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

Sync or deploy from the Blueprint so this config is applied.

## Why Rewrite and not Redirect?

- **Redirect** would change the URL (e.g. to `/`), so the app would lose the `/join/TOKEN` part and couldn’t show the correct invite.
- **Rewrite** serves `index.html` at the **original** URL, so the browser keeps `.../join/TOKEN` and the app can read it and open the accept-invite flow.
