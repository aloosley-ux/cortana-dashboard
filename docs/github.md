# GitHub Integration Setup

1. Create a GitHub personal access token with repo permissions.
2. Open the dashboard Setup Wizard.
3. Enter `owner`, `repo`, and `token`.
4. Save config.
5. Click **Refresh GitHub Items**.

Security note:

- `config.json` contains your GitHub token in plain text for local development convenience.
- Keep `config.json` private and never commit it (it is ignored by `.gitignore`).

Supported dashboard actions:

- list issues/PRs
- assign issue to an agent (comment for traceability)
- comment on issues
- close issues
