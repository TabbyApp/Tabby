#!/usr/bin/env node
/**
 * Parses EPICS_AND_STORIES.md and outputs Jira-ready CSV + JSON.
 *
 * Usage:
 *   node scripts/parse-jira-stories.js
 *
 * Outputs:
 *   scripts/jira-stories.csv  — Import in Jira: Project Settings → System → External System Import → CSV
 *   scripts/jira-stories.json — For API scripts or other tools
 *
 * Optional: create issues via Jira API (set env vars first):
 *   JIRA_BASE_URL=https://your-domain.atlassian.net
 *   JIRA_PROJECT=TAB
 *   JIRA_EMAIL=you@example.com
 *   JIRA_API_TOKEN=your-api-token
 *
 *   node scripts/parse-jira-stories.js --create
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INPUT = path.join(ROOT, 'EPICS_AND_STORIES.md');
const OUT_CSV = path.join(__dirname, 'jira-stories.csv');
const OUT_JSON = path.join(__dirname, 'jira-stories.json');

function escapeCsv(value) {
  if (value == null) return '""';
  const s = String(value).replace(/"/g, '""');
  return `"${s}"`;
}

const EPIC_SUMMARIES = {
  'Phase 1': 'Phase 1: Working App Core',
  'Phase 2': 'Phase 2: Plaid + Charge',
  'Phase 3': 'Phase 3: Receipt Pipeline (Robust OCR)',
  'Phase 4': 'Phase 4: Notifications and Polish',
};

function parseEpics(content) {
  const epics = [];
  const phaseRegex = /# Phase (\d+):\s*([^\n]+)/g;
  let m;
  while ((m = phaseRegex.exec(content)) !== null) {
    const phaseNum = m[1];
    const phaseTitle = m[2].trim();
    const phase = `Phase ${phaseNum}`;
    const summary = `${phase}: ${phaseTitle}`;
    const blockStart = m.index + m[0].length;
    const block = content.slice(blockStart, blockStart + 500);
    const epicMatch = block.match(/\*\*Epic:\*\*\s*\*([^*]+)\*/);
    const goalMatch = block.match(/\nGoal:\s*([^\n]+)/);
    let description = epicMatch ? epicMatch[1].trim() : '';
    if (goalMatch) description += (description ? '\n\n' : '') + goalMatch[1].trim();
    epics.push({
      summary,
      description: description || `Epic for ${phase}.`,
      issueType: 'Epic',
      phase,
      epicName: summary,
    });
  }
  return epics;
}

