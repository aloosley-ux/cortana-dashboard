async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

const card = (title, body, actions = []) =>
  `<article class="card"><h3>${title}</h3><p>${body}</p><div class="actions">${actions
    .map((a) => `<button data-action="${a.action}" data-id="${a.id}">${a.label}</button>`)
    .join('')}</div></article>`;

async function refreshAgents() {
  const agents = await api('/api/agents');
  const target = document.getElementById('agents');
  target.innerHTML = agents.length
    ? agents
        .map((agent) =>
          card(
            `${agent.name} (${agent.role})`,
            `Status: ${agent.status} • Last activity: ${agent.last_activity || 'n/a'} • CPU: ${agent.cpuPercent}% • RAM: ${agent.memoryMb}MB`,
            [
              { label: 'Start', action: 'agent-start', id: agent.id },
              { label: 'Stop', action: 'agent-stop', id: agent.id },
              { label: 'Chat', action: 'agent-chat', id: agent.id },
              { label: 'Remove', action: 'agent-delete', id: agent.id },
            ]
          )
        )
        .join('')
    : '<p>No agents yet.</p>';
}

async function refreshJobs() {
  const { jobs, summary } = await api('/api/jobs');
  document.getElementById('job-summary').textContent = `Pending ${summary.pending} | Active ${summary.active} | Completed ${summary.completed}`;
  const target = document.getElementById('jobs');
  target.innerHTML = jobs.length
    ? jobs
        .map((job) =>
          card(
            `${job.title} (#${job.id})`,
            `Status: ${job.status} • Source: ${job.source_type || 'manual'} ${job.source_id || ''} • Updated: ${job.updated_at}`,
            [
              { label: 'Start', action: 'job-start', id: job.id },
              { label: 'Stop', action: 'job-stop', id: job.id },
              { label: 'Retry', action: 'job-retry', id: job.id },
              { label: 'Complete', action: 'job-complete', id: job.id },
              { label: 'Reschedule', action: 'job-reschedule', id: job.id },
            ]
          )
        )
        .join('')
    : '<p>No jobs queued.</p>';
}

async function refreshIssues() {
  const target = document.getElementById('issues');
  try {
    const issues = await api('/api/github/issues');
    target.innerHTML = issues.length
      ? issues
          .map((issue) =>
            card(
              `#${issue.number} ${issue.title}`,
              `${issue.state.toUpperCase()} • ${issue.pull_request ? 'PR' : 'Issue'}`,
              [
                { label: 'Assign to first agent', action: 'issue-assign', id: issue.number },
                { label: 'Comment', action: 'issue-comment', id: issue.number },
                { label: 'Close', action: 'issue-close', id: issue.number },
              ]
            )
          )
          .join('')
      : '<p>No issues or PRs found.</p>';
  } catch (error) {
    target.innerHTML = `<p>${error.message}</p>`;
  }
}

async function refreshMonitoring() {
  const data = await api('/api/monitoring');
  document.getElementById('monitoring').innerHTML = `
    <p>Uptime: ${data.uptimeSeconds}s</p>
    <p>RSS: ${data.memory.rssMb}MB (warn at ${data.thresholds.rssMbWarning}MB)</p>
    <p>Heap: ${data.memory.heapUsedMb}MB (warn at ${data.thresholds.heapUsedMbWarning}MB)</p>
    <p>Estimated cost: $${data.estimatedCost}</p>
  `;
}

async function refreshActivity() {
  const logs = await api('/api/activity');
  document.getElementById('activity').innerHTML = logs.slice(0, 30).map((log) => `<p>[${log.created_at}] (${log.entity_type}) ${log.message}</p>`).join('');
}

async function refreshConfigForm() {
  const config = await api('/api/config');
  const form = document.getElementById('config-form');
  form.owner.value = config.github?.owner || '';
  form.repo.value = config.github?.repo || '';
  form.token.value = config.github?.token || '';
  form.cost.value = config.costs?.perCompletedJobUsd || 0.02;
  form.autoPush.checked = Boolean(config.automation?.autoPushAfterCompletedJobs);
}

const refreshAll = () => Promise.all([refreshAgents(), refreshJobs(), refreshMonitoring(), refreshActivity(), refreshConfigForm()]);

function registerEvents() {
  document.getElementById('add-agent-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    await api('/api/agents', { method: 'POST', body: JSON.stringify({ name: form.name.value, role: form.role.value }) });
    form.reset();
    await refreshAll();
  });

  document.getElementById('add-job-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    await api('/api/jobs', { method: 'POST', body: JSON.stringify({ title: form.title.value, sourceId: form.sourceId.value || '' }) });
    form.reset();
    await refreshAll();
  });

  document.getElementById('config-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    await api('/api/config', {
      method: 'PUT',
      body: JSON.stringify({
        github: { owner: form.owner.value, repo: form.repo.value, token: form.token.value },
        automation: { autoPushAfterCompletedJobs: form.autoPush.checked },
        costs: { perCompletedJobUsd: Number(form.cost.value || 0) },
        database: { type: 'sqlite', path: './openclaw.db' },
      }),
    });
    await refreshAll();
    alert('Configuration saved.');
  });

  document.getElementById('refresh-issues').addEventListener('click', refreshIssues);

  document.getElementById('commit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = event.target.message.value;
    const result = await api('/api/git/commit', { method: 'POST', body: JSON.stringify({ message }) });
    document.getElementById('git-output').textContent = result.output;
    event.target.reset();
    await refreshActivity();
  });

  document.querySelectorAll('[data-git-action]').forEach((button) =>
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-git-action');
      const result = await api(`/api/git/${action}`, { method: 'POST' });
      document.getElementById('git-output').textContent = result.output;
      await refreshActivity();
    })
  );

  document.body.addEventListener('click', async (event) => {
    const action = event.target.getAttribute('data-action');
    const id = event.target.getAttribute('data-id');
    if (!action || !id) return;
    if (action === 'agent-start' || action === 'agent-stop') {
      await api(`/api/agents/${id}/${action.replace('agent-', '')}`, { method: 'POST' });
    } else if (action === 'agent-delete') {
      await api(`/api/agents/${id}`, { method: 'DELETE' });
    } else if (action === 'agent-chat') {
      const message = prompt('Message to send to agent:');
      if (message) alert((await api(`/api/agents/${id}/chat`, { method: 'POST', body: JSON.stringify({ message }) })).reply);
    } else if (action.startsWith('job-')) {
      const payload = action === 'job-reschedule' ? { scheduledFor: prompt('ISO schedule time (blank for +1h)') || undefined } : {};
      await api(`/api/jobs/${id}/${action.replace('job-', '')}`, { method: 'POST', body: JSON.stringify(payload) });
    } else if (action === 'issue-assign') {
      const agents = await api('/api/agents');
      if (!agents.length) {
        alert('Create an agent first.');
      } else {
        await api(`/api/github/issues/${id}/assign`, { method: 'POST', body: JSON.stringify({ agentId: agents[0].id }) });
      }
    } else if (action === 'issue-comment') {
      const body = prompt('Comment body:');
      if (body) await api(`/api/github/issues/${id}/comment`, { method: 'POST', body: JSON.stringify({ body }) });
    } else if (action === 'issue-close') {
      await api(`/api/github/issues/${id}/close`, { method: 'POST' });
    }
    await refreshAll();
    await refreshIssues();
  });
}

registerEvents();
refreshAll().catch((error) => alert(`Startup error: ${error.message}`));
