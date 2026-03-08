# Research: Open-Source Dashboard Patterns for OpenClaw

## Sources reviewed

- TenacitOS: https://github.com/tenacitos/tenacitos
- Robsannaa Mission Control: https://github.com/robsannaa/mission-control
- Autensa: https://github.com/autensa/autensa
- ClawController: https://github.com/openclaw/clawcontroller
- Builderz Mission Control: https://github.com/builderz/mission-control

## Key architecture patterns

1. **Local-first orchestration service**
   - Best for fast setup and low-friction demos.
   - Applied here with one Express server handling API + static UI.

2. **SQLite default data store**
   - Common for lightweight deployment and reproducibility.
   - Applied here with `openclaw.db` and schema for agents, jobs, and logs.

3. **Config-driven integrations**
   - Simple config structure makes integrations transparent and extensible.
   - Applied here with `config.json` managed by the Setup Wizard.

## UX patterns that informed this implementation

1. **Agent-first control surface**
   - Status and direct actions should be visible immediately.
   - Implemented with one-click start/stop/chat/remove in the first panel.

2. **Actionable queue**
   - Queue visibility and controls should be together.
   - Implemented with queue summary + per-job lifecycle actions.

3. **Traceability**
   - Auditable event history builds trust and supports debugging.
   - Implemented with a shared activity log across agents/jobs/git/GitHub actions.

## Integration patterns

1. **GitHub in context**
   - Show issue/PR context where operations are performed.
   - Implemented with issue fetch, assign (comment marker), comment, and close.

2. **Low-complexity git controls**
   - Non-technical users benefit from constrained operations.
   - Implemented with pull/push/commit buttons and visible output.

## Why these choices

The dashboard prioritizes non-expert usability: minimal setup (`npm install && npm start`), visible core controls, and plain-language documentation. The API boundaries (`/api/agents`, `/api/jobs`, `/api/github`, `/api/git`, `/api/monitoring`, `/api/config`) keep extension work straightforward.
