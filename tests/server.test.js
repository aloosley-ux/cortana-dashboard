const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');

test('creates and lists agents', async () => {
  const create = await request(app).post('/api/agents').send({ name: 'Agent A', role: 'triage' });
  assert.equal(create.status, 201);
  assert.equal(create.body.name, 'Agent A');

  const list = await request(app).get('/api/agents');
  assert.equal(list.status, 200);
  assert.equal(Array.isArray(list.body), true);
  assert.equal(list.body.some((agent) => agent.name === 'Agent A'), true);
});

test('creates and starts a job', async () => {
  const create = await request(app).post('/api/jobs').send({ title: 'Investigate Issue #10' });
  assert.equal(create.status, 201);

  const start = await request(app).post(`/api/jobs/${create.body.id}/start`).send({});
  assert.equal(start.status, 200);
  assert.equal(start.body.status, 'active');
});

test('rejects invalid config payload', async () => {
  const result = await request(app).put('/api/config').send({ github: {} });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /Config must include/);
});

test('rejects non-numeric cost config', async () => {
  const result = await request(app).put('/api/config').send({
    github: { owner: '', repo: '', token: '' },
    automation: { autoPushAfterCompletedJobs: false },
    costs: { perCompletedJobUsd: 'not-a-number' },
  });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /must be numeric/);
});

// --- Task Board Tests ---
test('creates, updates, and deletes a task', async () => {
  const create = await request(app).post('/api/tasks').send({ title: 'Build feature', priority: 'high', tags: 'dev,urgent' });
  assert.equal(create.status, 201);
  assert.equal(create.body.title, 'Build feature');
  assert.equal(create.body.status, 'backlog');
  assert.equal(create.body.priority, 'high');

  const update = await request(app).put(`/api/tasks/${create.body.id}`).send({ status: 'in_progress' });
  assert.equal(update.status, 200);
  assert.equal(update.body.status, 'in_progress');

  const del = await request(app).delete(`/api/tasks/${create.body.id}`);
  assert.equal(del.status, 204);
});

test('lists tasks', async () => {
  await request(app).post('/api/tasks').send({ title: 'Task A' });
  const list = await request(app).get('/api/tasks');
  assert.equal(list.status, 200);
  assert.equal(Array.isArray(list.body), true);
  assert.equal(list.body.some((t) => t.title === 'Task A'), true);
});

test('rejects task without title', async () => {
  const result = await request(app).post('/api/tasks').send({ priority: 'low' });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /title is required/);
});

// --- Content Pipeline Tests ---
test('creates and advances content through pipeline', async () => {
  const create = await request(app).post('/api/content').send({ title: 'Article One', content_type: 'article', body: 'Draft text' });
  assert.equal(create.status, 201);
  assert.equal(create.body.stage, 'draft');
  assert.equal(create.body.version, 1);

  const advance = await request(app).put(`/api/content/${create.body.id}`).send({ stage: 'review' });
  assert.equal(advance.status, 200);
  assert.equal(advance.body.stage, 'review');

  const editBody = await request(app).put(`/api/content/${create.body.id}`).send({ body: 'Updated text' });
  assert.equal(editBody.status, 200);
  assert.equal(editBody.body.version, 2);
});

// --- Calendar Event Tests ---
test('creates and lists events', async () => {
  const create = await request(app).post('/api/events').send({ title: 'Sprint Planning', start_date: '2026-03-15', all_day: true });
  assert.equal(create.status, 201);
  assert.equal(create.body.title, 'Sprint Planning');

  const list = await request(app).get('/api/events');
  assert.equal(list.status, 200);
  assert.equal(list.body.some((e) => e.title === 'Sprint Planning'), true);
});

test('rejects event without start_date', async () => {
  const result = await request(app).post('/api/events').send({ title: 'Bad Event' });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /start_date/);
});

// --- Memory System Tests ---
test('creates and updates memory with versioning', async () => {
  const create = await request(app).post('/api/memories').send({ title: 'Research Notes', content: 'Initial findings', tags: 'research' });
  assert.equal(create.status, 201);
  assert.equal(create.body.version, 1);

  const update = await request(app).put(`/api/memories/${create.body.id}`).send({ content: 'Updated findings' });
  assert.equal(update.status, 200);
  assert.equal(update.body.version, 2);
});

// --- Search Tests ---
test('global search returns matching results', async () => {
  await request(app).post('/api/tasks').send({ title: 'SearchTestItem' });
  const result = await request(app).get('/api/search?q=SearchTestItem');
  assert.equal(result.status, 200);
  assert.equal(result.body.tasks.some((t) => t.title === 'SearchTestItem'), true);
});

test('global search returns empty for no match', async () => {
  const result = await request(app).get('/api/search?q=zzz_no_match_zzz');
  assert.equal(result.status, 200);
  assert.equal(result.body.tasks.length, 0);
  assert.equal(result.body.content.length, 0);
  assert.equal(result.body.memories.length, 0);
  assert.equal(result.body.agents.length, 0);
});
