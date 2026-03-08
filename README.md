# Mission Control Dashboard

A local-first Mission Control dashboard for agent management, task orchestration, content pipelines, and team visualization. Dark mode, minimal UI, zero cloud dependencies.

## QuickStart

```bash
# 1. Clone the repo
git clone https://github.com/aloosley-ux/cortana-dashboard
cd cortana-dashboard

# 2. Install dependencies
npm install

# 3. Start locally
npm start

# 4. Open your browser to http://localhost:3000
```

**No extra config required. This process should take less than 90 seconds!**

## Features

| Screen | Description |
|--------|-------------|
| **Dashboard** | Overview with task counts, system monitoring, and recent activity |
| **Task Board** | Kanban board (Backlog → In Progress → Blocked → Completed) with drag-and-drop, filtering, and priority badges |
| **Content Pipeline** | Multi-stage workflow (Draft → Review → Approved → Published) with version tracking |
| **Calendar** | Month view with event dots, navigation, and upcoming event list |
| **Memory System** | Structured knowledge documents with search, tagging, and version history |
| **Team** | Agent roster with roles, departments, status, CPU/RAM stats, and lifecycle controls |
| **Digital Office** | Visual floor plan with real-time agent status, desk metaphor, and performance overlays |
| **Settings** | GitHub integration, git operations, and config management |
| **Global Search** | Search across tasks, content, memories, and agents from any screen |

## Architecture

```
Browser (Dark-mode SPA)
  ├── Sidebar navigation (8 views)
  ├── Global search bar
  └── Modal-based forms
        │
        ▼
Express.js API Server (server.js)
  ├── /api/tasks       — Kanban task CRUD
  ├── /api/content     — Content pipeline CRUD
  ├── /api/events      — Calendar event CRUD
  ├── /api/memories    — Memory system CRUD
  ├── /api/agents      — Agent management
  ├── /api/jobs        — Job queue
  ├── /api/search      — Global search
  ├── /api/monitoring  — System stats
  ├── /api/git/*       — Git operations
  ├── /api/github/*    — GitHub integration
  └── /api/config      — Configuration
        │
        ▼
SQLite (openclaw.db) — auto-created, zero config
```

**Stack:** Node.js, Express 5, better-sqlite3, vanilla HTML/CSS/JS frontend.

## Windows 11 Notes

PowerShell:
```powershell
npm install
npm start
```

Change port:
```powershell
$env:PORT=3001
npm start
```

Command Prompt:
```cmd
set PORT=3001
npm start
```

## What We Learned from Previous Mission Controls

We studied the architecture and UX of several open-source mission control projects:

### Repositories Reviewed

- **abhi1693/openclaw-mission-control** — Complex multi-service setup; Docker-dependent; rich feature set but high installation friction.
- **robsannaa/openclaw-mission-control** — Clean UI patterns; agent-first design; SQLite-backed local storage; good UX for non-experts.
- **crshdn/mission-control** — Modular architecture; webhook-driven orchestration; strong traceability through activity logging.

### Key Improvements Made

1. **Simplified installation** — No Docker, no cloud, no complex setup. One `npm install && npm start` command gets the dashboard running locally.
2. **Local-first persistence** — SQLite database auto-creates on first run. No database configuration required.
3. **Modular codebase** — Single `server.js` with clear endpoint boundaries. New features are added by creating routes and extending the schema.
4. **Consistent dark-mode UI** — Global design system with spacing, typography, color, and component standards applied across all screens.
5. **Real-time updates** — Every view refreshes data from the API on navigation. All actions are logged for full traceability.
6. **Forgiving UX** — Modal-based forms with validation. No confusing multi-step wizards. All features accessible from the sidebar.
7. **Clear documentation** — Step-by-step QuickStart, troubleshooting, and architecture documentation replace the confusing READMEs found in prior projects.

### Patterns Adopted

- **Agent-first control surface** — Agents are the primary entities, visible across Team and Office views.
- **Kanban-style task management** — Drag-and-drop columns for intuitive task lifecycle management.
- **Pipeline workflows** — Content moves through stages (Draft → Published) with version tracking at each stage.
- **Activity logging** — Every action generates an audit trail visible on the Dashboard.

## Documentation

- `docs/research.md` — Design research and referenced projects
- `docs/architecture.md` — System architecture and design decisions
- `docs/extending.md` — How to add features and integrations
- `docs/github.md` — GitHub token and integration setup
- `docs/troubleshooting.md` — Common setup and runtime fixes
- `docs/faq.md` — Quick answers for non-experts

## Proposed Future Modules

1. **Automation Builder** — Visual workflow editor to chain tasks, trigger jobs on events, and define cron schedules with a drag-and-drop interface.
2. **Analytics Dashboard** — Historical charts for task throughput, agent utilization, content pipeline velocity, and cost trends over time.
3. **Notification Center** — Configurable alerts for blocked tasks, agent failures, overdue events, and pipeline bottlenecks via in-app toasts and optional email/webhook integration.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Missing Node.js?** | Install from [nodejs.org](https://nodejs.org/) (LTS recommended) |
| **Permission denied?** | On macOS/Linux try `sudo npm install`. On Windows, run PowerShell as Administrator |
| **Port 3000 in use?** | Set `PORT=3001` environment variable before `npm start` |
| **Git push fails?** | Check local git credentials and branch permissions |
| **GitHub API errors?** | Verify your personal access token scopes and repo values in Settings |
| **Database errors?** | Delete `openclaw.db` and restart — it auto-recreates |
| **Blank dashboard?** | Check browser console for errors. Ensure the server is running on the correct port |

## Running Tests

```bash
npm test
```

Tests use Node.js built-in test runner with supertest for HTTP assertions.
