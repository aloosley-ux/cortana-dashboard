# Cortana Dashboard — Mission Control

> **The easiest-to-install AI agent dashboard for Windows 11 users.**  
> A local-first, single-command mission control for managing OpenClaw agents, tasks, content, calendar events, and GitHub workflows — no Docker, no cloud account, no database setup required.

---

## Table of Contents

1. [Quickstart (Windows 11)](#quickstart-windows-11)
2. [Features](#features)
3. [Installation Options](#installation-options)
4. [Configuration](#configuration)
5. [API Reference](#api-reference)
6. [Troubleshooting](#troubleshooting)
7. [Development & Testing](#development--testing)
8. [Architecture](#architecture)
9. [Advantages Over Reference Dashboards](#advantages-over-reference-dashboards)

---

## Quickstart (Windows 11)

**You need these installed first (one-time setup):**

| Tool | Why | Download |
|------|-----|----------|
| **Node.js 18+** | Runs the server | [nodejs.org](https://nodejs.org/) — choose the LTS installer |
| **Git** | Clone the repo | [git-scm.com](https://git-scm.com/download/win) |

**Then, open PowerShell (or Command Prompt) and run these four commands:**

```powershell
git clone https://github.com/aloosley-ux/cortana-dashboard.git
cd cortana-dashboard
npm install
npm start
```

**Open your browser and go to:**

```
http://localhost:3000
```

That's it. The database is created automatically on first run. No environment variables, no Docker, no config files needed to get started.

---

## Features

### Dashboard Overview
- Live task counts across all Kanban stages (Backlog, In Progress, Blocked, Completed)
- System monitoring: RAM, heap usage, estimated compute cost, server uptime
- Real-time activity log showing every recent action

### Task Board (Kanban)
- Create, edit, and delete tasks with title, description, priority, and tags
- Drag-and-drop cards between Backlog → In Progress → Blocked → Completed
- Filter by priority (High / Medium / Low)

### Content Pipeline
- Manage articles, scripts, videos, and images through Draft → Review → Approved → Published
- One-click stage advancement with the "Advance →" button
- Auto-increments version number when body is edited

### Calendar
- Monthly calendar view with event dots on days
- Create recurring events (daily / weekly / monthly)
- Upcoming events list below the calendar

### Memory System
- Searchable knowledge base for agent notes, research, configs, and decisions
- Full-text search across title, content, and tags
- Version history: every content edit increments the version counter

### Team (Agent Management)
- Add, start, stop, and remove AI agents
- Chat with agents (offline mode returns confirmation; connect an LLM for real responses)
- Live status indicator (Running / Stopped) with CPU and RAM display

### Digital Office
- Visual floor-plan view of all agents at their "desks"
- Status LED indicator (green = running, grey = stopped)
- Click any desk to jump to that agent's detail

### Settings & GitHub Integration
- Save GitHub owner, repo, and personal access token
- View open Issues and Pull Requests directly in the dashboard
- Assign issues to agents, post comments, and close issues
- Create pull requests from the dashboard
- Git operations: pull, push, commit — all from the browser UI

### Global Search
- Searches tasks, content, memories, and agents simultaneously
- 300 ms debounce for smooth typing experience
- Click any result to jump to that item's view

### System Monitoring
- RSS and heap memory usage with configurable warning thresholds
- Estimated compute cost based on completed jobs × cost-per-job setting
- Server uptime displayed on the dashboard

---

## Installation Options

### Option 1: Local (Recommended for Windows 11)

```powershell
# 1. Clone
git clone https://github.com/aloosley-ux/cortana-dashboard.git
cd cortana-dashboard

# 2. Install
npm install

# 3. Run
npm start

# 4. Open browser
# http://localhost:3000
```

To use a different port:

```powershell
# PowerShell
$env:PORT=3001; npm start

# Command Prompt
set PORT=3001 && npm start
```

### Option 2: Docker

```powershell
# Build and run
docker build -t cortana-dashboard .
docker run -p 3000:3000 cortana-dashboard
```

---

## Configuration

The first time you run `npm start`, a `config.json` file is created automatically from `config.example.json`.

To add GitHub integration:

1. Open the dashboard at `http://localhost:3000`
2. Click **Settings** in the sidebar
3. Fill in:
   - **Owner**: Your GitHub username or organization name
   - **Repository**: The repository name (without the owner prefix)
   - **Token**: A GitHub Personal Access Token with `repo` scope
4. Click **Save Configuration**

To generate a GitHub Personal Access Token:
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Select the `repo` scope
4. Copy the token and paste it into the Settings form

---

## API Reference

### Configuration
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | Load current configuration |
| `PUT` | `/api/config` | Save configuration |

### Agents
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents` | List all agents |
| `POST` | `/api/agents` | Create an agent |
| `POST` | `/api/agents/:id/start` | Start an agent |
| `POST` | `/api/agents/:id/stop` | Stop an agent |
| `POST` | `/api/agents/:id/chat` | Send a message to an agent |
| `DELETE` | `/api/agents/:id` | Remove an agent |

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/jobs` | List all jobs |
| `POST` | `/api/jobs` | Create a job |
| `POST` | `/api/jobs/:id/start` | Start a job |
| `POST` | `/api/jobs/:id/complete` | Mark a job complete |
| `DELETE` | `/api/jobs/:id` | Delete a job |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tasks` | List all tasks |
| `POST` | `/api/tasks` | Create a task |
| `PUT` | `/api/tasks/:id` | Update a task |
| `DELETE` | `/api/tasks/:id` | Delete a task |

### Content Pipeline
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/content` | List all content items |
| `POST` | `/api/content` | Create a content item |
| `PUT` | `/api/content/:id` | Update (stage/body/title) |
| `DELETE` | `/api/content/:id` | Delete a content item |

### Calendar Events
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | List all events |
| `POST` | `/api/events` | Create an event |
| `PUT` | `/api/events/:id` | Update an event |
| `DELETE` | `/api/events/:id` | Delete an event |

### Memory System
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/memories` | List all memories |
| `POST` | `/api/memories` | Create a memory |
| `PUT` | `/api/memories/:id` | Update a memory |
| `DELETE` | `/api/memories/:id` | Delete a memory |

### GitHub Integration
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/github/issues` | List open issues and PRs |
| `POST` | `/api/github/issues/:number/assign` | Assign an issue |
| `POST` | `/api/github/issues/:number/comment` | Comment on an issue |
| `POST` | `/api/github/issues/:number/close` | Close an issue |
| `POST` | `/api/github/prs/create` | Create a pull request |

### Utilities
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search?q=` | Global search |
| `GET` | `/api/monitoring` | System resource stats |
| `GET` | `/api/activity` | Recent activity log |
| `POST` | `/api/git/pull` | Git pull |
| `POST` | `/api/git/push` | Git push |
| `POST` | `/api/git/commit` | Git commit (body: `{ message }`) |

---

## Troubleshooting

### Port 3000 is already in use

```powershell
# PowerShell
$env:PORT=3001; npm start

# Command Prompt
set PORT=3001 && npm start
```

### `npm install` fails with permission error

Run PowerShell **as Administrator** (right-click → "Run as administrator"), then retry.

### Blank dashboard after starting the server

1. Press **F12** in your browser to open DevTools
2. Check the **Console** tab for error messages
3. Ensure the server is still running in your terminal window
4. Try a hard refresh: **Ctrl + Shift + R**

### GitHub integration shows an error

- Confirm your Personal Access Token has the `repo` scope
- Confirm the **Owner** and **Repository** values in Settings match the exact GitHub URL
- Check that the token has not expired

### Database errors on start

Delete the database file and let it recreate:

```powershell
Remove-Item openclaw.db -ErrorAction SilentlyContinue
npm start
```

On macOS/Linux:

```bash
rm -f openclaw.db && npm start
```

### Drag-and-drop doesn't work

Use a modern browser: Chrome, Edge, or Firefox. Ensure you click, hold, and drag — not just click.

### `node` or `npm` is not recognized

Node.js is not installed or not on your PATH. Download the LTS installer from [nodejs.org](https://nodejs.org/) and re-open PowerShell after installation.

---

## Development & Testing

```powershell
# Run the test suite
npm test

# Start the server in development (with auto-reload)
npx nodemon server.js
```

Tests use Node.js's built-in test runner (`node:test`). The test database is always an in-memory SQLite instance — no file is created or modified on disk during testing.

---

## Architecture

```
Browser (SPA — dark mode, 8 views)
  │  Fetch API (JSON)
  ▼
Express.js Server (server.js, port 3000)
  ├── /api/agents       Agent CRUD + start/stop/chat
  ├── /api/jobs         Job queue
  ├── /api/tasks        Kanban task CRUD
  ├── /api/content      Content pipeline CRUD
  ├── /api/events       Calendar event CRUD
  ├── /api/memories     Memory system CRUD
  ├── /api/search       Global full-text search
  ├── /api/monitoring   System stats
  ├── /api/activity     Activity log
  ├── /api/git/*        Git operations
  ├── /api/github/*     GitHub REST API integration
  └── /api/config       Configuration
  │
  Rate Limiting: 120 req/min on /api/*
  Static Files: served from public/
  │
  ▼
SQLite Database (openclaw.db, auto-created on first run)
  ├── agents          Agent roster
  ├── jobs            Job queue
  ├── tasks           Kanban board items
  ├── content         Content pipeline items
  ├── events          Calendar events
  ├── memories        Knowledge base documents
  └── activity_logs   Full audit trail
```

See [`docs/architecture.md`](docs/architecture.md) for the full design diagram.

---

## Advantages Over Reference Dashboards

| Feature | abhi1693/openclaw-mission-control | robsannaa/openclaw-mission-control | **Cortana Dashboard** |
|---------|----------------------------------|------------------------------------|-----------------------|
| Install complexity | Docker + Compose required | `npm install && npm start` | **`npm install && npm start`** |
| Windows 11 friendly | Requires WSL / Docker Desktop | Yes | **Yes, native** |
| UI | Multiple pages | Single agent view | **8-view SPA with sidebar** |
| Dark mode | Partial | No | **Full dark mode design system** |
| Task management | Basic | No | **Full Kanban with drag-and-drop** |
| Content pipeline | No | No | **Draft → Review → Approved → Published** |
| Calendar | No | No | **Monthly calendar + recurring events** |
| Memory system | No | No | **Versioned, searchable knowledge base** |
| Global search | No | No | **Cross-entity full-text search** |
| GitHub integration | Yes | No | **Issues, PRs, comments, git ops** |
| System monitoring | Yes | No | **RAM, heap, uptime, cost estimate** |
| Test suite | No | No | **13 passing integration tests** |
| Database | External service | SQLite | **SQLite (auto-created, zero-config)** |
| Rate limiting | No | No | **120 req/min on all API routes** |

---

MIT License.
