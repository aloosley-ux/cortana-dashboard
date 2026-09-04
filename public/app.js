/* === Mission Control Dashboard — Client === */

// --- API Helper ---
async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      payload.error || `${response.status} ${response.statusText}`,
    );
  }
  if (response.status === 204) return null;
  return response.json();
}

// --- State ---
let currentView = 'dashboard';
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let allTasks = [],
  allContent = [],
  allEvents = [],
  allMemories = [],
  allAgents = [];

// --- View Routing ---
function switchView(view) {
  currentView = view;
  document
    .querySelectorAll('.view')
    .forEach((v) => v.classList.remove('active'));
  document
    .querySelectorAll('.nav-btn')
    .forEach((b) => b.classList.remove('active'));
  const viewEl = document.getElementById(`view-${view}`);
  if (viewEl) viewEl.classList.add('active');
  const navBtn = document.querySelector(`.nav-btn[data-view="${view}"]`);
  if (navBtn) navBtn.classList.add('active');
  // Load data for the view
  loadViewData(view);
}

async function loadViewData(view) {
  try {
    switch (view) {
      case 'dashboard':
        await refreshDashboard();
        break;
      case 'tasks':
        await refreshTasks();
        break;
      case 'content':
        await refreshContent();
        break;
      case 'calendar':
        await refreshCalendar();
        break;
      case 'memory':
        await refreshMemories();
        break;
      case 'team':
        await refreshTeam();
        break;
      case 'office':
        await refreshOffice();
        break;
      case 'settings':
        await refreshSettings();
        break;
    }
  } catch (e) {
    console.error(`Error loading ${view}:`);
  }
}

// --- Clock ---
function updateClock() {
  const el = document.getElementById('topbar-time');
  if (el) el.textContent = new Date().toLocaleString();
}

// --- Dashboard ---
async function refreshDashboard() {
  const [tasks, monitoring, activity] = await Promise.all([
    api('/api/tasks'),
    api('/api/monitoring'),
    api('/api/activity'),
  ]);
  allTasks = tasks;

  const stats = document.getElementById('dashboard-stats');
  const taskCounts = { backlog: 0, in_progress: 0, blocked: 0, completed: 0 };
  tasks.forEach((t) => {
    if (taskCounts[t.status] !== undefined) taskCounts[t.status]++;
  });

  stats.innerHTML = `
    <div class="stat-card"><div class="stat-label">Backlog</div><div class="stat-value">${taskCounts.backlog}</div></div>
    <div class="stat-card"><div class="stat-label">In Progress</div><div class="stat-value accent">${taskCounts.in_progress}</div></div>
    <div class="stat-card"><div class="stat-label">Blocked</div><div class="stat-value danger">${taskCounts.blocked}</div></div>
    <div class="stat-card"><div class="stat-label">Completed</div><div class="stat-value success">${taskCounts.completed}</div></div>
    <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">${formatUptime(monitoring.uptimeSeconds)}</div></div>
    <div class="stat-card"><div class="stat-label">Est. Cost</div><div class="stat-value warning">$${monitoring.estimatedCost}</div></div>
  `;

  const actEl = document.getElementById('dashboard-activity');
  actEl.innerHTML =
    activity
      .slice(0, 20)
      .map(
        (log) =>
          `<div class="activity-item"><span class="activity-time">${formatDate(log.created_at)}</span><span class="activity-type">${log.entity_type}</span><span class="activity-msg">${escapeHtml(log.message)}</span></div>`,
      )
      .join('') || '<div class="empty-state">No activity yet</div>';

  const monEl = document.getElementById('dashboard-monitoring');
  monEl.innerHTML = `
    <div class="activity-item"><span class="activity-type">RSS</span><span class="activity-msg">${monitoring.memory.rssMb} MB (warn at ${monitoring.thresholds.rssMbWarning} MB)</span></div>
    <div class="activity-item"><span class="activity-type">Heap</span><span class="activity-msg">${monitoring.memory.heapUsedMb} MB (warn at ${monitoring.thresholds.heapUsedMbWarning} MB)</span></div>
    <div class="activity-item"><span class="activity-type">Uptime</span><span class="activity-msg">${formatUptime(monitoring.uptimeSeconds)}</span></div>
  `;
}

