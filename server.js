// Import modules
const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync, execFileSync } = require('child_process');
const Database = require('better-sqlite3');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting: 120 req/min on all /api/* routes
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// --- Database ---
// Use in-memory DB when imported (tests); file-based DB when run directly
const isMain = require.main === module;
const DB_PATH = isMain
  ? process.env.DB_PATH || './openclaw.db'
  : ':memory:';

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    role        TEXT    NOT NULL DEFAULT 'general',
    status      TEXT    NOT NULL DEFAULT 'stopped',
    department  TEXT             DEFAULT 'general',
    cpuPercent  REAL             DEFAULT 0,
    memoryMb    REAL             DEFAULT 0,
    created_at  TEXT             DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'pending',
    agent_id       INTEGER,
    scheduled_for  TEXT,
    created_at     TEXT    DEFAULT (datetime('now')),
    updated_at     TEXT    DEFAULT (datetime('now')),
    FOREIGN KEY(agent_id) REFERENCES agents(id)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT             DEFAULT '',
    status      TEXT    NOT NULL DEFAULT 'backlog',
    priority    TEXT    NOT NULL DEFAULT 'medium',
    tags        TEXT             DEFAULT '',
    assignee_id INTEGER,
    created_at  TEXT    DEFAULT (datetime('now')),
    updated_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    content_type TEXT    NOT NULL DEFAULT 'article',
    body         TEXT             DEFAULT '',
    stage        TEXT    NOT NULL DEFAULT 'draft',
    version      INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT    DEFAULT (datetime('now')),
    updated_at   TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    description TEXT             DEFAULT '',
    start_date  TEXT    NOT NULL,
    end_date    TEXT,
    all_day     INTEGER          DEFAULT 1,
    recurring   TEXT             DEFAULT '',
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS memories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    content    TEXT             DEFAULT '',
    tags       TEXT             DEFAULT '',
    version    INTEGER NOT NULL DEFAULT 1,
    created_at TEXT    DEFAULT (datetime('now')),
    updated_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT    NOT NULL,
    entity_id   INTEGER,
    message     TEXT    NOT NULL,
    created_at  TEXT    DEFAULT (datetime('now'))
  );
`);

// --- Config helpers ---
const CONFIG_PATH = path.join(__dirname, 'config.json');
const CONFIG_EXAMPLE_PATH = path.join(__dirname, 'config.example.json');

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }
  if (fs.existsSync(CONFIG_EXAMPLE_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_EXAMPLE_PATH, 'utf8'));
  }
  return {
    github: { owner: '', repo: '', token: '' },
    automation: { autoPushAfterCompletedJobs: false },
    costs: { perCompletedJobUsd: 0.02 },
    database: { type: 'sqlite', path: './openclaw.db' },
  };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function logActivity(entityType, entityId, message) {
  db.prepare(
    'INSERT INTO activity_logs (entity_type, entity_id, message) VALUES (?, ?, ?)',
  ).run(entityType, entityId, message);
}

// =====================================================================
// API Routes
// =====================================================================

// --- Config ---
app.get('/api/config', (req, res) => {
  res.json(loadConfig());
});

app.put('/api/config', (req, res) => {
  const { github, automation, costs } = req.body;
  if (!github || !automation || !costs) {
    return res
      .status(400)
      .json({ error: 'Config must include github, automation, and costs.' });
  }
  if (
    costs.perCompletedJobUsd !== undefined &&
    isNaN(Number(costs.perCompletedJobUsd))
  ) {
    return res
      .status(400)
      .json({ error: 'costs.perCompletedJobUsd must be numeric.' });
  }
  saveConfig(req.body);
  res.json({ ok: true });
});

// Zero-Configuration Detection
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

// --- Agents ---
app.get('/api/agents', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all(),
  );
});

app.post('/api/agents', (req, res) => {
  const { name, role = 'general', department = 'general' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  const result = db
    .prepare(
      'INSERT INTO agents (name, role, department) VALUES (?, ?, ?)',
    )
    .run(name, role, department);
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(result.lastInsertRowid);
  logActivity('agent', agent.id, `Agent "${name}" created.`);
  res.status(201).json(agent);
});

app.post('/api/agents/:id/start', (req, res) => {
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found.' });
  db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(
    'running',
    req.params.id,
  );
  logActivity('agent', agent.id, `Agent "${agent.name}" started.`);
  res.json(
    db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id),
  );
});

app.post('/api/agents/:id/stop', (req, res) => {
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found.' });
  db.prepare('UPDATE agents SET status = ? WHERE id = ?').run(
    'stopped',
    req.params.id,
  );
  logActivity('agent', agent.id, `Agent "${agent.name}" stopped.`);
  res.json(
    db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id),
  );
});

app.post('/api/agents/:id/chat', (req, res) => {
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found.' });
  const { message = '' } = req.body;
  logActivity('agent', agent.id, `Chat: ${message}`);
  res.json({
    reply: `[${agent.name}] received: "${message}". (Offline mode — no LLM connected)`,
  });
});

app.delete('/api/agents/:id', (req, res) => {
  const agent = db
    .prepare('SELECT * FROM agents WHERE id = ?')
    .get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found.' });
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
  logActivity(
    'agent',
    Number(req.params.id),
    `Agent "${agent.name}" deleted.`,
  );
  res.status(204).end();
});

// --- Jobs ---
app.get('/api/jobs', (req, res) => {
  res.json(db.prepare('SELECT * FROM jobs ORDER BY created_at DESC').all());
});

app.post('/api/jobs', (req, res) => {
  const { title, agent_id, scheduled_for } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required.' });
  const result = db
    .prepare(
      'INSERT INTO jobs (title, agent_id, scheduled_for) VALUES (?, ?, ?)',
    )
    .run(title, agent_id || null, scheduled_for || null);
  const job = db
    .prepare('SELECT * FROM jobs WHERE id = ?')
    .get(result.lastInsertRowid);
  logActivity('job', job.id, `Job "${title}" created.`);
  res.status(201).json(job);
});

app.post('/api/jobs/:id/start', (req, res) => {
  const job = db
    .prepare('SELECT * FROM jobs WHERE id = ?')
    .get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  db.prepare(
    "UPDATE jobs SET status = 'active', updated_at = datetime('now') WHERE id = ?",
  ).run(req.params.id);
  logActivity('job', job.id, `Job "${job.title}" started.`);
  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
});

app.post('/api/jobs/:id/complete', (req, res) => {
  const job = db
    .prepare('SELECT * FROM jobs WHERE id = ?')
    .get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  db.prepare(
    "UPDATE jobs SET status = 'completed', updated_at = datetime('now') WHERE id = ?",
  ).run(req.params.id);
  logActivity('job', job.id, `Job "${job.title}" completed.`);
  res.json(db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id));
});

app.delete('/api/jobs/:id', (req, res) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Tasks ---
app.get('/api/tasks', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all(),
  );
});

app.post('/api/tasks', (req, res) => {
  const {
    title,
    description = '',
    priority = 'medium',
    tags = '',
    assignee_id,
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required.' });
  const result = db
    .prepare(
      'INSERT INTO tasks (title, description, priority, tags, assignee_id) VALUES (?, ?, ?, ?, ?)',
    )
    .run(title, description, priority, tags, assignee_id || null);
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(result.lastInsertRowid);
  logActivity('task', task.id, `Task "${title}" created.`);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', (req, res) => {
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  const fields = { ...task, ...req.body };
  db.prepare(
    "UPDATE tasks SET title=?, description=?, status=?, priority=?, tags=?, updated_at=datetime('now') WHERE id=?",
  ).run(
    fields.title,
    fields.description,
    fields.status,
    fields.priority,
    fields.tags,
    req.params.id,
  );
  logActivity('task', task.id, `Task "${task.title}" updated.`);
  res.json(
    db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id),
  );
});

app.delete('/api/tasks/:id', (req, res) => {
  const task = db
    .prepare('SELECT * FROM tasks WHERE id = ?')
    .get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  logActivity(
    'task',
    Number(req.params.id),
    `Task "${task.title}" deleted.`,
  );
  res.status(204).end();
});

// --- Content Pipeline ---
app.get('/api/content', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM content ORDER BY created_at DESC').all(),
  );
});

app.post('/api/content', (req, res) => {
  const { title, content_type = 'article', body = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required.' });
  const result = db
    .prepare(
      'INSERT INTO content (title, content_type, body) VALUES (?, ?, ?)',
    )
    .run(title, content_type, body);
  const item = db
    .prepare('SELECT * FROM content WHERE id = ?')
    .get(result.lastInsertRowid);
  logActivity('content', item.id, `Content "${title}" created.`);
  res.status(201).json(item);
});

app.put('/api/content/:id', (req, res) => {
  const item = db
    .prepare('SELECT * FROM content WHERE id = ?')
    .get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Content not found.' });
  const newBody = req.body.body !== undefined ? req.body.body : item.body;
  const bodyChanged = newBody !== item.body;
  const newVersion = bodyChanged ? item.version + 1 : item.version;
  const fields = { ...item, ...req.body, version: newVersion, body: newBody };
  db.prepare(
    "UPDATE content SET title=?, content_type=?, body=?, stage=?, version=?, updated_at=datetime('now') WHERE id=?",
  ).run(
    fields.title,
    fields.content_type,
    fields.body,
    fields.stage,
    fields.version,
    req.params.id,
  );
  logActivity('content', item.id, `Content "${item.title}" updated.`);
  res.json(
    db.prepare('SELECT * FROM content WHERE id = ?').get(req.params.id),
  );
});

app.delete('/api/content/:id', (req, res) => {
  db.prepare('DELETE FROM content WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Calendar Events ---
app.get('/api/events', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM events ORDER BY start_date ASC').all(),
  );
});

app.post('/api/events', (req, res) => {
  const {
    title,
    description = '',
    start_date,
    end_date,
    all_day = 1,
    recurring = '',
  } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required.' });
  if (!start_date)
    return res.status(400).json({ error: 'start_date is required.' });
  const result = db
    .prepare(
      'INSERT INTO events (title, description, start_date, end_date, all_day, recurring) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(title, description, start_date, end_date || null, all_day ? 1 : 0, recurring);

  const event = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(result.lastInsertRowid);
  logActivity('event', event.id, `Event "${title}" created.`);
  res.status(201).json(event);
});

app.put('/api/events/:id', (req, res) => {
  const ev = db
    .prepare('SELECT * FROM events WHERE id = ?')
    .get(req.params.id);
  if (!ev) return res.status(404).json({ error: 'Event not found.' });
  const fields = { ...ev, ...req.body };
  db.prepare(
    'UPDATE events SET title=?, description=?, start_date=?, end_date=?, all_day=?, recurring=? WHERE id=?',
  ).run(
    fields.title,
    fields.description,
    fields.start_date,
    fields.end_date,
    fields.all_day ? 1 : 0,
    fields.recurring,
    req.params.id,
  );
  logActivity('event', ev.id, `Event "${ev.title}" updated.`);
  res.json(
    db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id),
  );
});

app.delete('/api/events/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Memory System ---
app.get('/api/memories', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM memories ORDER BY updated_at DESC').all(),
  );
});

app.post('/api/memories', (req, res) => {
  const { title, content = '', tags = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required.' });
  const result = db
    .prepare('INSERT INTO memories (title, content, tags) VALUES (?, ?, ?)')
    .run(title, content, tags);
  const mem = db
    .prepare('SELECT * FROM memories WHERE id = ?')
    .get(result.lastInsertRowid);
  logActivity('memory', mem.id, `Memory "${title}" created.`);
  res.status(201).json(mem);
});

app.put('/api/memories/:id', (req, res) => {
  const mem = db
    .prepare('SELECT * FROM memories WHERE id = ?')
    .get(req.params.id);
  if (!mem) return res.status(404).json({ error: 'Memory not found.' });
  const newContent =
    req.body.content !== undefined ? req.body.content : mem.content;
  const contentChanged = newContent !== mem.content;
  const newVersion = contentChanged ? mem.version + 1 : mem.version;
  const fields = {
    ...mem,
    ...req.body,
    version: newVersion,
    content: newContent,
  };
  db.prepare(
    "UPDATE memories SET title=?, content=?, tags=?, version=?, updated_at=datetime('now') WHERE id=?",
  ).run(
    fields.title,
    fields.content,
    fields.tags,
    fields.version,
    req.params.id,
  );
  logActivity('memory', mem.id, `Memory "${mem.title}" updated.`);
  res.json(
    db.prepare('SELECT * FROM memories WHERE id = ?').get(req.params.id),
  );
});

app.delete('/api/memories/:id', (req, res) => {
  db.prepare('DELETE FROM memories WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// --- Global Search ---
app.get('/api/search', (req, res) => {
  const q = req.query.q || '';
  const like = `%${q}%`;
  const tasks = db
    .prepare(
      'SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?',
    )
    .all(like, like, like);
  const content = db
    .prepare('SELECT * FROM content WHERE title LIKE ? OR body LIKE ?')
    .all(like, like);
  const memories = db
    .prepare(
      'SELECT * FROM memories WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?',
    )
    .all(like, like, like);
  const agents = db
    .prepare('SELECT * FROM agents WHERE name LIKE ? OR role LIKE ?')
    .all(like, like);
  res.json({ tasks, content, memories, agents });
});

// --- Monitoring ---
app.get('/api/monitoring', (req, res) => {
  const config = loadConfig();
  const mem = process.memoryUsage();
  const completedJobs = db
    .prepare("SELECT COUNT(*) AS count FROM jobs WHERE status = 'completed'")
    .get().count;
  const estimatedCost = (
    completedJobs * (config.costs?.perCompletedJobUsd || 0.02)
  ).toFixed(4);
  res.json({
    uptimeSeconds: Math.floor(process.uptime()),
    estimatedCost,
    memory: {
      rssMb: (mem.rss / 1024 / 1024).toFixed(1),
      heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(1),
    },
    thresholds: {
      rssMbWarning: 512,
      heapUsedMbWarning: 256,
    },
  });
});

// --- Activity Log ---
app.get('/api/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  res.json(
    db
      .prepare(
        'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?',
      )
      .all(limit),
  );
});

// --- Git Operations ---
function runGit(args) {
  try {
    const output = execFileSync('git', args, { encoding: 'utf-8', cwd: __dirname });
    return { ok: true, output: output.trim() };
  } catch (err) {
    return { ok: false, output: (err.stderr || err.message || '').trim() };
  }
}

app.post('/api/git/pull', (req, res) => {
  res.json(runGit(['pull']));
});

app.post('/api/git/push', (req, res) => {
  res.json(runGit(['push']));
});

app.post('/api/git/commit', (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required.' });
  const addResult = runGit(['add', '-A']);
  if (!addResult.ok) return res.status(500).json(addResult);
  const commitResult = runGit(['commit', '-m', message]);
  res.json(commitResult);
});

// --- GitHub Integration ---
async function ghFetch(apiPath, options = {}) {
  const config = loadConfig();
  const { owner, repo, token } = config.github || {};
  if (!owner || !repo || !token) {
    throw new Error('GitHub not configured. Add owner, repo, and token in Settings.');
  }
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}${apiPath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      ...options,
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `GitHub API error: ${response.status}`);
  }
  return response.json();
}

app.get('/api/github/issues', async (req, res) => {
  try {
    const issues = await ghFetch('/issues?state=open&per_page=50');
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/github/issues/:number/assign', async (req, res) => {
  try {
    const config = loadConfig();
    const assignees = req.body.assignees || [config.github?.owner].filter(Boolean);
    await ghFetch(`/issues/${req.params.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ assignees }),
    });
    logActivity(
      'github',
      Number(req.params.number),
      `Issue #${req.params.number} assigned.`,
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/github/issues/:number/comment', async (req, res) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'body is required.' });
    await ghFetch(`/issues/${req.params.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
    logActivity(
      'github',
      Number(req.params.number),
      `Comment posted on issue #${req.params.number}.`,
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/github/issues/:number/close', async (req, res) => {
  try {
    await ghFetch(`/issues/${req.params.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed' }),
    });
    logActivity(
      'github',
      Number(req.params.number),
      `Issue #${req.params.number} closed.`,
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/github/prs/create', async (req, res) => {
  const { title, head, base, body = '' } = req.body;
  if (!title || !head || !base) {
    return res
      .status(400)
      .json({ error: 'title, head, and base are required.' });
  }
  try {
    const pr = await ghFetch('/pulls', {
      method: 'POST',
      body: JSON.stringify({ title, head, base, body }),
    });
    logActivity('github', pr.number, `PR #${pr.number} created.`);
    res.status(201).json(pr);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// Start server (only when run directly, not when imported by tests)
// =====================================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;