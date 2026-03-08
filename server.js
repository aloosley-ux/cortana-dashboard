const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'openclaw.db');
const CONFIG_PATH = path.join(ROOT, 'config.json');

app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please retry shortly.' },
  })
);

const db = new Database(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'stopped',
  last_activity TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  agent_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  source_type TEXT,
  source_id TEXT,
  scheduled_for TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'backlog',
  priority TEXT DEFAULT 'medium',
  assignee_id INTEGER,
  tags TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'draft',
  content_type TEXT DEFAULT 'article',
  body TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT,
  all_day INTEGER DEFAULT 0,
  recurring TEXT DEFAULT '',
  linked_task_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  linked_task_id INTEGER,
  version INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`);

try { db.exec('ALTER TABLE agents ADD COLUMN department TEXT DEFAULT "general"'); } catch (e) { /* column exists */ }

const nowIso = () => new Date().toISOString();

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaults = {
      github: { owner: '', repo: '', token: '' },
      automation: { autoPushAfterCompletedJobs: false },
      costs: { perCompletedJobUsd: 0.02 },
      database: { type: 'sqlite', path: './openclaw.db' },
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
}

const writeConfig = (config) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
const logActivity = (entityType, entityId, message) =>
  db.prepare('INSERT INTO activity_logs(entity_type, entity_id, message, created_at) VALUES(?, ?, ?, ?)').run(
    entityType,
    entityId ?? null,
    message,
    nowIso()
  );

const getAgent = db.prepare('SELECT * FROM agents WHERE id = ?');
const getJob = db.prepare('SELECT * FROM jobs WHERE id = ?');
const getTask = db.prepare('SELECT * FROM tasks WHERE id = ?');
const getContent = db.prepare('SELECT * FROM content WHERE id = ?');
const getEvent = db.prepare('SELECT * FROM events WHERE id = ?');
const getMemory = db.prepare('SELECT * FROM memories WHERE id = ?');

app.get('/api/agents', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents ORDER BY id DESC').all().map((agent) => ({
    ...agent,
    cpuPercent: agent.status === 'running' ? 8 + (agent.id % 5) * 6 : 0,
    memoryMb: agent.status === 'running' ? 120 + (agent.id % 7) * 15 : 48,
  }));
  res.json(agents);
});

app.post('/api/agents', (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const result = db
    .prepare('INSERT INTO agents(name, role, status, last_activity) VALUES(?, ?, ?, ?)')
    .run(name.trim(), role.trim(), 'stopped', nowIso());
  logActivity('agent', result.lastInsertRowid, `Added agent ${name}`);
  return res.status(201).json(getAgent.get(result.lastInsertRowid));
});

app.post('/api/agents/:id/:action', (req, res) => {
  const id = Number(req.params.id);
  const action = req.params.action;
  if (!['start', 'stop'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  const agent = getAgent.get(id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  db.prepare('UPDATE agents SET status = ?, last_activity = ? WHERE id = ?').run(
    action === 'start' ? 'running' : 'stopped',
    nowIso(),
    id
  );
  const pastTense = action === 'start' ? 'started' : 'stopped';
  logActivity('agent', id, `${pastTense} agent ${agent.name}`);
  return res.json(getAgent.get(id));
});

app.delete('/api/agents/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getAgent.get(id)) return res.status(404).json({ error: 'Agent not found' });
  db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  logActivity('agent', id, 'Removed agent');
  return res.status(204).send();
});

app.post('/api/agents/:id/chat', (req, res) => {
  const id = Number(req.params.id);
  const { message } = req.body;
  const agent = getAgent.get(id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  if (!message) return res.status(400).json({ error: 'message is required' });
  db.prepare('UPDATE agents SET last_activity = ? WHERE id = ?').run(nowIso(), id);
  logActivity('agent', id, `Chat: ${message}`);
  res.json({ reply: `[${agent.name}] acknowledged: ${message}`, timestamp: nowIso() });
});

app.get('/api/jobs', (req, res) => {
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY id DESC').all();
  const summary = jobs.reduce(
    (acc, job) => ({ ...acc, [job.status]: (acc[job.status] || 0) + 1 }),
    { pending: 0, active: 0, completed: 0, failed: 0, stopped: 0 }
  );
  res.json({ jobs, summary });
});

app.post('/api/jobs', (req, res) => {
  const { title, agentId, sourceType, sourceId } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const result = db
    .prepare('INSERT INTO jobs(title, agent_id, status, source_type, source_id, scheduled_for, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(title.trim(), agentId || null, 'pending', sourceType || 'manual', sourceId || '', null, nowIso());
  logActivity('job', result.lastInsertRowid, `Queued job ${title}`);
  return res.status(201).json(getJob.get(result.lastInsertRowid));
});

app.post('/api/jobs/:id/:action', (req, res) => {
  const id = Number(req.params.id);
  const action = req.params.action;
  if (!['start', 'stop', 'retry', 'complete', 'reschedule'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  const job = getJob.get(id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const statuses = { start: 'active', stop: 'stopped', retry: 'pending', complete: 'completed', reschedule: 'pending' };
  const actionText = {
    start: 'started',
    stop: 'stopped',
    retry: 'retried',
    complete: 'completed',
    reschedule: 'rescheduled',
  };
  const scheduledFor = action === 'reschedule' ? req.body?.scheduledFor || new Date(Date.now() + 3600000).toISOString() : null;
  db.prepare('UPDATE jobs SET status = ?, updated_at = ?, scheduled_for = COALESCE(?, scheduled_for) WHERE id = ?').run(
    statuses[action],
    nowIso(),
    scheduledFor,
    id
  );
  logActivity('job', id, `${actionText[action]} job ${job.title}`);
  return res.json(getJob.get(id));
});

app.get('/api/activity', (req, res) => res.json(db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 200').all()));

app.get('/api/monitoring', (req, res) => {
  const memory = process.memoryUsage();
  const completedJobs = db.prepare('SELECT COUNT(*) AS count FROM jobs WHERE status = ?').get('completed').count;
  const costRate = Number(readConfig().costs?.perCompletedJobUsd || 0);
  res.json({
    uptimeSeconds: Math.floor(process.uptime()),
    memory: { rssMb: Number((memory.rss / 1048576).toFixed(2)), heapUsedMb: Number((memory.heapUsed / 1048576).toFixed(2)) },
    thresholds: { rssMbWarning: 512, heapUsedMbWarning: 256 },
    estimatedCost: Number((completedJobs * costRate).toFixed(4)),
  });
});

function runGit(args) {
  const safe = args.filter((arg) => typeof arg === 'string' && !arg.includes('\n') && !arg.includes('\r'));
  return new Promise((resolve, reject) => {
    execFile('git', safe, { cwd: ROOT }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      return resolve(stdout.trim());
    });
  });
}

app.get('/api/git/status', async (req, res) => {
  try {
    res.json({ status: (await runGit(['status', '--short'])) || 'Working tree clean' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/git/history', async (req, res) => {
  try {
    res.json({ history: (await runGit(['--no-pager', 'log', '--oneline', '-10'])) || 'No commits found' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/git/:action', async (req, res) => {
  try {
    const { action } = req.params;
    if (!['commit', 'pull', 'push'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    let output = '';
    if (action === 'commit') {
      const message = (req.body?.message || '').trim();
      if (!message) return res.status(400).json({ error: 'message is required' });
      await runGit(['add', '.']);
      output = await runGit(['commit', '-m', message]);
    } else if (action === 'pull') {
      output = await runGit(['pull', '--rebase']);
    } else {
      output = await runGit(['push']);
    }
    logActivity('git', null, `${action} executed`);
    return res.json({ output });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', (req, res) => res.json(readConfig()));
app.put('/api/config', (req, res) => {
  if (!req.body || typeof req.body !== 'object') return res.status(400).json({ error: 'Invalid config payload' });
  const hasGithub = req.body.github && typeof req.body.github === 'object';
  const hasCosts = req.body.costs && typeof req.body.costs === 'object';
  const hasAutomation = req.body.automation && typeof req.body.automation === 'object';
  if (!hasGithub || !hasCosts || !hasAutomation) {
    return res.status(400).json({ error: 'Config must include github, costs, and automation sections' });
  }
  if (Number.isNaN(Number(req.body.costs.perCompletedJobUsd))) {
    return res.status(400).json({ error: 'costs.perCompletedJobUsd must be numeric' });
  }
  writeConfig(req.body);
  logActivity('system', null, 'Configuration updated');
  return res.json(req.body);
});

async function githubRequest(endpoint, method = 'GET', body = null) {
  const { github } = readConfig();
  if (!github?.token || !github?.owner || !github?.repo) {
    throw new Error('GitHub is not configured. Set owner, repo, and token in Config.');
  }
  const response = await fetch(`https://api.github.com/repos/${github.owner}/${github.repo}${endpoint}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${github.token}`,
      'User-Agent': 'openclaw-dashboard',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? {} : response.json();
}