// --- Task Board (Kanban) ---
async function refreshTasks() {
  allTasks = await api('/api/tasks');
  renderKanban();
}

function renderKanban() {
  const filter = document.getElementById('task-filter-priority').value;
  const filtered = filter
    ? allTasks.filter((t) => t.priority === filter)
    : allTasks;

  const columns = { backlog: [], in_progress: [], blocked: [], completed: [] };
  filtered.forEach((t) => {
    if (columns[t.status]) columns[t.status].push(t);
  });

  Object.entries(columns).forEach(([status, tasks]) => {
    const container = document.getElementById(`col-${status}`);
    const countEl = document.getElementById(`count-${status}`);
    if (countEl) countEl.textContent = tasks.length;
    container.innerHTML =
      tasks
        .map(
          (t) => `
      <div class="kanban-card" draggable="true" data-task-id="${t.id}">
        <div class="kanban-card-title">${escapeHtml(t.title)}</div>
        <div class="kanban-card-meta">
          <span class="priority-badge ${t.priority}">${t.priority}</span>
          ${
            t.tags
              ? t.tags
                  .split(',')
                  .map(
                    (tag) =>
                      `<span class="tag-badge">${escapeHtml(tag.trim())}</span>`,
                  )
                  .join('')
              : ''
          }
        </div>
        <div class="kanban-card-actions">
          <button class="btn btn-sm btn-secondary" data-action="edit-task" data-id="${t.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-action="delete-task" data-id="${t.id}">Delete</button>
        </div>
      </div>
    `,
        )
        .join('') || '<div class="empty-state">No tasks</div>';
  });

  setupDragAndDrop();
}

function setupDragAndDrop() {
  document.querySelectorAll('.kanban-card[draggable]').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  document.querySelectorAll('.kanban-cards').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.id.replace('col-', '');
      try {
        await api(`/api/tasks/${taskId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus }),
        });
        await refreshTasks();
      } catch (err) {
        console.error('Move failed:', err);
      }
    });
  });
}

// --- Content Pipeline ---
async function refreshContent() {
  allContent = await api('/api/content');
  renderPipeline();
}

function renderPipeline() {
  const stages = { draft: [], review: [], approved: [], published: [] };
  allContent.forEach((c) => {
    if (stages[c.stage]) stages[c.stage].push(c);
  });

  Object.entries(stages).forEach(([stage, items]) => {
    document.getElementById(`stage-${stage}`).innerHTML =
      items
        .map(
          (c) => `
      <div class="pipeline-card" data-content-id="${c.id}">
        <div class="pipeline-card-title">${escapeHtml(c.title)}</div>
        <div class="pipeline-card-meta">${c.content_type} · v${c.version} · ${formatDate(c.updated_at)}</div>
        <div class="pipeline-card-actions">
          <button class="btn btn-sm btn-secondary" data-action="edit-content" data-id="${c.id}">Edit</button>
          ${stage !== 'published' ? `<button class="btn btn-sm btn-primary" data-action="advance-content" data-id="${c.id}" data-stage="${stage}">Advance →</button>` : ''}
          <button class="btn btn-sm btn-danger" data-action="delete-content" data-id="${c.id}">Delete</button>
        </div>
      </div>
    `,
        )
        .join('') || '<div class="empty-state">Empty</div>';
  });
}

// --- Calendar ---
async function refreshCalendar() {
  allEvents = await api('/api/events');
  renderCalendar();
}

function renderCalendar() {
  const now = new Date();
  const label = document.getElementById('cal-month-label');
  label.textContent = new Date(calYear, calMonth).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startDay = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const grid = document.getElementById('calendar-grid');
  let html = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    .map((d) => `<div class="cal-day-header">${d}</div>`)
    .join('');

  // Previous month days
  const prevLastDay = new Date(calYear, calMonth, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${prevLastDay - i}</div></div>`;
  }

  // Current month days
  const todayStr = now.toISOString().slice(0, 10);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const dayEvents = allEvents.filter(
      (e) => e.start_date && e.start_date.startsWith(dateStr),
    );
    html += `<div class="cal-day${isToday ? ' today' : ''}" data-date="${dateStr}">
      <div class="cal-day-num">${d}</div>
      ${dayEvents
        .slice(0, 2)
        .map((e) => `<div class="cal-event">${escapeHtml(e.title)}</div>`)
        .join('')}
      ${dayEvents.length > 2 ? `<div class="cal-event">+${dayEvents.length - 2} more</div>` : ''}
    </div>`;
  }

  // Next month days
  const remaining = 42 - (startDay + daysInMonth);
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  grid.innerHTML = html;

  // Event list
  const eventList = document.getElementById('event-list');
  const upcoming = allEvents
    .filter((e) => e.start_date >= todayStr)
    .slice(0, 10);
  eventList.innerHTML = upcoming.length
    ? upcoming
        .map(
          (e) => `
    <div class="event-item">
      <span class="event-date">${formatDate(e.start_date)}</span>
      <span class="event-item-title">${escapeHtml(e.title)}</span>
      <div class="event-item-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-event" data-id="${e.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-action="delete-event" data-id="${e.id}">Delete</button>
      </div>
    </div>
  `,
        )
        .join('')
    : '<div class="empty-state">No upcoming events</div>';
}

