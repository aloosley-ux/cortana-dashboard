# Extending OpenClaw Dashboard

## Add a new agent capability
1. Add endpoint under `server.js` in the agents route section.
2. Log the action to `activity_logs`.
3. Add a UI button and event handler in `public/app.js`.

## Add production database support
1. Keep `config.database` as the source of truth.
2. Replace direct SQLite calls with an adapter layer.
3. Keep API response contracts stable for UI compatibility.

## Add orchestration integrations
- Add webhook endpoints for external triggers.
- Convert webhook events into `/api/jobs` queue entries.
