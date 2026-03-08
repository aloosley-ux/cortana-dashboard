# Frequently Asked Questions

## Does this work on Windows 11?

Yes. Use PowerShell or Command Prompt. Run `npm install` and `npm start` — no additional setup needed.

## Do I need Docker?

No. Everything runs locally with Node.js and npm. No Docker required.

## What if GitHub isn't configured?

The dashboard works fully in local-only mode. Agent management, task board, content pipeline, calendar, memory, and office features all work without any GitHub connection. Use the Settings view to add GitHub credentials when ready.

## Can I use this without internet access?

Yes. All core features (tasks, content, calendar, memory, team, office) work offline. Only the GitHub integration requires internet access.

## How do I add a new agent?

Navigate to the **Team** view and click **+ Add Agent**. Fill in the name and role, then click **Add Agent**.

## How does the Task Board drag-and-drop work?

Click and hold any task card on the Kanban board, then drag it to a different column (Backlog, In Progress, Blocked, or Completed). The task's status updates automatically.

## How do I search across everything?

Use the search bar in the top navigation. It searches across tasks, content, memories, and agents simultaneously. Click a result to navigate to the relevant view.

## Where is the data stored?

All data is stored in a local SQLite file called `openclaw.db` in the project root. This file is auto-created on first run and gitignored.

## How do I reset the database?

Delete `openclaw.db` and restart the server:
```bash
rm openclaw.db
npm start
```

## Can I add new features?

Yes. See `docs/extending.md` for a step-by-step guide to adding new modules.