// --- Memory ---
async function refreshMemories() {
  allMemories = await api('/api/memories');
  renderMemories();
}

function renderMemories(filter = '') {
  const filtered = filter
    ? allMemories.filter(
        (m) =>
          m.title.toLowerCase().includes(filter) ||
          m.content.toLowerCase().includes(filter) ||
          m.tags.toLowerCase().includes(filter),
      )
    : allMemories;

  document.getElementById('memory-grid').innerHTML = filtered.length
    ? filtered
        .map(
          (m) => `
    <div class="memory-card" data-memory-id="${m.id}">
      <div class="memory-card-title">${escapeHtml(m.title)}</div>
      <div class="memory-card-content">${escapeHtml(m.content)}</div>
      <div class="memory-card-footer">
        <span>v${m.version}</span>
        <span>${formatDate(m.updated_at)}</span>
        ${
          m.tags
            ? m.tags
                .split(',')
                .map(
                  (t) =>
                    `<span class="tag-badge">${escapeHtml(t.trim())}</span>`,
                )
                .join('')
            : ''
        }
      </div>
      <div class="memory-card-actions">
        <button class="btn btn-sm btn-secondary" data-action="edit-memory" data-id="${m.id}">Edit</button>
        <button class="btn btn-sm btn-danger" data-action="delete-memory" data-id="${m.id}">Delete</button>
      </div>
    </div>
  `,
        )
        .join('')
    : '<div class="empty-state">No memories found</div>';
}

// --- Team ---
async function refreshTeam() {
  allAgents = await api('/api/agents');
  renderTeam();
}

function renderTeam() {
  document.getElementById('team-grid').innerHTML = allAgents.length
    ? allAgents
        .map(
          (a) => `
    <div class="team-card">
      <div class="team-card-header">
        <div class="team-avatar ${a.status}">${a.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="team-name">${escapeHtml(a.name)}</div>
          <div class="team-role">${escapeHtml(a.role)}</div>
        </div>
        <span class="status-indicator ${a.status}" style="margin-left:auto">● ${a.status}</span>
      </div>
      <div class="team-info">
        <span>CPU: ${a.cpuPercent}%</span>
        <span>RAM: ${a.memoryMb}MB</span>
        <span>Dept: ${a.department || 'general'}</span>
      </div>
      <div class="team-card-actions">
        <button class="btn btn-sm btn-primary" data-action="agent-start" data-id="${a.id}">Start</button>
        <button class="btn btn-sm btn-secondary" data-action="agent-stop" data-id="${a.id}">Stop</button>
        <button class="btn btn-sm btn-secondary" data-action="agent-chat" data-id="${a.id}">Chat</button>
        <button class="btn btn-sm btn-danger" data-action="agent-delete" data-id="${a.id}">Remove</button>
      </div>
    </div>
  `,
        )
        .join('')
    : '<div class="empty-state">No agents. Click "+ Add Agent" to create one.</div>';
}

