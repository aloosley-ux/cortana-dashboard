// Import modules
const express = require('express'); // Added Express for server setup
const { execSync } = require('child_process');

const app = express(); // Initialize Express app
const PORT = 3000; // Define server port

// Adding Zero-Configuration Detection Endpoint
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
  } catch {
    res.status(500).json({ error: 'Failed to auto-detect configuration.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});