# Scripts

## Jira story export

Parse `EPICS_AND_STORIES.md` and generate files for Jira import so you don't have to create ~50 stories by hand.

### 1. Generate CSV and JSON

From the repo root:

```bash
npm run jira:export
```

Or:

```bash
node scripts/parse-jira-stories.js
```

**Output:**

- `scripts/jira-stories.csv` — **4 Epics + 48 Stories** (Epics first, then Stories), with an **Epic Name** column on each story
- `scripts/jira-stories.json` — same as `{ epics, stories }` for other tools or API use

### 2. Walkthrough: from CSV to Jira (step-by-step)

Follow these steps to get the CSV into Jira.

---

**Step 1 — Generate the CSV**

In your project folder (Tabby repo root), run:

```bash
npm run jira:export
```

You should see: `Wrote scripts/jira-stories.csv (4 epics, 48 stories)`.

---

**Step 2 — Locate the file**

Open the file:

- **Path:** `Tabby/scripts/jira-stories.csv`
- Or from repo root: `scripts/jira-stories.csv`

You can open it in Excel/Sheets to confirm: first 4 rows are Epics, rest are Stories; columns are Summary, Description, Issue Type, Labels, Phase, Component, Epic Name.

---

**Step 3 — In Jira Cloud: start the import**

1. Log in to [Jira Cloud](https://www.atlassian.com/software/jira) and open the **project** where you want the issues (e.g. Tabby).
2. Go to **Project settings** (gear icon in the left sidebar under the project name).
3. In the left menu, find **Import** or **Import and export** (or under **Apps** / **System** → **External system import**).
4. Choose **CSV** (or **Import from CSV**).
5. Click **Choose file** (or **Select file**) and pick **`jira-stories.csv`** from `Tabby/scripts/jira-stories.csv` on your machine.
6. Click **Next** or **Continue**.

---

**Step 4 — Map CSV columns to Jira fields**

Jira will show a mapping screen: CSV column → Jira field.

Map at least:

| CSV column   | Jira field   |
|-------------|--------------|
| Summary     | Summary      |
| Description | Description  |
| Issue Type  | Issue Type   |
| Labels      | Labels       |

If you see **Epic Name** in the CSV and your Jira has an **Epic Link** (or **Parent**) field that accepts Epic names, map **Epic Name** → **Epic Link** (or **Parent**) so Stories link to Epics in one go. If Epic Link only accepts Epic keys, leave Epic Name unmapped and link after import (Step 6).

Optionally map **Phase** and **Component** to custom fields if your project uses them.

Then click **Begin import** (or **Import**).

---

**Step 5 — Wait for the import**

Jira will create 4 Epics and 48 Stories. Wait until it finishes. If there are errors (e.g. "Issue Type Epic not found"), your project may not have Epic enabled—enable it in **Project settings** → **Issue types**, or remove the Epic rows from the CSV and import only Stories.

---

**Step 6 — (Optional) Link Stories to Epics**

If you didn't map **Epic Name** in Step 4 (or your Jira doesn't support linking by name):

1. In the project, open the **Board** or **Backlog**.
2. Filter issues by label **Phase 1**.
3. Select all (checkbox), then **Bulk change** (or **…** → **Bulk change**).
4. Choose **Edit issues** → set **Epic Link** (or **Parent**) to the Epic **Phase 1: Working App Core**.
5. Repeat for **Phase 2**, **Phase 3**, **Phase 4** (Epics "Phase 2: Plaid + Charge", etc.).

---

**Done.** You should now have 4 Epics and 48 Stories in the project; Stories can be linked to Epics by Phase (Step 6 if needed).

**Jira Server / Data Center:** Use your instance's **Import** (e.g. Project settings → Import, or Admin → System → Import). Upload the same CSV and map the same columns (Summary, Description, Issue Type, Labels, and Epic Name if supported).

### 3. Create issues via Jira API (optional)

To create issues directly in Jira instead of CSV import:

1. Create an [API token](https://id.atlassian.com/manage-profile/security/api-tokens) (Jira Cloud).
2. Set environment variables:

   ```bash
   export JIRA_BASE_URL=https://your-domain.atlassian.net
   export JIRA_PROJECT=TAB
   export JIRA_EMAIL=you@example.com
   export JIRA_API_TOKEN=your-api-token
   ```

3. Run:

   ```bash
   node scripts/parse-jira-stories.js --create
   ```

The script will POST each story to Jira. If your project uses different issue type names or custom fields, adjust the `createInJira` payload in `parse-jira-stories.js`.

### Regenerating after edits

After you change `EPICS_AND_STORIES.md`, run `npm run jira:export` again to regenerate the CSV and JSON.