// --- Digital Office ---
async function refreshOffice() {
  allAgents = await api('/api/agents');
  renderOffice();
}

function renderOffice() {
  document.getElementById('office-floor').innerHTML = allAgents.length
    ? allAgents
        .map(
          (a) => `
    <div class="office-desk" data-agent-id="${a.id}">
      <div class="desk-status ${a.status}"></div>
      <div class="desk-avatar ${a.status}">${a.name.charAt(0).toUpperCase()}</div>
      <div class="desk-name">${escapeHtml(a.name)}</div>
      <div class="desk-role">${escapeHtml(a.role)}</div>
      <div class="desk-stats">CPU ${a.cpuPercent}% · RAM ${a.memoryMb}MB</div>
    </div>
  `,
        )
        .join('')
    : '<div class="empty-state" style="grid-column:1/-1">No agents in the office. Add agents from the Team view.</div>';
}

// --- Settings ---
async function refreshSettings() {
  const config = await api('/api/config');
  const form = document.getElementById('config-form');
  form.owner.value = config.github?.owner || '';
  form.repo.value = config.github?.repo || '';
  form.token.value = config.github?.token || '';
  form.cost.value = config.costs?.perCompletedJobUsd || 0.02;
  form.autoPush.checked = Boolean(
    config.automation?.autoPushAfterCompletedJobs,
  );
}

