# 🛡️ VermGuard AI — Real-Time Security Operations Center (SOC) & SLA Analytics Hub

> **VermGuard** is a real-time Security Operations Center (SOC) & Support Hub custom-built for **Vermeg** to streamline staff access control, audit administrative operations, and synchronize directly with Vermeg's internal Jira ticketing systems.

---

## 📋 Table of Contents
- [Project Overview](#-project-overview)
- [Key Features & Modules](#-key-features--modules)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Role-Based Access Control (RBAC)](#-role-based-access-control-rbac)
- [Installation & Quick Start](#-installation--quick-start)
- [Official PDF Reports](#-official-pdf-reports)
- [License & Credits](#-license--credits)

---

## 📌 Project Overview

VermGuard AI was designed and developed at **Vermeg** to unify Security Operations Center (SOC) incident monitoring, automate monthly team performance evaluations, audit SLA compliance, and generate official executive PDF reports for clients and internal management.

---

## 🌟 Key Features & Modules

### 1. 📊 Live Dashboard & Incident Monitoring
- Real-time KPI counters (Total Incidents, SaaS Cloud, On-Premise SO, Security Tools).
- Dynamic date range filters (`From` & `To`) and maximum query limit controls.
- Interactive Chart.js trend visualizations and live status metrics.

### 2. 🎫 Multi-Tenant Jira Supervision
- Direct integration with Vermeg Atlassian Jira REST API v2 (`Global Internal Support` project).
- Automatic categorization across On-Premise SO, SaaS Cloud (`customfield_18500`), and Security Tools (`customfield_10008`).
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

## 🛠️ Architecture & Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│              FRONTEND (ANGULAR 19 SPA)                  │
│  - Dashboard & Charts (Chart.js)                        │
│  - Manager Workspace & SLA Analytics                   │
│  - PDF Generator (jsPDF + html2canvas)                  │
│  - 0ms LocalStorage Fast Cache                          │
└────────────────────────────┬────────────────────────────┘
                             │ REST HTTP & WebSockets
┌────────────────────────────▼────────────────────────────┐
│               BACKEND (NESTJS 10 FRAMEWORK)             │
│  - REST Controllers (Jira, Evaluations, Users)          │
│  - TypeORM + SQLite Database Engine                     │
│  - WebSocket Gateway (Real-Time Notifications)          │
│  - Jira Integration Service & Cache Memory              │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP REST API v2
┌────────────────────────────▼────────────────────────────┐
│            ATLASSIAN JIRA ENTERPRISE SERVER             │
│  - Project: Global Internal Support (GIS)               │
│  - Custom Fields: customfield_18500, customfield_10008  │
│  - SLA Fields: customfield_17800 (MTTD / Delay)         │
└─────────────────────────────────────────────────────────┘
```

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | Angular 19 (Standalone Components, RxJS), Vanilla CSS3 (Glassmorphism), Chart.js, jsPDF, html2canvas, 0ms LocalStorage Fast Cache |
| **Backend** | NestJS 10 (TypeScript), TypeORM, SQLite Database Engine, Axios HTTP Service |
| **Integrations** | Atlassian Jira REST API v2, Socket.IO WebSockets |

---

## 🔒 Role-Based Access Control (RBAC)

| Feature / Module | MANAGER | SOC ANALYST | SUPPORT / USER |
| :--- | :---: | :---: | :---: |
| **Global Dashboard & KPIs** | ✅ Full Access | ✅ Restricted View | 👁️ Read-Only |
| **Jira Tickets Supervision** | ✅ Full Access | ✅ Assigned Tickets | 👁️ Read-Only |
| **MSP Clients PDF Export** | ✅ Yes (Official) | ❌ No | ❌ No |
| **Internal Teams PDF Export** | ✅ Yes (Official) | ❌ No | ❌ No |
| **Monthly Member Evaluations** | 📝 Edit, Calc & Publish | 👁️ Read-Only Scorecard | ❌ No |
| **SLA & Quality Analytics** | ✅ Full Dashboard & PDF | ❌ No | ❌ No |
| **Real-Time 24h Notifications** | ✅ All Notifications | ✅ Security Alerts | 👁️ System Alerts |
| **Staff Directory Management** | 🛠️ Full Admin | 👁️ Read-Only | 👁️ Read-Only |

---

## ⚡ Installation & Quick Start

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 2. Backend Setup
```bash
cd Backend
npm install
npm run start:dev
```
The NestJS backend server will start on `http://localhost:3000`.

### 3. Frontend Setup
```bash
cd Frontend
npm install
npx ng serve --port 4200
```
The Angular frontend application will start on `http://localhost:4200`.

---

## 📜 License & Credits
Custom-built for **VERMEG** (Security Operations Center & Cloud Infrastructure). All rights reserved.
