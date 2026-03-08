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
