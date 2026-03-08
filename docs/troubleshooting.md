# Troubleshooting

## Port 3000 is in use

PowerShell:
```powershell
$env:PORT=3001
npm start
```

Command Prompt:
```cmd
set PORT=3001
npm start
```

## Git push fails
Confirm local git credentials and branch permissions.

## GitHub API errors
Verify token scopes and repository values in the Setup Wizard.
