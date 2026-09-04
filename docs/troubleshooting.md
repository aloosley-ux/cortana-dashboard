# Troubleshooting

## Common Issues

### Port 3000 in use

Set a different port using an environment variable:

**PowerShell (Windows 11):**

```powershell
$env:PORT=3001
npm start
```

**Command Prompt (Windows):**

```cmd
set PORT=3001
npm start
```

**macOS/Linux:**

```bash
PORT=3001 npm start
```

### Missing Node.js

Download and install Node.js LTS from [nodejs.org](https://nodejs.org/). Version 18 or higher is recommended.

### Permission denied on npm install

- **Windows**: Run PowerShell as Administrator
- **macOS/Linux**: Try `sudo npm install` or fix your npm permissions

### Git push fails

Check that your local git credentials are set up and that you have push permissions on the branch.

### GitHub API errors

- Verify your personal access token has the correct scopes (`repo` for private repos)
- Ensure the `owner` and `repo` values in Settings match your GitHub repository
- Check that your token hasn't expired

### Database errors

Delete the `openclaw.db` file and restart the server. The database auto-recreates with fresh tables.

```bash
rm openclaw.db
npm start
```

### Blank dashboard or missing data

- Check the browser console (F12) for JavaScript errors
- Ensure the server is running on the correct port
- Try a hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Drag-and-drop not working in Task Board

- Ensure you're using a modern browser (Chrome, Firefox, Edge)
- Click and hold the task card before dragging
