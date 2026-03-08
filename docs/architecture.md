# Architecture

```text
Browser UI (public/)
   |
   | fetch /api/*
   v
Express API (server.js)
   |- /api/agents
   |- /api/jobs
   |- /api/github
   |- /api/git
   |- /api/monitoring
   |- /api/config
   |
   v
SQLite (openclaw.db)
Activity log table for traceability
```

Design goals:
- single-service deployment
- simple local setup
- clear endpoint boundaries for extension

Monitoring note:
- Agent CPU/RAM figures in the list are lightweight placeholder estimates for dashboard UX.
- Process-level memory/uptime values are real runtime values from Node.js.
