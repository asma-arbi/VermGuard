# 🛡️ VermGuard AI — Real-Time Security Operations Center (SOC) & SLA Analytics Hub Backend

> **VermGuard** is a real-time Security Operations Center (SOC) & Support Hub custom-built for **Vermeg** to streamline staff access control, audit administrative operations, and synchronize directly with Vermeg's internal Jira ticketing systems.

---

## 🌟 Backend Features & API Endpoints

### 🎫 1. Jira Service & REST Endpoints (`/jira`)
- `GET /jira/tickets?team=soc` — Fetches real-time On-Prem, SaaS Cloud (`customfield_18500`), and Security Tool (`customfield_10008`) issues from Jira.
- `POST /jira/technician-incidents` — Categorizes issues per SOC technician for a given date range.
- `POST /jira/msp/tickets` — Fetches MSP client tickets with assignee & date filters.
- `POST /jira/internals/tickets` — Fetches internal department tickets with assignee & date filters.
- `POST /jira/evaluations/sla-analytics` — Computes team volume leaderboard, Bad Titles audit (< 5 chars / generic keywords), Bad Assignments audit, MTTD (`customfield_17800`) & MTTR metrics.
- `POST /jira/comment` & `POST /jira/transition` — Adds comments and triggers status transitions directly on Jira tickets.

### 📝 2. Evaluations Service & REST Endpoints (`/evaluations`)
- `GET /evaluations/team/:period` — Retrieves monthly evaluation records for all SOC members (7 Vermeg criteria, custom criteria, draft/published status).
- `POST /evaluations` — Saves or updates monthly team member performance evaluation.
- `GET /evaluations/my/:userId` — Retrieves published evaluations for a specific SOC analyst.

### 🔔 3. WebSockets Gateway (`EventsGateway`)
- Real-time Socket.IO gateway broadcasting `evaluation_updated` events.

---

## 🛠️ Tech Stack & Setup

- **Framework**: NestJS 10 (TypeScript)
- **Database Engine**: SQLite with TypeORM
- **Jira Integration**: HTTP Basic / Token Auth via Axios HttpService
- **WebSockets**: Socket.IO Gateway

### Quick Start:
```bash
npm install
npm run start:dev
```
Backend API will run on `http://localhost:3000`.
