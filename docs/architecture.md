# System Architecture

## Overview

Mission Control Dashboard is a local-first, single-service application. Everything runs on the user's machine with no external cloud dependencies.

```
┌─────────────────────────────────────────────┐
│  Browser (Dark-mode Single-Page Application) │
│  ├── Sidebar Navigation (8 views)            │
│  ├── Global Search                           │
│  ├── Modal-based Forms                       │
│  └── Drag-and-Drop Kanban Board              │
└──────────────┬──────────────────────────────┘
               │  Fetch API (JSON)
               ▼
┌─────────────────────────────────────────────┐
│  Express.js API Server (server.js)           │
│  ├── /api/tasks       Kanban task CRUD       │
│  ├── /api/content     Content pipeline CRUD  │
│  ├── /api/events      Calendar event CRUD    │
│  ├── /api/memories    Memory system CRUD     │
│  ├── /api/agents      Agent management       │
│  ├── /api/jobs        Job queue              │
│  ├── /api/search      Global search          │
│  ├── /api/monitoring  System stats           │
│  ├── /api/activity    Activity log           │
│  ├── /api/git/*       Git operations         │
│  ├── /api/github/*    GitHub integration     │
│  └── /api/config      Configuration          │
│                                              │
│  Rate Limiting: 120 req/min on /api/*        │
│  Static Files: served from public/           │
└──────────────┬──────────────────────────────┘
               │  better-sqlite3 (sync)
               ▼
┌─────────────────────────────────────────────┐
│  SQLite Database (openclaw.db)               │
│  ├── agents          Agent roster            │
│  ├── jobs            Job queue               │
│  ├── tasks           Kanban board items      │
│  ├── content         Content pipeline items  │
│  ├── events          Calendar events         │
│  ├── memories        Knowledge documents     │
│  └── activity_logs   Audit trail             │
└─────────────────────────────────────────────┘
```

## Design Goals

1. **Single-service deployment**: One `npm start` launches everything.
2. **Simple local setup**: No Docker, no cloud accounts, no database installation.
3. **Clear endpoint boundaries**: Each API route maps to a specific feature.
4. **Modular schema**: Each table is independent, making it easy to add new features.

## Frontend Architecture

The frontend is a vanilla HTML/CSS/JavaScript single-page application:

- **index.html**: Page structure with sidebar, topbar, and view containers
- **styles.css**: Dark mode design system with CSS custom properties
- **app.js**: View routing, API calls, drag-and-drop, form handling

Views are shown/hidden via CSS classes. The sidebar navigation triggers view switches.

## Database Schema

| Table | Purpose | Key Fields |
|-------|---------|------------|
| agents | Team members | name, role, status, department |
| jobs | Job queue | title, status, agent_id, scheduled_for |
| tasks | Kanban board | title, status, priority, tags, assignee_id |
| content | Content pipeline | title, stage, body, version |
| events | Calendar | title, start_date, end_date, recurring |
| memories | Knowledge base | title, content, tags, version |
| activity_logs | Audit trail | entity_type, entity_id, message |

## Notes

- Agent CPU/RAM stats in the UI are lightweight placeholder estimates, not real measurements.
- The SQLite database file (`openclaw.db`) is auto-created on first run and gitignored.
- Config is stored in `config.json` (gitignored) with defaults auto-generated from `config.example.json`.
