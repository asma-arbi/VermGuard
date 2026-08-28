# 🛡️ VermGuard AI — Real-Time Security Operations Center (SOC) & SLA Analytics Hub

> **VermGuard** is a real-time Security Operations Center (SOC) & Support Hub custom-built for **Vermeg** to streamline staff access control, audit administrative operations, and synchronize directly with Vermeg's internal Jira ticketing systems.

---

## 🌟 Key Modules & Features

### 1. 📊 Live Dashboard & Incident Monitoring
- Real-time KPI counters (Total Incidents, SaaS Cloud, On-Premise SO, Security Tools).
- Dynamic date range filters (`From` & `To`) and maximum query limit controls.
- Interactive Chart.js trend visualizations and live status metrics.

### 2. 🎫 Multi-Tenant Jira Supervision
- Direct integration with Vermeg Atlassian Jira REST API v2 (`Global Internal Support` project).
- Categorization across On-Premise SO, SaaS Cloud (`customfield_18500`), and Security Tools (`customfield_10008`).
- One-click ticket status transitions (`In Progress`, `Resolved`, `Closed`) and comment additions directly from VermGuard AI.

### 3. 🏢 MSP Clients & Internal Teams Reporting
- Multi-client supervision (*Adactim, Cloudshift, IT Local Support, etc.*).
- Internal departments tracking (*IS Team, Nagios Support, DevOps Team, etc.*).
- **Automated Official PDF Exports**: Generates branded PDF reports with VermGuard AI logo, KPI badges, client breakdown, and detailed ticket tables including **MTTD** (Min Time to Detect) and **Type**.

### 4. 📝 Manager Monthly Performance Evaluations
- **Focused Analyst Selector (`Select SOC Analyst *`)**: Custom scrollable dropdown listing all SOC members with search filtering.
- **7 Official Vermeg Performance Criteria**:
  1. *1st Level Support* (Delays, account unblocks, VM restarts, volume ranking).
  2. *Monitoring & Detection* (Qualification under 30 mins).
  3. *Ticket Quality* (Compliance formula: `(1 - Bad/Total) * 100`).
  4. *On-Prem Onboarding* (Integration @J+1 & Nagios health checks).
  5. *SaaS Onboarding* (Client integration & cost optimization).
  6. *Security* (Tools mastery, team skill transfer, documentation & AI adoption).
  7. *Daily Checklist & Reports* (Operational checklist completion).
- **Smart Features**: Custom criteria options, `⚡ Auto-Calc SLA` button to compute scores using live Jira metrics, and `Draft` / `Published` state control.

### 5. 📈 SOC SLA & Quality Analytics Dashboard
- **Quantity Volume Leaderboard**: Analyst volume ranking with Volume SLA validation (`≥ 20 tickets/month`).
- **Quality & Audit Compliance**:
  - **Bad Titles Audit**: Flags titles under 5 characters or generic keywords (`test`, `issue`, `ticket`, `problem`, `bug`, `reboot`, `alert`).
  - **Bad Assignments Audit**: Flags unassigned tickets.
  - **Quality Score %**: `((Total - (Bad Titles + Bad Assignments)) / Total) * 100`.
- **MTTD / MTTR Metrics**: Qualification speed tracking (`Target < 15 mins`).
- **Official SLA Audit PDF Export**: 1-click team SLA PDF report generation.

### 6. 👤 SOC Analyst Read-Only Scorecard
- Transparent monthly performance scorecard for individual analysts.
- Color-coded progress bars for each criterion and integrated Official Vermeg SLA Reference Guide.

### 7. 🔔 Real-Time WebSocket Notification Engine
- Socket.IO gateway delivering instant updates when evaluations are published.
- 24-hour persistent notification center with auto-purging.

### 8. 👥 Staff Directory & Access Control (RBAC)
- Role-based permissions matrix for **Manager**, **SOC Analyst**, and **Support/User**.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | Angular 19 (Standalone Components, RxJS), Vanilla CSS3 (Glassmorphism), Chart.js, jsPDF, html2canvas, 0ms LocalStorage Fast Cache |
| **Backend** | NestJS 10 (TypeScript), TypeORM, SQLite Database Engine, Axios HTTP Service |
| **Integrations** | Atlassian Jira REST API v2, Socket.IO WebSockets |

---

## ⚡ Quick Start & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 2. Backend Setup
```bash
cd Backend
npm install
npm run start:dev
```
The NestJS server will start on `http://localhost:3000`.

### 3. Frontend Setup
```bash
cd Frontend
npm install
npx ng serve --port 4200
```
The Angular application will start on `http://localhost:4200`.

---

## 📜 License & Credits
Custom-built for **VERMEG** (Security Operations Center & Cloud Infrastructure). All rights reserved.