async function refreshIssues() {
  const target = document.getElementById('issues-list');
  try {
    const issues = await api('/api/github/issues');
    target.innerHTML = issues.length
      ? issues
          .map(
            (issue) => `
      <div class="issue-card">
        <div class="issue-card-title">#${issue.number} ${escapeHtml(issue.title)}</div>
        <div class="issue-card-meta">${issue.state.toUpperCase()} · ${issue.pull_request ? 'PR' : 'Issue'}</div>
        <div class="issue-card-actions">
          <button class="btn btn-sm btn-secondary" data-action="issue-assign" data-id="${issue.number}">Assign</button>
          <button class="btn btn-sm btn-secondary" data-action="issue-comment" data-id="${issue.number}">Comment</button>
          <button class="btn btn-sm btn-danger" data-action="issue-close" data-id="${issue.number}">Close</button>
        </div>
      </div>
    `,
          )
          .join('')
      : '<div class="empty-state">No issues or PRs found</div>';
  } catch (error) {
    target.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

// --- Global Search ---
let searchTimeout;
async function handleSearch(query) {
  const results = document.getElementById('search-results');
  if (!query.trim()) {
    results.style.display = 'none';
    return;
  }

  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
    let html = '';
    if (data.tasks.length) {
      html += `<div class="search-category"><h4>Tasks (${data.tasks.length})</h4>${data.tasks.map((t) => `<div class="search-item" data-action="goto-task" data-id="${t.id}">${escapeHtml(t.title)} <span style="color:var(--text-muted)">· ${t.status}</span></div>`).join('')}</div>`;
    }
    if (data.content.length) {
      html += `<div class="search-category"><h4>Content (${data.content.length})</h4>${data.content.map((c) => `<div class="search-item" data-action="goto-content" data-id="${c.id}">${escapeHtml(c.title)} <span style="color:var(--text-muted)">· ${c.stage}</span></div>`).join('')}</div>`;
    }
    if (data.memories.length) {
      html += `<div class="search-category"><h4>Memories (${data.memories.length})</h4>${data.memories.map((m) => `<div class="search-item" data-action="goto-memory" data-id="${m.id}">${escapeHtml(m.title)}</div>`).join('')}</div>`;
    }
    if (data.agents.length) {
      html += `<div class="search-category"><h4>Agents (${data.agents.length})</h4>${data.agents.map((a) => `<div class="search-item" data-action="goto-agent" data-id="${a.id}">${escapeHtml(a.name)} <span style="color:var(--text-muted)">· ${a.role}</span></div>`).join('')}</div>`;
    }
    if (!html) html = '<div class="empty-state">No results found</div>';
    results.innerHTML = html;
    results.style.display = 'block';
  } catch (e) {
    results.style.display = 'none';
  }
}

// --- Modal Helper ---
function openModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// --- Utility Functions ---
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// --- Event Registration ---
function registerEvents() {
  // Sidebar navigation
  document
    .querySelectorAll('.nav-btn')
    .forEach((btn) =>
      btn.addEventListener('click', () => switchView(btn.dataset.view)),
    );

  // Mobile menu toggle
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Global search
  document.getElementById('global-search').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
  });

  // Close search on outside click
  document.addEventListener('click', (e) => {
    if (
      !e.target.closest('.search-wrapper') &&
      !e.target.closest('.search-results')
    ) {
      document.getElementById('search-results').style.display = 'none';
    }
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Task filter
  document
    .getElementById('task-filter-priority')
    .addEventListener('change', renderKanban);

  // Add Task
  document.getElementById('add-task-btn').addEventListener('click', () => {
    openModal(
      'New Task',
      `
      <form id="modal-task-form" class="form-stack">
        <label class="form-label">Title <input class="input-field" name="title" required /></label>
        <label class="form-label">Description <textarea class="input-field" name="description"></textarea></label>
        <label class="form-label">Priority
          <select class="select-input" name="priority" style="width:100%">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label class="form-label">Tags (comma-separated) <input class="input-field" name="tags" placeholder="bug, feature" /></label>
        <button class="btn btn-primary" type="submit">Create Task</button>
      </form>
    `,
    );
    document
      .getElementById('modal-task-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await api('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title: f.title.value,
            description: f.description.value,
            priority: f.priority.value,
            tags: f.tags.value,
          }),
        });
        closeModal();
        await refreshTasks();
      });
  });

  // Add Content
  document.getElementById('add-content-btn').addEventListener('click', () => {
    openModal(
      'New Content',
      `
      <form id="modal-content-form" class="form-stack">
        <label class="form-label">Title <input class="input-field" name="title" required /></label>
        <label class="form-label">Type
          <select class="select-input" name="content_type" style="width:100%">
            <option value="article">Article</option>
            <option value="script">Script</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
        </label>
        <label class="form-label">Body <textarea class="input-field" name="body" rows="5"></textarea></label>
        <button class="btn btn-primary" type="submit">Create Content</button>
      </form>
    `,
    );
    document
      .getElementById('modal-content-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await api('/api/content', {
          method: 'POST',
          body: JSON.stringify({
            title: f.title.value,
            content_type: f.content_type.value,
            body: f.body.value,
          }),
        });
        closeModal();
        await refreshContent();
      });
  });

  // Add Event
  document.getElementById('add-event-btn').addEventListener('click', () => {
    openModal(
      'New Event',
      `
      <form id="modal-event-form" class="form-stack">
        <label class="form-label">Title <input class="input-field" name="title" required /></label>
        <label class="form-label">Description <textarea class="input-field" name="description"></textarea></label>
        <label class="form-label">Start Date <input class="input-field" name="start_date" type="date" required /></label>
        <label class="form-label">End Date <input class="input-field" name="end_date" type="date" /></label>
        <label class="form-label checkbox-label"><input name="all_day" type="checkbox" checked /> All Day</label>
        <label class="form-label">Recurring
          <select class="select-input" name="recurring" style="width:100%">
            <option value="">None</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Create Event</button>
      </form>
    `,
    );
    document
      .getElementById('modal-event-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await api('/api/events', {
          method: 'POST',
          body: JSON.stringify({
            title: f.title.value,
            description: f.description.value,
            start_date: f.start_date.value,
            end_date: f.end_date.value || null,
            all_day: f.all_day.checked,
            recurring: f.recurring.value,
          }),
        });
        closeModal();
        await refreshCalendar();
      });
  });

  // Add Memory
  document.getElementById('add-memory-btn').addEventListener('click', () => {
    openModal(
      'New Memory',
      `
      <form id="modal-memory-form" class="form-stack">
        <label class="form-label">Title <input class="input-field" name="title" required /></label>
        <label class="form-label">Content <textarea class="input-field" name="content" rows="5"></textarea></label>
        <label class="form-label">Tags (comma-separated) <input class="input-field" name="tags" placeholder="research, agent-config" /></label>
        <button class="btn btn-primary" type="submit">Create Memory</button>
      </form>
    `,
    );
    document
      .getElementById('modal-memory-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await api('/api/memories', {
          method: 'POST',
          body: JSON.stringify({
            title: f.title.value,
            content: f.content.value,
            tags: f.tags.value,
          }),
        });
        closeModal();
        await refreshMemories();
      });
  });

  // Add Agent
  document.getElementById('add-agent-btn').addEventListener('click', () => {
    openModal(
      'Add Agent',
      `
      <form id="modal-agent-form" class="form-stack">
        <label class="form-label">Name <input class="input-field" name="name" required /></label>
        <label class="form-label">Role <input class="input-field" name="role" placeholder="e.g. triage, developer" required /></label>
        <button class="btn btn-primary" type="submit">Add Agent</button>
      </form>
    `,
    );
    document
      .getElementById('modal-agent-form')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await api('/api/agents', {
          method: 'POST',
          body: JSON.stringify({ name: f.name.value, role: f.role.value }),
        });
        closeModal();
        await refreshTeam();
      });
  });

  // Memory search
  document.getElementById('memory-search').addEventListener('input', (e) => {
    renderMemories(e.target.value.toLowerCase());
  });

  // Calendar navigation
  function changeMonth(delta) {
    calMonth += delta;
    if (calMonth > 11) {
      calMonth = 0;
      calYear++;
    } else if (calMonth < 0) {
      calMonth = 11;
      calYear--;
    }
    renderCalendar();
  }
  document
    .getElementById('cal-prev')
    .addEventListener('click', () => changeMonth(-1));
  document
    .getElementById('cal-next')
    .addEventListener('click', () => changeMonth(1));
  document.getElementById('cal-today').addEventListener('click', () => {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    renderCalendar();
  });

  // Config form
  document
    .getElementById('config-form')
    .addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      await api('/api/config', {
        method: 'PUT',
        body: JSON.stringify({
          github: {
            owner: form.owner.value,
            repo: form.repo.value,
            token: form.token.value,
          },
          automation: { autoPushAfterCompletedJobs: form.autoPush.checked },
          costs: { perCompletedJobUsd: Number(form.cost.value || 0) },
          database: { type: 'sqlite', path: './openclaw.db' },
        }),
      });
      openModal('Success', '<p>Configuration saved successfully.</p>');
    });

  // Git operations
  document
    .getElementById('commit-form')
    .addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = event.target.message.value;
      const result = await api('/api/git/commit', {
        method: 'POST',
        body: JSON.stringify({ message }),
      });
      document.getElementById('git-output').textContent = result.output;
      event.target.reset();
    });

  document.querySelectorAll('[data-git-action]').forEach((button) =>
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-git-action');
      const result = await api(`/api/git/${action}`, { method: 'POST' });
      document.getElementById('git-output').textContent = result.output;
    }),
  );

  // Refresh issues
  document
    .getElementById('refresh-issues')
    .addEventListener('click', refreshIssues);

  // Global click handler for dynamic actions
  document.body.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      // Agent actions
      if (action === 'agent-start' || action === 'agent-stop') {
        await api(`/api/agents/${id}/${action.replace('agent-', '')}`, {
          method: 'POST',
        });
        if (currentView === 'team') await refreshTeam();
        else if (currentView === 'office') await refreshOffice();
      } else if (action === 'agent-delete') {
        await api(`/api/agents/${id}`, { method: 'DELETE' });
        if (currentView === 'team') await refreshTeam();
        else if (currentView === 'office') await refreshOffice();
      } else if (action === 'agent-chat') {
        const message = prompt('Message to send to agent:');
        if (message) {
          const resp = await api(`/api/agents/${id}/chat`, {
            method: 'POST',
            body: JSON.stringify({ message }),
          });
          openModal('Agent Response', `<p>${escapeHtml(resp.reply)}</p>`);
        }
      }
      // Task actions
      else if (action === 'edit-task') {
        const task = allTasks.find((t) => t.id === Number(id));
        if (!task) return;
        openModal(
          'Edit Task',
          `
          <form id="modal-edit-task" class="form-stack">
            <label class="form-label">Title <input class="input-field" name="title" value="${escapeHtml(task.title)}" required /></label>
            <label class="form-label">Description <textarea class="input-field" name="description">${escapeHtml(task.description)}</textarea></label>
            <label class="form-label">Status
              <select class="select-input" name="status" style="width:100%">
                <option value="backlog" ${task.status === 'backlog' ? 'selected' : ''}>Backlog</option>
                <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
              </select>
            </label>
            <label class="form-label">Priority
              <select class="select-input" name="priority" style="width:100%">
                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option>
                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option>
                <option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option>
              </select>
            </label>
            <label class="form-label">Tags <input class="input-field" name="tags" value="${escapeHtml(task.tags)}" /></label>
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </form>
        `,
        );
        document
          .getElementById('modal-edit-task')
          .addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.target;
            await api(`/api/tasks/${id}`, {
              method: 'PUT',
              body: JSON.stringify({
                title: f.title.value,
                description: f.description.value,
                status: f.status.value,
                priority: f.priority.value,
                tags: f.tags.value,
              }),
            });
            closeModal();
            await refreshTasks();
          });
      } else if (action === 'delete-task') {
        await api(`/api/tasks/${id}`, { method: 'DELETE' });
        await refreshTasks();
      }
      // Content actions
      else if (action === 'edit-content') {
        const item = allContent.find((c) => c.id === Number(id));
        if (!item) return;
        openModal(
          'Edit Content',
          `
          <form id="modal-edit-content" class="form-stack">
            <label class="form-label">Title <input class="input-field" name="title" value="${escapeHtml(item.title)}" required /></label>
            <label class="form-label">Stage
              <select class="select-input" name="stage" style="width:100%">
                <option value="draft" ${item.stage === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="review" ${item.stage === 'review' ? 'selected' : ''}>Review</option>
                <option value="approved" ${item.stage === 'approved' ? 'selected' : ''}>Approved</option>
                <option value="published" ${item.stage === 'published' ? 'selected' : ''}>Published</option>
              </select>
            </label>
            <label class="form-label">Body <textarea class="input-field" name="body" rows="8">${escapeHtml(item.body)}</textarea></label>
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </form>
        `,
        );
        document
          .getElementById('modal-edit-content')
          .addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.target;
            await api(`/api/content/${id}`, {
              method: 'PUT',
              body: JSON.stringify({
                title: f.title.value,
                stage: f.stage.value,
                body: f.body.value,
              }),
            });
            closeModal();
            await refreshContent();
          });
      } else if (action === 'advance-content') {
        const stages = ['draft', 'review', 'approved', 'published'];
        const current = btn.dataset.stage;
        const nextIdx = stages.indexOf(current) + 1;
        if (nextIdx < stages.length) {
          await api(`/api/content/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ stage: stages[nextIdx] }),
          });
          await refreshContent();
        }
      } else if (action === 'delete-content') {
        await api(`/api/content/${id}`, { method: 'DELETE' });
        await refreshContent();
      }
      // Event actions
      else if (action === 'edit-event') {
        const ev = allEvents.find((e) => e.id === Number(id));
        if (!ev) return;
        openModal(
          'Edit Event',
          `
          <form id="modal-edit-event" class="form-stack">
            <label class="form-label">Title <input class="input-field" name="title" value="${escapeHtml(ev.title)}" required /></label>
            <label class="form-label">Description <textarea class="input-field" name="description">${escapeHtml(ev.description)}</textarea></label>
            <label class="form-label">Start Date <input class="input-field" name="start_date" type="date" value="${ev.start_date ? ev.start_date.slice(0, 10) : ''}" required /></label>
            <label class="form-label">End Date <input class="input-field" name="end_date" type="date" value="${ev.end_date ? ev.end_date.slice(0, 10) : ''}" /></label>
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </form>
        `,
        );
        document
          .getElementById('modal-edit-event')
          .addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.target;
            await api(`/api/events/${id}`, {
              method: 'PUT',
              body: JSON.stringify({
                title: f.title.value,
                description: f.description.value,
                start_date: f.start_date.value,
                end_date: f.end_date.value || null,
              }),
            });
            closeModal();
            await refreshCalendar();
          });
      } else if (action === 'delete-event') {
        await api(`/api/events/${id}`, { method: 'DELETE' });
        await refreshCalendar();
      }
      // Memory actions
      else if (action === 'edit-memory') {
        const mem = allMemories.find((m) => m.id === Number(id));
        if (!mem) return;
        openModal(
          'Edit Memory',
          `
          <form id="modal-edit-memory" class="form-stack">
            <label class="form-label">Title <input class="input-field" name="title" value="${escapeHtml(mem.title)}" required /></label>
            <label class="form-label">Content <textarea class="input-field" name="content" rows="5">${escapeHtml(mem.content)}</textarea></label>
            <label class="form-label">Tags <input class="input-field" name="tags" value="${escapeHtml(mem.tags)}" /></label>
            <button class="btn btn-primary" type="submit">Save Changes</button>
          </form>
        `,
        );
        document
          .getElementById('modal-edit-memory')
          .addEventListener('submit', async (e) => {
            e.preventDefault();
            const f = e.target;
            await api(`/api/memories/${id}`, {
              method: 'PUT',
              body: JSON.stringify({
                title: f.title.value,
                content: f.content.value,
                tags: f.tags.value,
              }),
            });
            closeModal();
            await refreshMemories();
          });
      } else if (action === 'delete-memory') {
        await api(`/api/memories/${id}`, { method: 'DELETE' });
        await refreshMemories();
      }
      // Issue actions
      else if (action === 'issue-assign') {
        const agents = await api('/api/agents');
        if (!agents.length) {
          openModal('Error', '<p>Create an agent first.</p>');
          return;
        }
        await api(`/api/github/issues/${id}/assign`, {
          method: 'POST',
          body: JSON.stringify({ agentId: agents[0].id }),
        });
        await refreshIssues();
      } else if (action === 'issue-comment') {
        const body = prompt('Comment body:');
        if (body)
          await api(`/api/github/issues/${id}/comment`, {
            method: 'POST',
            body: JSON.stringify({ body }),
          });
      } else if (action === 'issue-close') {
        await api(`/api/github/issues/${id}/close`, { method: 'POST' });
        await refreshIssues();
      }
      // Search navigation
      else if (action === 'goto-task') {
        switchView('tasks');
        document.getElementById('search-results').style.display = 'none';
      } else if (action === 'goto-content') {
        switchView('content');
        document.getElementById('search-results').style.display = 'none';
      } else if (action === 'goto-memory') {
        switchView('memory');
        document.getElementById('search-results').style.display = 'none';
      } else if (action === 'goto-agent') {
        switchView('team');
        document.getElementById('search-results').style.display = 'none';
      }
    } catch (err) {
      openModal('Error', `<p>${escapeHtml(err.message)}</p>`);
    }
  });
}

// --- Init ---
registerEvents();
updateClock();
setInterval(updateClock, 1000);
switchView('dashboard');
