# Cortana Dashboard

## Overview
Cortana Dashboard is a unified control interface for managing OpenClaw agents and orchestrating tasks across multiple environments. With built-in support for GitHub, real-time analytics, and secure operations, it’s designed to simplify AI workflow management.

### Features
- Multi-Factor Authentication (MFA) and Role-Based Access Control (RBAC) to secure sensitive workflows.
- Real-time WebSocket communication for multi-agent coordination.
- Integrated gateway and analytics management.
- Dynamic logging and memory retrieval across all agents.
- Streamlined GitHub integration for teams.

---

## Installation

### System Requirements
- **Node.js** >= 16.x
- **npm** (bundled with Node.js)
- **Git**: Required for cloning the repository.
- **Docker Desktop** (for Windows/MacOS) or Docker Engine (Linux): For containerized deployments.
- **Windows Command Line**: Use PowerShell or Command Prompt for the steps below.

### Option 1: Local Installation (Windows/Mac/Linux)

1. **Install Dependencies:**
   - Node.js and npm: [Download Installer](https://nodejs.org/en/download).
   - Git: [Download Git for Windows](https://git-scm.com/download/win).
   
2. **Clone the Repository:**
   ```bash
   git clone https://<source>/cortana-dashboard.git
   ```

3. **Switch to the Project Folder:**
   ```bash
   cd cortana-dashboard
   ```

4. **Install Dependencies:**
   ```bash
   npm install
   ```

5. **Run the Dashboard:**
   ```bash
   npm start
   ```

6. **Access in Browser:**
   Navigate to:
   ```
   http://localhost:5173
   ```

### Option 2: Docker Deployment (Windows/Mac/Linux)

1. **Install Docker Desktop (Windows/Mac):**
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop).
   - Follow the interactive setup wizard.

2. **Enable Docker in PowerShell:**
   ```bash
   wsl --install
   ```

3. **Clone the Repository:**
   ```bash
   git clone https://<source>/cortana-dashboard.git
   cd cortana-dashboard
   ```

4. **Build and Run via Docker Compose:**
   ```bash
   docker compose up -d --build
   ```

5. **Access in Browser:**
   Navigate to:
   ```
   http://localhost:8080
   ```

---

## Usage

### API Endpoints

#### Auth APIs
- **MFA Setup**: POST `/api/auth/mfa/setup`
- **MFA Verify**: POST `/api/auth/mfa/verify`
- **RBAC Enforcement**: Controlled via middleware for sensitive routes.

#### Gateway Management
- **Add Gateway**: POST `/api/gateways/connect`
- **List Gateways**: GET `/api/gateways`

#### Analytics
- **Fetch Metrics**: GET `/api/analytics`
- **Submit Usage**: POST `/api/analytics/collect/token`
- **Log Tasks**: POST `/api/analytics/collect/task`

### Role-Based Access Controls (RBAC)
| Role      | Permissions                      |
|-----------|----------------------------------|
| Manager   | Full access                      |
| Operator  | Create tasks, update logs        |
| Viewer    | Read-only access to logs, tasks  |

---

## Continuous Development
Contributions are welcome! Follow these steps:
- Fork the repository.
- Create a new branch for your feature: `git checkout -b feature/new-feature`
- Commit changes and open a pull request.

MIT License.