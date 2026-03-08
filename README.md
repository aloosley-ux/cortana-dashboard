# OpenClaw AI Dashboard

Simple, local-first dashboard for OpenClaw agent management and orchestration.

## Quick Start (Windows 11 + macOS/Linux)

1. Clone:
   ```bash
   git clone https://github.com/aloosley-ux/cortana-dashboard
   cd cortana-dashboard
   ```
2. Install + launch:
   ```bash
   npm install
   npm start
   ```
3. Open: `http://localhost:3000`
4. Configure GitHub via the in-app Setup Wizard (or copy `config.example.json` to `config.json` and edit values).

```text
[Dashboard Home]
  ├─ Agents: add/start/stop/chat/remove
  ├─ Jobs: queue/start/stop/retry/complete/reschedule
  ├─ GitHub: list issues/PRs, assign/comment/close
  ├─ Git: pull/push/commit actions
  └─ Monitoring: resource + cost snapshot + activity history
```

## Features

- Agent roster with status, role, last activity, and resource snapshot.
- Job queue with pending/active/completed visibility and action buttons.
- GitHub issue/PR integration with assignment, comments, and close.
- Dashboard git operations (pull/push/commit).
- Monitoring panel with uptime, memory, thresholds, and estimated cost.
- Single-file configuration (`config.json`) editable in UI.

## Documentation

- `docs/research.md` — design lessons from referenced open-source dashboards.
- `docs/github.md` — GitHub token and integration setup.
- `docs/troubleshooting.md` — common setup/runtime fixes.
- `docs/extending.md` — adding capabilities and integrations.
- `docs/faq.md` — non-expert quick answers.
- `docs/architecture.md` — architecture diagram and decisions.

## Windows 11 Notes

PowerShell:
```powershell
npm install
npm start
```

Change port in PowerShell:
```powershell
$env:PORT=3001
npm start
```
