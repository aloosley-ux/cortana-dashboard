# Extending Mission Control Dashboard

## Adding a New Feature Module

1. **Add a database table** in `server.js` within the `db.exec()` block:
   ```sql
   CREATE TABLE IF NOT EXISTS your_table (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     title TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   ```

2. **Add API routes** in `server.js` before the catch-all route:
   ```javascript
   app.get('/api/your-feature', (req, res) => { ... });
   app.post('/api/your-feature', (req, res) => { ... });
   ```

3. **Add a view** in `public/index.html`:
   ```html
   <div class="view" id="view-your-feature">
     <h2 class="view-title">Your Feature</h2>
     <div id="your-feature-content"></div>
   </div>
   ```

4. **Add a sidebar button** in `index.html`:
   ```html
   <button class="nav-btn" data-view="your-feature">
     <span class="nav-icon">★</span> Your Feature
   </button>
   ```

5. **Add frontend logic** in `public/app.js`:
   - Add a `refreshYourFeature()` function
   - Add the view to the `loadViewData()` switch
   - Register any form event handlers in `registerEvents()`

6. **Log activity** for audit trail:
   ```javascript
   logActivity('your-feature', entityId, 'Description of action');
   ```

7. **Add tests** in `tests/server.test.js`.

## Adding an Agent Capability

1. Create a new endpoint in `server.js` (e.g., `/api/agents/:id/your-action`)
2. Log the action to `activity_logs`
3. Add a button in the Team view's agent card

## Production Database Support

The `config.database` section in `config.json` is the source of truth for database configuration. For production, you could swap SQLite for PostgreSQL by updating the database driver and connection handling.

## External Integrations

Add webhook endpoints that queue jobs via the `/api/jobs` API. This allows orchestration tools to trigger dashboard actions via HTTP.
