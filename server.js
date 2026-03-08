// Adding Zero-Configuration Detection Endpoint
const { execSync } = require('child_process');

app.get('/api/config/detect', (req, res) => {
  try {
    const openclawHome = execSync('echo %OPENCLAW_HOME%', {
      encoding: 'utf-8',
    }).trim();
    const openclawToken = execSync('echo %OPENCLAW_TOKEN%', {
      encoding: 'utf-8',
    }).trim();

    if (!openclawHome && !openclawToken) {
      return res
        .status(404)
        .json({ error: 'OpenClaw configuration not detected.' });
    }

    res.json({ openclawHome, openclawToken });
  } catch { // Improved handling without unused variable
    res.status(500).json({ error: 'Failed to auto-detect configuration.' });
  }
});
