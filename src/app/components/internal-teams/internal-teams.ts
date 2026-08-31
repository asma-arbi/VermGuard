import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

interface InternalTeam {
  id: string;
  name: string;
  assignees: string[];
  defaultStartDate?: string;
  defaultEndDate?: string;
}

interface TicketResult {
  totalCount: number;
  teamName: string;
  issues: any[];
  byStatus: Record<string, number>;
  byAssignee: Record<string, number>;
}

@Component({
  selector: 'app-internal-teams',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="int-container fade-in">
      <!-- Header -->
      <div class="int-header">
        <div>
          <h2 class="int-title">🏛️ Internal Teams — Ticket Analytics</h2>
          <p class="int-subtitle">Analyse et audit en temps réel des tickets Jira pour les équipes internes Vermeg (IT Local Support & IS Team)</p>
        </div>
      </div>

      <!-- Search & Filters Panel -->
      <div class="search-panel">
        <div class="search-grid">
          <!-- Step 1: Select Internal Team -->
          <div class="form-group">
            <label class="form-label">🏛️ Select Internal Team *</label>
            <select [(ngModel)]="selectedTeamId" (change)="onTeamChange()" class="form-input">
              <option value="">-- Choose an Internal Team --</option>
              <option *ngFor="let t of teams" [value]="t.id">{{ t.name }}</option>
            </select>
          </div>

          <!-- Step 2: Select Member / Assignee -->
          <div class="form-group">
            <label class="form-label">👤 Select Member / Assignee</label>
            <select [(ngModel)]="selectedMember" (change)="onMemberChange()" class="form-input" [disabled]="!selectedTeamId">
              <option value="">-- All Members of {{ getTeamName() || 'Team' }} --</option>
              <option *ngFor="let m of getTeamAssignees()" [value]="m">{{ m }}</option>
            </select>
          </div>

          <!-- Step 3: From (Start Date) -->
          <div class="form-group">
            <label class="form-label">📅 From (Start Date) *</label>
            <input type="date" [(ngModel)]="startDate" class="form-input">
          </div>

          <!-- Step 4: To (End Date) -->
          <div class="form-group">
            <label class="form-label">📅 To (End Date) *</label>
            <input type="date" [(ngModel)]="endDate" class="form-input">
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="search-actions">
          <button class="btn-analyze" (click)="analyze()" [disabled]="loading || !selectedTeamId || !startDate || !endDate">
            <span *ngIf="!loading">🔍 Analyze Tickets</span>
            <span *ngIf="loading" class="btn-spinner"></span>
          </button>
          <button class="btn-export-pdf" (click)="exportPdfReport()" *ngIf="result && result.totalCount > 0" [disabled]="loading">
            📄 Exporter Rapport PDF
          </button>
        </div>
      </div>

      <!-- Error Message -->
      <div class="alert-error" *ngIf="errorMsg">⚠️ {{ errorMsg }}</div>

      <!-- Loading State -->
      <div class="loading-block" *ngIf="loading">
        <div class="spinner-lg"></div>
        <span>Fetching live tickets from Vermeg Jira database for <strong>{{ getTeamName() }}</strong>...</span>
      </div>

      <!-- Results Container -->
      <div *ngIf="result && !loading" class="results-container fade-in">

        <!-- KPI Cards -->
        <div class="kpi-row">
          <div class="kpi-card kpi-total">
            <div class="kpi-value">{{ result.totalCount }}</div>
            <div class="kpi-label">Total Incidents</div>
          </div>
          <div class="kpi-card kpi-open">
            <div class="kpi-value">{{ getStatusCount('Open') + getStatusCount('To Do') + getStatusCount('In Progress') }}</div>
            <div class="kpi-label">Active / In Progress</div>
          </div>
          <div class="kpi-card kpi-resolved">
            <div class="kpi-value">{{ getStatusCount('Resolved') + getStatusCount('Done') }}</div>
            <div class="kpi-label">Resolved / Done</div>
          </div>
          <div class="kpi-card kpi-assignees">
            <div class="kpi-value">{{ getAssigneeCount() }}</div>
            <div class="kpi-label">Active Members</div>
          </div>
        </div>

        <!-- Charts Row -->
        <div class="charts-row">
          <div class="chart-card">
            <h3 class="chart-title">👤 Incidents Per Member / Assignee</h3>
            <div class="chart-wrapper">
              <canvas id="intAssigneeChart"></canvas>
            </div>
          </div>
          <div class="chart-card">
            <h3 class="chart-title">📊 Incidents Per Status</h3>
            <div class="chart-wrapper">
              <canvas id="intStatusChart"></canvas>
            </div>
          </div>
        </div>

        <!-- Tickets Table Section -->
        <div class="tickets-section">
          <div class="section-header">
            <h3 class="section-title">🎫 Incidents List — {{ result.teamName }} <span *ngIf="selectedMember">({{ selectedMember }})</span></h3>
            <div class="ticket-count-badge">{{ filteredIssues().length }} tickets</div>
          </div>

          <!-- Status Filter Tabs / Pills -->
          <div class="status-filter-pills-row" *ngIf="result?.issues?.length">
            <button class="status-filter-btn" [class.active]="selectedStatusFilter === 'ALL'" (click)="setStatusFilter('ALL')">
              All ({{ getStatusCount('ALL') }})
            </button>
            <button class="status-filter-btn btn-status-resolved" [class.active]="selectedStatusFilter === 'Resolved'" (click)="setStatusFilter('Resolved')">
              <span class="dot-indicator dot-resolved"></span> Resolved ({{ getStatusCount('Resolved') }})
            </button>
            <button class="status-filter-btn btn-status-closed" [class.active]="selectedStatusFilter === 'Closed'" (click)="setStatusFilter('Closed')">
              <span class="dot-indicator dot-closed"></span> Closed ({{ getStatusCount('Closed') }})
            </button>
            <button class="status-filter-btn btn-status-customer" [class.active]="selectedStatusFilter === 'Waiting for Customer'" (click)="setStatusFilter('Waiting for Customer')">
              <span class="dot-indicator dot-customer"></span> Waiting for Customer ({{ getStatusCount('Waiting for Customer') }})
            </button>
            <button class="status-filter-btn btn-status-technical" [class.active]="selectedStatusFilter === 'Waiting Technical Validation'" (click)="setStatusFilter('Waiting Technical Validation')">
              <span class="dot-indicator dot-technical"></span> Waiting Technical Validation ({{ getStatusCount('Waiting Technical Validation') }})
            </button>
          </div>

          <!-- Live Table Search -->
          <div class="table-search-bar">
            <span class="search-icon-sm">🔍</span>
            <input type="text" [(ngModel)]="tableSearch" placeholder="Search by Key, Summary, Assignee or Status..." class="table-search-input">
          </div>

          <div class="table-wrap">
            <table class="tickets-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Assignee</th>
                  <th>Created</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngIf="filteredIssues().length === 0">
                  <td colspan="7" class="empty-row">No incidents found matching your query criteria.</td>
                </tr>
                <tr *ngFor="let ticket of filteredIssues(); let i = index" class="ticket-row" [class.row-alt]="i % 2 === 1">
                  <td>
                    <a [href]="'https://jira.vermeg.com/browse/' + ticket.key" target="_blank" class="ticket-key-link">
                      {{ ticket.key }}
                    </a>
                  </td>
                  <td class="ticket-summary-cell" [title]="ticket.fields?.summary">{{ ticket.fields?.summary }}</td>
                  <td>
                    <span class="status-pill" [ngClass]="getStatusClass(ticket.fields?.status?.name)">
                      {{ ticket.fields?.status?.name || '-' }}
                    </span>
                  </td>
                  <td>
                    <span class="priority-pill" [ngClass]="getPriorityClass(ticket.fields?.priority?.name)">
                      {{ ticket.fields?.priority?.name || 'Medium' }}
                    </span>
                  </td>
                  <td class="assignee-cell">
                    {{ ticket.fields?.assignee?.displayName || ticket.fields?.assignee?.name || 'Unassigned' }}
                  </td>
                  <td class="date-cell">{{ formatDate(ticket.fields?.created) }}</td>
                  <td class="date-cell">{{ formatDate(ticket.fields?.updated) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Initial Empty State -->
      <div class="empty-state" *ngIf="!result && !loading">
        <div class="empty-icon">🏛️</div>
        <p class="empty-title">Select an Internal Team (IT Local Support or IS Team)</p>
        <p class="empty-sub">Choose a specific member or analyze the whole internal team from Vermeg Jira</p>
      </div>

    </div>
  `,
  styles: [`
    .int-container { padding: 0; }
    .int-header { margin-bottom: 1.5rem; }
    .int-title { font-size: 1.45rem; font-weight: 800; color: #1e293b; margin-bottom: 0.25rem; }
    .int-subtitle { font-size: 0.88rem; color: #64748b; }

    .search-panel {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px;
      padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .search-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem; margin-bottom: 1.25rem;
    }
    .form-group { display: flex; flex-direction: column; }
    .form-label { font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.4rem; letter-spacing: 0.4px; }
    .form-input {
      height: 42px; padding: 0 0.9rem; border: 1px solid #cbd5e1; border-radius: 10px;
      font-size: 0.88rem; font-weight: 500; outline: none; transition: border 0.2s; background: #f8fafc;
    }
    .form-input:focus { border-color: #0ea5e9; background: white; }
    .form-input:disabled { opacity: 0.6; cursor: not-allowed; }

    .search-actions { display: flex; gap: 0.75rem; justify-content: flex-end; border-top: 1px solid #f1f5f9; padding-top: 1.25rem; }
    .btn-analyze {
      height: 42px; padding: 0 1.75rem; background: linear-gradient(135deg, #0ea5e9, #0369a1);
      color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer;
      font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;
      box-shadow: 0 4px 14px rgba(14,165,233,0.3); transition: all 0.2s;
    }
    .btn-analyze:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-export-pdf {
      height: 42px; padding: 0 1.5rem; background: linear-gradient(135deg, #0ea5e9, #0369a1);
      color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.9rem;
      display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 14px rgba(14, 165, 233, 0.3); transition: all 0.2s ease;
    }
    .btn-export-pdf:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-spinner {
      width: 18px; height: 18px; border: 3px solid rgba(255,255,255,0.3);
      border-top: 3px solid white; border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .alert-error { background: #fee2e2; color: #991b1b; padding: 0.85rem 1rem; border-radius: 10px; margin-bottom: 1rem; font-weight: 600; font-size: 0.88rem; }

    .loading-block {
      display: flex; align-items: center; justify-content: center; gap: 1rem;
      padding: 3rem; color: #64748b; background: white; border-radius: 16px; border: 1px solid #e2e8f0;
    }
    .spinner-lg {
      width: 36px; height: 36px; border: 4px solid #e2e8f0;
      border-top: 4px solid #0ea5e9; border-radius: 50%; animation: spin 0.8s linear infinite;
    }

    .results-container { display: flex; flex-direction: column; gap: 1.5rem; }

    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .kpi-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem;
      text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .kpi-value { font-size: 2.1rem; font-weight: 800; margin-bottom: 0.25rem; }
    .kpi-label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
    .kpi-total .kpi-value { color: #1e293b; }
    .kpi-open .kpi-value { background: linear-gradient(135deg, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .kpi-resolved .kpi-value { background: linear-gradient(135deg, #10b981, #059669); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .kpi-assignees .kpi-value { background: linear-gradient(135deg, #0ea5e9, #0369a1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .chart-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .chart-title { font-size: 0.95rem; font-weight: 800; color: #1e293b; margin-bottom: 1rem; }
    .chart-wrapper { height: 260px; position: relative; }

    .tickets-section {
      background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .section-title { font-size: 1rem; font-weight: 800; color: #1e293b; }
    .ticket-count-badge {
      background: linear-gradient(135deg, #0ea5e9, #0369a1); color: white;
      padding: 0.25rem 0.85rem; border-radius: 20px; font-size: 0.78rem; font-weight: 700;
    }

    .table-search-bar {
      display: flex; align-items: center; gap: 0.6rem; background: #f8fafc;
      border: 1px solid #e2e8f0; border-radius: 10px; padding: 0 0.9rem; margin-bottom: 1rem; height: 40px;
    }
    .search-icon-sm { font-size: 0.85rem; }
    .table-search-input { border: none; background: transparent; flex: 1; font-size: 0.88rem; outline: none; }

    .table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #f1f5f9; }
    .tickets-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .tickets-table thead tr { background: #f0f9ff; }
    .tickets-table th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 700; color: #0369a1; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .tickets-table td { padding: 0.65rem 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .row-alt { background: #fafafa; }
    .ticket-row:hover { background: #f0f9ff; }
    .empty-row { text-align: center; padding: 2rem; color: #94a3b8; }
    .ticket-key-link { color: #0ea5e9; font-weight: 700; font-family: monospace; text-decoration: none; }
    .ticket-key-link:hover { text-decoration: underline; }
    .ticket-summary-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1e293b; font-weight: 500; }
    .assignee-cell { white-space: nowrap; color: #475569; }
    .date-cell { white-space: nowrap; color: #64748b; font-size: 0.8rem; }

    .status-filter-pills-row {
      display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.85rem; align-items: center;
    }
    .status-filter-btn {
      padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.8rem; font-weight: 700;
      border: 1px solid #e2e8f0; background: white; color: #64748b; cursor: pointer;
      display: inline-flex; align-items: center; gap: 0.45rem; transition: all 0.2s ease;
    }
    .status-filter-btn:hover { border-color: #cbd5e1; color: #1e293b; }
    .status-filter-btn.active {
      background: #1e293b; color: white; border-color: #1e293b; box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    }
    .btn-status-resolved.active { background: #7c3aed; border-color: #7c3aed; color: white; }
    .btn-status-closed.active { background: #10b981; border-color: #10b981; color: white; }
    .btn-status-customer.active { background: #f59e0b; border-color: #f59e0b; color: white; }
    .btn-status-technical.active { background: #ef4444; border-color: #ef4444; color: white; }

    .dot-indicator { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot-resolved { background: #7c3aed; }
    .dot-closed { background: #10b981; }
    .dot-customer { background: #f59e0b; }
    .dot-technical { background: #ef4444; }

    .status-pill {
      padding: 0.25rem 0.65rem; border-radius: 6px; font-size: 0.72rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: 0.3px; display: inline-flex; align-items: center;
    }
    .status-resolved { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }
    .status-closed { background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; }
    .status-waiting-customer { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .status-waiting-technical { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .status-open { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
    .status-inprogress { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .status-other { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    .priority-pill { padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
    .priority-critical, .priority-highest { background: #fef2f2; color: #dc2626; }
    .priority-high { background: #fff7ed; color: #ea580c; }
    .priority-medium { background: #fefce8; color: #ca8a04; }
    .priority-low, .priority-lowest { background: #f0fdf4; color: #16a34a; }

    .empty-state { text-align: center; padding: 4rem 2rem; color: #94a3b8; }
    .empty-icon { font-size: 3.5rem; margin-bottom: 1rem; }
    .empty-title { font-size: 1rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem; }
    .empty-sub { font-size: 0.85rem; color: #94a3b8; }

    .fade-in { animation: fadeIn 0.35s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 900px) {
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
    }
  `]
})
export class InternalTeamsComponent implements OnInit, AfterViewInit {
  teams: InternalTeam[] = [];
  selectedTeamId = '';
  selectedMember = '';
  startDate = '';
  endDate = '';
  maxResult = 2000;
  loading = false;
  errorMsg = '';
  result: TicketResult | null = null;
  tableSearch = '';
  selectedStatusFilter = 'ALL';

  private statusChart: Chart | null = null;
  private assigneeChart: Chart | null = null;

  private readonly API = 'http://localhost:3000/jira';

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.http.get<InternalTeam[]>(`${this.API}/internals/teams`).subscribe({
      next: (data) => {
        this.teams = data;
        if (this.teams.length > 0) {
          this.selectedTeamId = this.teams[0].id;
          this.onTeamChange();
        }
      },
      error: () => {
        this.errorMsg = 'Failed to load internal teams list.';
      }
    });
  }

  ngAfterViewInit() {}

  onTeamChange() {
    this.selectedMember = '';
    const team = this.teams.find(t => t.id === this.selectedTeamId);
    if (team) {
      if (team.defaultStartDate) this.startDate = team.defaultStartDate;
      if (team.defaultEndDate) this.endDate = team.defaultEndDate;
      this.analyze();
    }
  }

  onMemberChange() {
    this.analyze();
  }

  getTeamName(): string {
    return this.teams.find(t => t.id === this.selectedTeamId)?.name || this.selectedTeamId;
  }

  getTeamAssignees(): string[] {
    return this.teams.find(t => t.id === this.selectedTeamId)?.assignees || [];
  }

  analyze() {
    if (!this.selectedTeamId || !this.startDate || !this.endDate) return;

    this.errorMsg = '';
    const cacheKey = `vermeg_int_cache_${this.selectedTeamId}_${this.selectedMember}_${this.startDate}_${this.endDate}_${this.maxResult}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.totalCount !== undefined) {
          this.result = parsed;
          this.loading = false;
          this.destroyCharts();
          this.cdr.detectChanges();
          setTimeout(() => this.renderCharts(), 50);
        } else {
          this.loading = true;
          this.result = null;
          this.destroyCharts();
        }
      } catch (e) {
        this.loading = true;
        this.result = null;
        this.destroyCharts();
      }
    } else {
      this.loading = true;
      this.result = null;
      this.destroyCharts();
    }

    this.http.post<TicketResult>(`${this.API}/internals/tickets`, {
      teamId: this.selectedTeamId,
      selectedMember: this.selectedMember,
      startDate: this.startDate,
      endDate: this.endDate,
      maxResult: this.maxResult
    }).subscribe({
      next: (data) => {
        this.result = data;
        this.loading = false;
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {}
        this.cdr.detectChanges();
        setTimeout(() => this.renderCharts(), 50);
      },
      error: (err) => {
        if (!cached) {
          this.errorMsg = 'Failed to fetch tickets. ' + (err?.error?.message || err.message || '');
        }
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setStatusFilter(status: string) {
    this.selectedStatusFilter = status;
  }

  isStatusMatch(statusName: string, category: string): boolean {
    if (!statusName) return false;
    const s = statusName.toLowerCase().trim();
    const c = category.toLowerCase().trim();
    if (c === 'all') return true;
    if (c === 'resolved') return s === 'resolved';
    if (c === 'closed') return s === 'closed';
    if (c.includes('customer')) return s.includes('customer');
    if (c.includes('technical') || c.includes('validation')) return s.includes('technical') || s.includes('validation');
    return s === c;
  }

  filteredIssues(): any[] {
    if (!this.result?.issues) return [];
    let issues = this.result.issues;

    if (this.selectedStatusFilter && this.selectedStatusFilter !== 'ALL') {
      issues = issues.filter(t => this.isStatusMatch(t.fields?.status?.name, this.selectedStatusFilter));
    }

    if (this.tableSearch.trim()) {
      const q = this.tableSearch.toLowerCase();
      issues = issues.filter(t =>
        (t.key || '').toLowerCase().includes(q) ||
        (t.fields?.summary || '').toLowerCase().includes(q) ||
        (t.fields?.assignee?.displayName || t.fields?.assignee?.name || '').toLowerCase().includes(q) ||
        (t.fields?.status?.name || '').toLowerCase().includes(q)
      );
    }
    return issues;
  }

  getStatusCount(category: string): number {
    if (!this.result?.issues) return 0;
    if (category === 'ALL') return this.result.issues.length;
    return this.result.issues.filter(t => this.isStatusMatch(t.fields?.status?.name, category)).length;
  }

  getAssigneeCount(): number {
    if (!this.result?.byAssignee) return 0;
    return Object.keys(this.result.byAssignee).length;
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-other';
    const s = status.toLowerCase();
    if (s === 'resolved') return 'status-resolved';
    if (s === 'closed') return 'status-closed';
    if (s.includes('customer')) return 'status-waiting-customer';
    if (s.includes('technical') || s.includes('validation')) return 'status-waiting-technical';
    if (s === 'open' || s === 'to do') return 'status-open';
    if (s.includes('progress')) return 'status-inprogress';
    return 'status-other';
  }

  getPriorityClass(priority: string): string {
    if (!priority) return 'priority-medium';
    const p = priority.toLowerCase();
    if (p === 'critical') return 'priority-critical';
    if (p === 'highest') return 'priority-highest';
    if (p === 'high') return 'priority-high';
    if (p === 'low') return 'priority-low';
    if (p === 'lowest') return 'priority-lowest';
    return 'priority-medium';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  destroyCharts() {
    if (this.statusChart) { this.statusChart.destroy(); this.statusChart = null; }
    if (this.assigneeChart) { this.assigneeChart.destroy(); this.assigneeChart = null; }
  }

  renderCharts() {
    if (!this.result) return;

    const assigneeEl = document.getElementById('intAssigneeChart') as HTMLCanvasElement;
    if (assigneeEl) {
      const entries = Object.entries(this.result.byAssignee).sort((a, b) => b[1] - a[1]).slice(0, 12);
      const labels = entries.map(e => e[0]);
      const data = entries.map(e => e[1]);
      this.assigneeChart = new Chart(assigneeEl, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Incidents', data, backgroundColor: 'rgba(14,165,233,0.75)', borderRadius: 6, borderSkipped: false }] },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { font: { weight: 'bold' } } }, y: { ticks: { font: { size: 11 } } } }
        }
      });
    }

    const statusEl = document.getElementById('intStatusChart') as HTMLCanvasElement;
    if (statusEl) {
      const labels = Object.keys(this.result.byStatus);
      const data = Object.values(this.result.byStatus);
      const colors = labels.map(lbl => {
        const l = lbl.toLowerCase();
        if (l === 'resolved') return '#7c3aed';
        if (l === 'closed') return '#10b981';
        if (l.includes('customer')) return '#f59e0b';
        if (l.includes('technical') || l.includes('validation')) return '#ef4444';
        if (l.includes('progress')) return '#0ea5e9';
        return '#64748b';
      });
      this.statusChart = new Chart(statusEl, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 12, weight: 'bold' } } } } }
      });
    }
  }

  exportPdfReport() {
    if (!this.result || !this.result.issues) return;

    // Ne PAS utiliser loading=true: cela détruit les canvas Chart.js
    const btnPdf = document.querySelector('.btn-export-pdf') as HTMLElement;
    if (btnPdf) { btnPdf.style.opacity = '0.5'; btnPdf.style.pointerEvents = 'none'; }

    const exportDate = new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const teamName = this.getTeamName();
    const memberName = this.selectedMember || 'Tous les membres de l\'équipe';
    const totalCount = this.result.totalCount;
    const activeCount = this.getStatusCount('Open') + this.getStatusCount('To Do') + this.getStatusCount('In Progress');
    const resolvedCount = this.getStatusCount('Resolved') + this.getStatusCount('Done');
    const activeMembersCount = this.getAssigneeCount();

    const sortedAssignees = Object.entries(this.result.byAssignee || {}).sort((a, b) => b[1] - a[1]);
    let assigneeRowsHtml = '';
    sortedAssignees.forEach(([assignee, count]) => {
      const pct = ((count / (totalCount || 1)) * 100).toFixed(1);
      assigneeRowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 10px; font-weight: 700; color: #1e293b;">${assignee}</td>
          <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #0ea5e9;">${count}</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: 600; color: #64748b;">${pct}%</td>
        </tr>
      `;
    });

    let ticketRowsHtml = '';
    const displayTickets = (this.result.issues || []).slice(0, 100);
    displayTickets.forEach((t: any, idx: number) => {
      const key = t.key;
      const summary = t.fields?.summary || 'Sans titre';
      const status = t.fields?.status?.name || 'Inconnu';
      const assignee = t.fields?.assignee?.displayName || t.fields?.assignee?.name || 'Non assigné';
      const created = this.formatDate(t.fields?.created);

      ticketRowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#f0f9ff'}; font-size: 11px;">
          <td style="padding: 6px 8px; font-weight: 700; color: #0ea5e9;">${key}</td>
          <td style="padding: 6px 8px; color: #334155; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${summary}</td>
          <td style="padding: 6px 8px; color: #475569; font-weight: 600;">${assignee}</td>
          <td style="padding: 6px 8px;"><span style="background: #bae6fd; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">${status}</span></td>
          <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">${created}</td>
        </tr>
      `;
    });

    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    container.style.color = '#1e293b';
    container.style.padding = '30px';

    container.innerHTML = `
      <div style="background: #ffffff; padding: 10px;">
        <div style="background: linear-gradient(135deg, #0c4a6e 0%, #0369a1 50%, #0ea5e9 100%); padding: 20px 25px; border-radius: 12px; color: #ffffff; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">VERMGUARD <span style="color: #bae6fd;">AI</span></div>
            <div style="font-size: 12px; font-weight: 700; color: #e0f2fe; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Rapport d'Analyse d'Incidents Équipe Interne — Vermeg</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 20px; font-weight: 700; display: inline-block;">CONFIDENTIEL MANAGER</div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px;">Généré le ${exportDate}</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
          <div><strong>🏛️ Équipe Interne :</strong> <span style="color: #0369a1; font-weight: 800;">${teamName}</span></div>
          <div><strong>👤 Membre / Intervenant :</strong> <span style="color: #0ea5e9; font-weight: 700;">${memberName}</span></div>
          <div><strong>📅 Période du Rapport :</strong> Du <span style="color: #0284c7; font-weight: 700;">${this.startDate}</span> au <span style="color: #0284c7; font-weight: 700;">${this.endDate}</span></div>
          <div><strong>🔢 Total Incidents :</strong> <span style="color: #c1272d; font-weight: 700;">${totalCount} trouvés dans Jira</span></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #1e293b;">${totalCount}</div>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Total Incidents</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #fef3c7; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #d97706;">${activeCount}</div>
            <div style="font-size: 10px; color: #d97706; font-weight: 700; text-transform: uppercase; margin-top: 2px;">En Cours / Open</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #d1fae5; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #059669;">${resolvedCount}</div>
            <div style="font-size: 10px; color: #059669; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Résolus / Done</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #bae6fd; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #0ea5e9;">${activeMembersCount}</div>
            <div style="font-size: 10px; color: #0ea5e9; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Membres Actifs</div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13px; font-weight: 800; color: #0369a1; margin: 0 0 8px 0;">👤 Répartition des Incidents par Membre d'Équipe</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #0369a1; color: #ffffff;">
                <th style="padding: 6px 10px; text-align: left;">Membre / Intervenant</th>
                <th style="padding: 6px 10px; text-align: center;">Nombre d'Incidents</th>
                <th style="padding: 6px 10px; text-align: right;">Pourcentage</th>
              </tr>
            </thead>
            <tbody>
              ${assigneeRowsHtml}
            </tbody>
          </table>
        </div>

        <div>
          <h4 style="font-size: 13px; font-weight: 800; color: #0369a1; margin: 0 0 8px 0;">🎫 Liste des Incidents Jira (${displayTickets.length} affichés)</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #0ea5e9; color: #ffffff;">
                <th style="padding: 6px 8px; text-align: left;">Clé</th>
                <th style="padding: 6px 8px; text-align: left;">Résumé / Incidents</th>
                <th style="padding: 6px 8px; text-align: left;">Assignee</th>
                <th style="padding: 6px 8px; text-align: left;">Statut</th>
                <th style="padding: 6px 8px; text-align: left;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${ticketRowsHtml}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
          <div>VermGuard AI Copilot — Internal IT/IS Operations Management</div>
          <div>Page 1 / Document d'Audit Officiel</div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    setTimeout(() => {
      Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]).then(([jsPdfModule, html2canvasModule]) => {
        const jsPDF = jsPdfModule.default || jsPdfModule;
        const html2canvas = html2canvasModule.default || html2canvasModule;

        html2canvas(container, { scale: 1.4, useCORS: true, logging: false }).then(canvas => {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }

          const imgData = canvas.toDataURL('image/jpeg', 0.88);
          const pdf = new jsPDF('p', 'mm', 'a4');
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();

          const imgWidth = pageWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          let heightLeft = imgHeight;
          let position = 0;

          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }

          const safeTeam = (this.getTeamName() || 'Team').replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `Rapport_Interne_${safeTeam}_${this.startDate}_${this.endDate}.pdf`;
          pdf.save(filename);
          // Re-enable button + re-render charts so they stay visible
          if (btnPdf) { btnPdf.style.opacity = ''; btnPdf.style.pointerEvents = ''; }
          this.destroyCharts();
          setTimeout(() => this.renderCharts(), 60);
        }).catch(err => {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
          console.error('PDF Canvas error:', err);
          if (btnPdf) { btnPdf.style.opacity = ''; btnPdf.style.pointerEvents = ''; }
          this.destroyCharts();
          setTimeout(() => this.renderCharts(), 60);
          alert('Erreur lors de la génération du PDF.');
        });
      }).catch(err => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        console.error('PDF Library import error:', err);
        if (btnPdf) { btnPdf.style.opacity = ''; btnPdf.style.pointerEvents = ''; }
        alert('Erreur lors du chargement des bibliothèques PDF.');
      });
    }, 50);
  }
}
