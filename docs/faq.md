# FAQ

## I am on Windows 11. Does this work?
Yes. Use PowerShell:

```powershell
npm install
npm start
```

Then open `http://localhost:3000`.

## GitHub panel says not configured
Open the Setup Wizard and provide:
- GitHub owner
- GitHub repository
- GitHub token (repo permissions)

Save config and refresh issues.

## Can I run this without GitHub integration?
Yes. Agent and job features work locally without GitHub credentials.

## How do I add new agent actions?
See `docs/extending.md`.