app.get('/api/github/issues', async (req, res) => {
  try {
    const state = req.query.state || 'open';
    const issues = await githubRequest(`/issues?state=${encodeURIComponent(state)}&per_page=30`);
    res.json(issues);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/github/issues/:number/assign', async (req, res) => {
  try {
    const issueNumber = Number(req.params.number);
    const agent = getAgent.get(Number(req.body?.agentId));
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const result = await githubRequest(`/issues/${issueNumber}/comments`, 'POST', {
      body: `Assigned to OpenClaw agent **${agent.name}** (${agent.role}) from dashboard.`,
    });
    logActivity('github', issueNumber, `Issue #${issueNumber} assigned to ${agent.name}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/github/issues/:number/comment', async (req, res) => {
  try {
    if (!req.body?.body) return res.status(400).json({ error: 'body is required' });
    const issueNumber = Number(req.params.number);
    const result = await githubRequest(`/issues/${issueNumber}/comments`, 'POST', { body: req.body.body });
    logActivity('github', issueNumber, `Commented on issue #${issueNumber}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/github/issues/:number/close', async (req, res) => {
  try {
    const issueNumber = Number(req.params.number);
    const result = await githubRequest(`/issues/${issueNumber}`, 'PATCH', { state: 'closed' });
    logActivity('github', issueNumber, `Closed issue #${issueNumber}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Tasks (Kanban Board) ---
app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY id DESC').all();
  res.json(tasks);
});

app.post('/api/tasks', (req, res) => {
  const { title, description, status, priority, assignee_id, tags } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validStatuses = ['backlog', 'in_progress', 'blocked', 'completed'];
  const taskStatus = validStatuses.includes(status) ? status : 'backlog';
  const result = db
    .prepare('INSERT INTO tasks(title, description, status, priority, assignee_id, tags, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
    .run(title.trim(), (description || '').trim(), taskStatus, priority || 'medium', assignee_id || null, tags || '', nowIso(), nowIso());
  logActivity('task', result.lastInsertRowid, `Created task ${title}`);
  return res.status(201).json(getTask.get(result.lastInsertRowid));
});

app.put('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = getTask.get(id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, description, status, priority, assignee_id, tags } = req.body;
  const validStatuses = ['backlog', 'in_progress', 'blocked', 'completed'];
  db.prepare('UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, tags = ?, updated_at = ? WHERE id = ?')
    .run(
      (title || task.title).trim(),
      description !== undefined ? description.trim() : task.description,
      validStatuses.includes(status) ? status : task.status,
      priority || task.priority,
      assignee_id !== undefined ? assignee_id : task.assignee_id,
      tags !== undefined ? tags : task.tags,
      nowIso(),
      id
    );
  logActivity('task', id, `Updated task ${title || task.title}`);
  return res.json(getTask.get(id));
});

app.delete('/api/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getTask.get(id)) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  logActivity('task', id, 'Removed task');
  return res.status(204).send();
});

// --- Content Pipeline ---
app.get('/api/content', (req, res) => {
  const items = db.prepare('SELECT * FROM content ORDER BY id DESC').all();
  res.json(items);
});

app.post('/api/content', (req, res) => {
  const { title, stage, content_type, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const validStages = ['draft', 'review', 'approved', 'published'];
  const result = db
    .prepare('INSERT INTO content(title, stage, content_type, body, version, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(title.trim(), validStages.includes(stage) ? stage : 'draft', content_type || 'article', (body || '').trim(), 1, nowIso(), nowIso());
  logActivity('content', result.lastInsertRowid, `Created content ${title}`);
  return res.status(201).json(getContent.get(result.lastInsertRowid));
});

app.put('/api/content/:id', (req, res) => {
  const id = Number(req.params.id);
  const item = getContent.get(id);
  if (!item) return res.status(404).json({ error: 'Content not found' });
  const { title, stage, content_type, body } = req.body;
  const validStages = ['draft', 'review', 'approved', 'published'];
  const newVersion = body !== undefined && body !== item.body ? item.version + 1 : item.version;
  db.prepare('UPDATE content SET title = ?, stage = ?, content_type = ?, body = ?, version = ?, updated_at = ? WHERE id = ?')
    .run(
      (title || item.title).trim(),
      validStages.includes(stage) ? stage : item.stage,
      content_type || item.content_type,
      body !== undefined ? body.trim() : item.body,
      newVersion,
      nowIso(),
      id
    );
  logActivity('content', id, `Updated content ${title || item.title}`);
  return res.json(getContent.get(id));
});

app.delete('/api/content/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getContent.get(id)) return res.status(404).json({ error: 'Content not found' });
  db.prepare('DELETE FROM content WHERE id = ?').run(id);
  logActivity('content', id, 'Removed content');
  return res.status(204).send();
});

// --- Calendar Events ---
app.get('/api/events', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY start_date ASC').all();
  res.json(events);
});

app.post('/api/events', (req, res) => {
  const { title, description, start_date, end_date, all_day, recurring, linked_task_id } = req.body;
  if (!title || !start_date) return res.status(400).json({ error: 'title and start_date are required' });
  const result = db
    .prepare('INSERT INTO events(title, description, start_date, end_date, all_day, recurring, linked_task_id, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
    .run(title.trim(), (description || '').trim(), start_date, end_date || null, all_day ? 1 : 0, recurring || '', linked_task_id || null, nowIso());
  logActivity('event', result.lastInsertRowid, `Created event ${title}`);
  return res.status(201).json(getEvent.get(result.lastInsertRowid));
});

app.put('/api/events/:id', (req, res) => {
  const id = Number(req.params.id);
  const event = getEvent.get(id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const { title, description, start_date, end_date, all_day, recurring, linked_task_id } = req.body;
  db.prepare('UPDATE events SET title = ?, description = ?, start_date = ?, end_date = ?, all_day = ?, recurring = ?, linked_task_id = ? WHERE id = ?')
    .run(
      (title || event.title).trim(),
      description !== undefined ? description.trim() : event.description,
      start_date || event.start_date,
      end_date !== undefined ? end_date : event.end_date,
      all_day !== undefined ? (all_day ? 1 : 0) : event.all_day,
      recurring !== undefined ? recurring : event.recurring,
      linked_task_id !== undefined ? linked_task_id : event.linked_task_id,
      id
    );
  logActivity('event', id, `Updated event ${title || event.title}`);
  return res.json(getEvent.get(id));
});

app.delete('/api/events/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getEvent.get(id)) return res.status(404).json({ error: 'Event not found' });
  db.prepare('DELETE FROM events WHERE id = ?').run(id);
  logActivity('event', id, 'Removed event');
  return res.status(204).send();
});

// --- Memory System ---
app.get('/api/memories', (req, res) => {
  const memories = db.prepare('SELECT * FROM memories ORDER BY id DESC').all();
  res.json(memories);
});

app.post('/api/memories', (req, res) => {
  const { title, content, tags, linked_task_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const result = db
    .prepare('INSERT INTO memories(title, content, tags, linked_task_id, version, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?)')
    .run(title.trim(), (content || '').trim(), tags || '', linked_task_id || null, 1, nowIso(), nowIso());
  logActivity('memory', result.lastInsertRowid, `Created memory ${title}`);
  return res.status(201).json(getMemory.get(result.lastInsertRowid));
});

app.put('/api/memories/:id', (req, res) => {
  const id = Number(req.params.id);
  const memory = getMemory.get(id);
  if (!memory) return res.status(404).json({ error: 'Memory not found' });
  const { title, content, tags, linked_task_id } = req.body;
  const newVersion = content !== undefined && content !== memory.content ? memory.version + 1 : memory.version;
  db.prepare('UPDATE memories SET title = ?, content = ?, tags = ?, linked_task_id = ?, version = ?, updated_at = ? WHERE id = ?')
    .run(
      (title || memory.title).trim(),
      content !== undefined ? content.trim() : memory.content,
      tags !== undefined ? tags : memory.tags,
      linked_task_id !== undefined ? linked_task_id : memory.linked_task_id,
      newVersion,
      nowIso(),
      id
    );
  logActivity('memory', id, `Updated memory ${title || memory.title}`);
  return res.json(getMemory.get(id));
});

app.delete('/api/memories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!getMemory.get(id)) return res.status(404).json({ error: 'Memory not found' });
  db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  logActivity('memory', id, 'Removed memory');
  return res.status(204).send();
});

// --- Global Search ---
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ tasks: [], content: [], memories: [], agents: [] });
  const like = `%${q}%`;
  const tasks = db.prepare('SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ? OR tags LIKE ?').all(like, like, like);
  const contentItems = db.prepare('SELECT * FROM content WHERE title LIKE ? OR body LIKE ?').all(like, like);
  const memories = db.prepare('SELECT * FROM memories WHERE title LIKE ? OR content LIKE ? OR tags LIKE ?').all(like, like, like);
  const agents = db.prepare('SELECT * FROM agents WHERE name LIKE ? OR role LIKE ?').all(like, like);
  res.json({ tasks, content: contentItems, memories, agents });
});

app.use((req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    readConfig();
    console.log(`OpenClaw dashboard available at http://localhost:${PORT}`);
  });
}

module.exports = app;