function parseStories(content) {
  const stories = [];
  const lines = content.split(/\r?\n/);
  let currentPhase = '';
  let currentTrack = ''; // Backend | Frontend

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Phase header: "## Phase 1 — Backend Stories" or "## Phase 1 — Frontend Stories"
    const phaseMatch = line.match(/^## Phase (\d+) — (Backend|Frontend)/);
    if (phaseMatch) {
      currentPhase = `Phase ${phaseMatch[1]}`;
      currentTrack = phaseMatch[2];
      continue;
    }

    // Story header: "### TAB-1.1 [Backend] Ensure DB and uploads..."
    const headerMatch = line.match(/^### (TAB-\d+(?:\.\d+)?) \[(Backend|Frontend)\] (.+)$/);
    if (headerMatch) {
      const [, id, track, title] = headerMatch;
      currentTrack = track;

      let description = '';
      let acceptanceCriteria = '';

      // Collect Description (until **Acceptance Criteria:**)
      let j = i + 1;
      while (j < lines.length && !lines[j].startsWith('**Acceptance Criteria:**') && !lines[j].match(/^### TAB-/)) {
        const l = lines[j];
        if (l.trim().startsWith('**Description:**')) {
          j++;
          continue;
        }
        if (l === '---') break;
        description += (description ? '\n' : '') + l.trimEnd();
        j++;
      }

      // Collect Acceptance Criteria (until next ### or ---)
      if (lines[j] && lines[j].startsWith('**Acceptance Criteria:**')) {
        j++;
        while (j < lines.length && !lines[j].match(/^### TAB-/) && lines[j] !== '---') {
          acceptanceCriteria += (acceptanceCriteria ? '\n' : '') + lines[j].trimEnd();
          j++;
        }
      }

      description = description.trim();
      acceptanceCriteria = acceptanceCriteria.trim();

      const epicName = EPIC_SUMMARIES[currentPhase] || currentPhase;
      stories.push({
        id,
        summary: `${id} ${title}`,
        description,
        acceptanceCriteria,
        issueType: 'Story',
        labels: [currentPhase, currentTrack],
        phase: currentPhase,
        component: currentTrack,
        epicName,
      });
      continue;
    }
  }

  return stories;
}

function writeCsv(epics, stories) {
  const header = 'Summary,Description,Issue Type,Labels,Phase,Component,Epic Name';
  const epicRows = epics.map((e) => {
    const desc = (e.description || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    return [
      escapeCsv(e.summary),
      escapeCsv(desc),
      escapeCsv(e.issueType),
      escapeCsv(e.phase),
      escapeCsv(e.phase),
      escapeCsv(''),
      escapeCsv(''),
    ].join(',');
  });
  const storyRows = stories.map((s) => {
    const desc = (s.description + '\n\nAcceptance Criteria:\n' + s.acceptanceCriteria)
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return [
      escapeCsv(s.summary),
      escapeCsv(desc),
      escapeCsv(s.issueType),
      escapeCsv(s.labels.join(', ')),
      escapeCsv(s.phase),
      escapeCsv(s.component),
      escapeCsv(s.epicName || ''),
    ].join(',');
  });
  const rows = [...epicRows, ...storyRows];
  fs.writeFileSync(OUT_CSV, [header, ...rows].join('\n'), 'utf8');
  console.log('Wrote', OUT_CSV, `(${epics.length} epics, ${stories.length} stories)`);
}

function writeJson(epics, stories) {
  fs.writeFileSync(OUT_JSON, JSON.stringify({ epics, stories }, null, 2), 'utf8');
  console.log('Wrote', OUT_JSON, `(${epics.length} epics, ${stories.length} stories)`);
}

async function createEpicsInJira(epics) {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const project = process.env.JIRA_PROJECT;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const phaseToKey = {};
  for (const e of epics) {
    try {
      const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: project },
            summary: e.summary,
            description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: e.description || '' }] }] },
            issuetype: { name: 'Epic' },
            labels: [e.phase],
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        phaseToKey[e.phase] = data.key;
        console.log('Created Epic', data.key, e.summary);
      } else {
        console.error('Failed Epic', e.summary, res.status, await res.text());
      }
    } catch (err) {
      console.error('Failed Epic', e.summary, err.message);
    }
  }
  return phaseToKey;
}

async function createInJira(stories, phaseToKey = {}) {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const project = process.env.JIRA_PROJECT;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !project || !email || !token) {
    console.error('Set JIRA_BASE_URL, JIRA_PROJECT, JIRA_EMAIL, JIRA_API_TOKEN to create issues.');
    process.exit(1);
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  let created = 0;
  let failed = 0;

  for (const s of stories) {
    const body = s.description + '\n\nh3. Acceptance Criteria\n' + s.acceptanceCriteria.replace(/\n/g, '\n* ');
    const fields = {
      project: { key: project },
      summary: s.summary,
      description: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }],
      },
      issuetype: { name: 'Story' },
      labels: s.labels,
    };
    if (phaseToKey[s.phase]) {
      fields.parent = { key: phaseToKey[s.phase] };
    }
    const payload = { fields };

    try {
      const res = await fetch(`${baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Created', data.key, s.summary.slice(0, 50) + '...');
        created++;
      } else {
        const err = await res.text();
        console.error('Failed', s.id, res.status, err);
        failed++;
      }
    } catch (e) {
      console.error('Failed', s.id, e.message);
      failed++;
    }
  }

  console.log('Done. Created:', created, 'Failed:', failed);
}

async function main() {
  const content = fs.readFileSync(INPUT, 'utf8');
  const epics = parseEpics(content);
  const stories = parseStories(content);

  if (stories.length === 0) {
    console.error('No stories parsed. Check EPICS_AND_STORIES.md format.');
    process.exit(1);
  }

  writeCsv(epics, stories);
  writeJson(epics, stories);

  if (process.argv.includes('--create')) {
    const createdEpics = await createEpicsInJira(epics);
    await createInJira(stories, createdEpics);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
