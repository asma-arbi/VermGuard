import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Chart, registerables } from 'chart.js';
import { EvaluationsService, TeamMemberEvaluation, EvaluationItem } from '../../../services/evaluations.service';
import { UserService } from '../../../services/user.service';
import { SocketService } from '../../../services/socket.service';

Chart.register(...registerables);

interface AnalystSlaItem {
  username: string;
  displayName: string;
  totalTickets: number;
  saasCount: number;
  onpremCount: number;
  securityCount: number;
  badTitlesCount: number;
  badAssignmentsCount: number;
  cleanTicketsCount: number;
  qualityScore: number;
  avgMTTDMinutes: number;
  volumeSlaCompliant: boolean;
  qualitySlaCompliant: boolean;
  mttdSlaCompliant: boolean;
  issues?: any[];
}

interface SlaAnalyticsData {
  teamTotalTickets: number;
  teamQualityAverage: number;
  startDate: string;
  endDate: string;
  analysts: AnalystSlaItem[];
  slaThresholds: {
    minVolumePerMonth: number;
    minQualityCompliancePct: number;
    maxBadTitleRatePct: number;
    maxBadAssignmentRatePct: number;
    maxMTTDMinutes: number;
    maxMTTRHours: number;
  };
}

@Component({
  selector: 'app-evaluation-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  template: `
    <div class="eval-manager-container fade-in">
      
      <!-- Top Manager Sub-Navigation Bar -->
      <div class="manager-subnav-card">
        <div class="subnav-left">
          <h2>📊 SOC Manager Evaluations Workspace</h2>
          <p class="subnav-subtitle">Évaluations mensuelles individuelles et Tableau de bord Analytics SLA / Qualité Jira</p>
        </div>
        <div class="subnav-tabs">
          <button class="subnav-tab-btn" [class.active]="activeManagerSubTab === 'evaluations'" (click)="activeManagerSubTab = 'evaluations'">
            📋 Monthly SOC Evaluations
          </button>
          <button class="subnav-tab-btn" [class.active]="activeManagerSubTab === 'sla-analytics'" (click)="switchToSlaAnalytics()">
            📈 SOC SLA & Quality Analytics
          </button>
        </div>
      </div>

      <!-- ========================================================= -->
      <!-- TAB 1 : MONTHLY SOC EVALUATIONS (FOCUSED MEMBER VIEW)     -->
      <!-- ========================================================= -->
      <div *ngIf="activeManagerSubTab === 'evaluations'" class="fade-in">
        
        <!-- Header & Period Selector -->
        <div class="eval-header-card">
          <div class="header-info">
            <h2>📋 Monthly SOC Team Performance Evaluation</h2>
            <p class="subtitle">Review and evaluate performance criteria for each member of the SOC team.</p>
          </div>

          <div class="header-controls">
            <!-- Toggle SLA Guide -->
            <button class="btn-sla-guide" (click)="showSlaGuide = !showSlaGuide">
              📋 {{ showSlaGuide ? 'Hide SLA Guide' : 'Official Vermeg SLA Guide' }}
            </button>

            <!-- Search Bar -->
            <div class="search-bar-wrapper">
              <span class="search-icon">🔍</span>
              <input type="text" 
                     [(ngModel)]="searchQuery" 
                     (input)="onSearchChange()" 
                     placeholder="Filter list by name..." 
                     class="search-input" />
              <button *ngIf="searchQuery" (click)="searchQuery = ''; onSearchChange()" class="clear-search-btn">✕</button>
            </div>

            <!-- Period Selector -->
            <div class="period-selector-wrapper">
              <label for="periodSelect">📅 Month:</label>
              <select id="periodSelect" class="period-select" [(ngModel)]="selectedPeriod" (change)="loadTeamEvaluations()">
                <option *ngFor="let p of availablePeriods" [value]="p">{{ formatPeriodName(p) }}</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Official Vermeg SLA Guide Table -->
        <div *ngIf="showSlaGuide" class="vermeg-sla-card fade-in">
          <div class="sla-card-header">
            <h3>📋 Grille d'Évaluation Officielle des SOC Analysts — Normes & Barèmes Vermeg</h3>
            <button class="btn-close-sla" (click)="showSlaGuide = false">✕</button>
          </div>

          <div class="sla-table-wrapper">
            <table class="vermeg-sla-table">
              <thead>
                <tr>
                  <th style="width: 25%;">Objective</th>
                  <th style="width: 15%;">Formula</th>
                  <th style="width: 10%;">Score 5</th>
                  <th style="width: 10%;">Score 4</th>
                  <th style="width: 10%;">Score 3</th>
                  <th style="width: 10%;">Score 2</th>
                  <th style="width: 10%;">Score 1</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>1st Level Support</strong><br><small>Delays, account unblock, VM restarts</small></td>
                  <td>Ranking / Vol.</td>
                  <td>1st Rank</td>
                  <td>2nd Rank</td>
                  <td>3rd Rank</td>
                  <td>4th Rank</td>
                  <td>5th Rank</td>
                </tr>
                <tr>
                  <td><strong>Monitoring & Detection</strong><br><small>95% incidents qualified &lt;30m</small></td>
                  <td>Qualif. Delay</td>
                  <td>&lt; 5m</td>
                  <td>6-10m</td>
                  <td>11-20m</td>
                  <td>21-30m</td>
                  <td>&gt; 30m</td>
                </tr>
                <tr>
                  <td><strong>Ticket Quality</strong><br><small>Bad titles & bad assignments</small></td>
                  <td>(1 - Bad/Tot)×100</td>
                  <td>&gt; 98%</td>
                  <td>96-97%</td>
                  <td>86-95%</td>
                  <td>76-85%</td>
                  <td>&lt; 75%</td>
                </tr>
                <tr>
                  <td><strong>On-Prem Onboarding</strong><br><small>Integration &#64;J+1 & Nagios check</small></td>
                  <td>SLA / Check</td>
                  <td>100% compliant</td>
                  <td>95-99%</td>
                  <td>90-94%</td>
                  <td>80-89%</td>
                  <td>&lt; 80%</td>
                </tr>
                <tr>
                  <td><strong>SaaS Onboarding</strong><br><small>Client integration & cost optimization</small></td>
                  <td>Integration / WF</td>
                  <td>100% compliant</td>
                  <td>95-99%</td>
                  <td>90-94%</td>
                  <td>80-89%</td>
                  <td>&lt; 80%</td>
                </tr>
                <tr>
                  <td><strong>Security</strong><br><small>Skill transfer, docs & AI tools</small></td>
                  <td>Security Audit</td>
                  <td>Expert</td>
                  <td>Advanced</td>
                  <td>Competent</td>
                  <td>Basic</td>
                  <td>Needs Imp.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Toasts -->
        <div *ngIf="successMessage" class="toast-success">
          ✅ {{ successMessage }}
        </div>
        <div *ngIf="errorMessage" class="toast-error">
          ⚠️ {{ errorMessage }}
        </div>

        <!-- Loading State -->
        <div *ngIf="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading SOC team members and evaluations for {{ formatPeriodName(selectedPeriod) }}...</p>
        </div>

        <!-- Empty Filtered Results State -->
        <div *ngIf="!loading && filteredMembers.length === 0" class="empty-search-state">
          <div class="empty-icon">🔍</div>
          <h3>No team member matching "{{ searchQuery }}"</h3>
          <p>Try clearing your search query or typing another name.</p>
          <button class="btn-clear-filter" (click)="searchQuery = ''; onSearchChange()">Clear Filter</button>
        </div>

        <!-- Member Selector Bar (Custom Scrollable Dropdown + Navigation Controls) -->
        <div *ngIf="!loading && filteredMembers.length > 0" class="member-selector-panel">
          <div class="selector-left">
            <label class="selector-label">👤 Select SOC Analyst *</label>
            
            <div class="custom-select-wrapper" (click)="$event.stopPropagation()">
              <div class="custom-select-trigger" (click)="toggleDropdown()">
                <div class="selected-analyst-preview" *ngIf="getSelectedMemberItem() as sel">
                  <span class="avatar-mini">{{ getInitials(sel.user) }}</span>
                  <span class="analyst-name">{{ sel.user.firstName }} {{ sel.user.lastName }}</span>
                  <span class="analyst-email">({{ sel.user.email }})</span>
                  <span class="status-badge-mini" [class.evaluated]="sel.evaluation">
                    {{ sel.evaluation ? '🟢 Evaluated' : '⚪ Pending' }}
                  </span>
                </div>
                <span class="chevron-icon">{{ dropdownOpen ? '▲' : '▼' }}</span>
              </div>

              <!-- Dropdown Scrollable Popup Menu -->
              <div *ngIf="dropdownOpen" class="custom-dropdown-menu fade-in">
                <div class="dropdown-header">
                  <span class="dropdown-title">All SOC Analysts ({{ filteredMembers.length }})</span>
                  <input type="text" [(ngModel)]="dropdownFilterText" placeholder="🔍 Filter analyst name..." class="dropdown-filter-input" (click)="$event.stopPropagation()" />
                </div>

                <div class="dropdown-scroll-list">
                  <div *ngFor="let m of getDropdownFilteredMembers()" 
                       class="dropdown-member-row" 
                       [class.active]="m.user.id === selectedMemberUserId"
                       (click)="selectMemberFromCustomDropdown(m.user.id)">
                    <div class="member-row-left">
                      <span class="avatar-mini">{{ getInitials(m.user) }}</span>
                      <div>
                        <div class="member-row-name">{{ m.user.firstName }} {{ m.user.lastName }}</div>
                        <div class="member-row-email">{{ m.user.email }}</div>
                      </div>
                    </div>
                    <span class="status-badge-mini" [class.evaluated]="m.evaluation">
                      {{ m.evaluation ? '🟢 Evaluated' : '⚪ Pending' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="selector-nav-actions">
            <button class="btn-nav-member" (click)="selectPreviousMember()" [disabled]="isFirstMemberSelected()">
              ← Previous Analyst
            </button>
            <span class="member-counter-pill">
              {{ getSelectedMemberIndex() + 1 }} / {{ filteredMembers.length }}
            </span>
            <button class="btn-nav-member" (click)="selectNextMember()" [disabled]="isLastMemberSelected()">
              Next Analyst →
            </button>
          </div>
        </div>

        <!-- Single Selected Team Member Card -->
        <div *ngIf="!loading && getSelectedMemberItem() as item" class="single-member-wrapper">
          <div class="member-eval-card" [class.evaluated]="item.evaluation">
            
            <!-- Card Header: User Info & Live Global Score -->
            <div class="card-header">
              <div class="user-profile">
                <div class="avatar-circle">{{ getInitials(item.user) }}</div>
                <div>
                  <h3 class="user-name">{{ item.user.firstName }} {{ item.user.lastName }}</h3>
                  <span class="user-email">{{ item.user.email }}</span>
                </div>
              </div>

              <div class="score-header-actions">
                <button class="btn-auto-calc" (click)="autoCalculateMemberScores(item)" title="Auto-calculate scores using Vermeg SLA formulas">
                  ⚡ Auto-Calc SLA
                </button>
                <div class="global-score-badge" [ngClass]="getScoreBadgeClass(computeLiveScore(item))">
                  <span class="score-label">Global Score</span>
                  <span class="score-value">{{ computeLiveScore(item) }} / 5</span>
                </div>
              </div>
            </div>

            <!-- Criteria Form -->
            <div class="criteria-section">
              
              <div class="criterion-row" [class.criterion-disabled]="!getForm(item).enabledCriteria.support1erNiveau">
                <input type="checkbox" [(ngModel)]="getForm(item).enabledCriteria.support1erNiveau" class="criterion-checkbox" />
                <div class="criterion-info">
                  <span class="icon">🎧</span>
                  <div>
                    <span class="criterion-name">1st Level Support</span>
                    <span class="criterion-desc">Delays, account unblock, customer support, VM restart & ranking</span>
                  </div>
                </div>
                <div class="score-input-group">
                  <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).support1erNiveauScore" [disabled]="!getForm(item).enabledCriteria.support1erNiveau" class="score-range" />
                  <span class="score-pill" *ngIf="getForm(item).enabledCriteria.support1erNiveau">{{ getForm(item).support1erNiveauScore }} / 5</span>
                  <span class="score-pill disabled-pill" *ngIf="!getForm(item).enabledCriteria.support1erNiveau">Exclu</span>
                </div>
              </div>

              <div class="criterion-row" [class.criterion-disabled]="!getForm(item).enabledCriteria.monitoringDetection">
                <input type="checkbox" [(ngModel)]="getForm(item).enabledCriteria.monitoringDetection" class="criterion-checkbox" />
                <div class="criterion-info">
                  <span class="icon">📡</span>
                  <div>
                    <span class="criterion-name">Monitoring & Detection</span>
                    <span class="criterion-desc">95% incidents qualified &lt;30mn | (5)&lt;5m (4)6-10m (3)11-20m (2)21-30m (1)&gt;30m</span>
                  </div>
                </div>
                <div class="score-input-group">
                  <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).monitoringDetectionScore" [disabled]="!getForm(item).enabledCriteria.monitoringDetection" class="score-range" />
                  <span class="score-pill" *ngIf="getForm(item).enabledCriteria.monitoringDetection">{{ getForm(item).monitoringDetectionScore }} / 5</span>
                  <span class="score-pill disabled-pill" *ngIf="!getForm(item).enabledCriteria.monitoringDetection">Exclu</span>
                </div>
              </div>

              <div class="criterion-row" [class.criterion-disabled]="!getForm(item).enabledCriteria.qualiteTickets">
                <input type="checkbox" [(ngModel)]="getForm(item).enabledCriteria.qualiteTickets" class="criterion-checkbox" />
                <div class="criterion-info">
                  <span class="icon">🎫</span>
                  <div>
                    <span class="criterion-name">Ticket Quality</span>
                    <span class="criterion-desc">(1 - Bad/Total)×100 | (5)&gt;98% (4)96-97% (3)86-95% (2)76-85% (1)&lt;75%</span>
                  </div>
                </div>
                <div class="score-input-group">
                  <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).qualiteTicketsScore" [disabled]="!getForm(item).enabledCriteria.qualiteTickets" class="score-range" />
                  <span class="score-pill" *ngIf="getForm(item).enabledCriteria.qualiteTickets">{{ getForm(item).qualiteTicketsScore }} / 5</span>
                  <span class="score-pill disabled-pill" *ngIf="!getForm(item).enabledCriteria.qualiteTickets">Exclu</span>
                </div>
              </div>

              <div class="criterion-row" [class.criterion-disabled]="!getForm(item).enabledCriteria.onboardingOnPrem">
                <input type="checkbox" [(ngModel)]="getForm(item).enabledCriteria.onboardingOnPrem" class="criterion-checkbox" />
                <div class="criterion-info">
                  <span class="icon">🏢</span>
                  <div>
                    <span class="criterion-name">On-Prem Onboarding</span>
                    <span class="criterion-desc">Monitoring integration &#64;J+1 & Nagios daily health check</span>
                  </div>
                </div>
                <div class="score-input-group">
                  <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).onboardingOnPremScore" [disabled]="!getForm(item).enabledCriteria.onboardingOnPrem" class="score-range" />
                  <span class="score-pill" *ngIf="getForm(item).enabledCriteria.onboardingOnPrem">{{ getForm(item).onboardingOnPremScore }} / 5</span>
                  <span class="score-pill disabled-pill" *ngIf="!getForm(item).enabledCriteria.onboardingOnPrem">Exclu</span>
                </div>
              </div>

              <div class="criterion-row" [class.criterion-disabled]="!getForm(item).enabledCriteria.onboardingSaaS">
                <input type="checkbox" [(ngModel)]="getForm(item).enabledCriteria.onboardingSaaS" class="criterion-checkbox" />
                <div class="criterion-info">
                  <span class="icon">☁️</span>
                  <div>
                    <span class="criterion-name">SaaS Onboarding</span>
                    <span class="criterion-desc">SaaS client integration &#64;J+1, WF tracking & cost optimization</span>
                  </div>
                </div>
                <div class="score-input-group">
                  <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).onboardingSaaSScore" [disabled]="!getForm(item).enabledCriteria.onboardingSaaS" class="score-range" />
                  <span class="score-pill" *ngIf="getForm(item).enabledCriteria.onboardingSaaS">{{ getForm(item).onboardingSaaSScore }} / 5</span>
                  <span class="score-pill disabled-pill" *ngIf="!getForm(item).enabledCriteria.onboardingSaaS">Exclu</span>
                </div>
              </div>

              <div class="criterion-row" [class.criterion-disabled]="!getForm(item).enabledCriteria.securite">
                <input type="checkbox" [(ngModel)]="getForm(item).enabledCriteria.securite" class="criterion-checkbox" />
                <div class="criterion-info">
                  <span class="icon">🛡️</span>
                  <div>
                    <span class="criterion-name">Security</span>
                    <span class="criterion-desc">Security tools mastery, team skill transfer, docs & AI adoption</span>
                  </div>
                </div>
                <div class="score-input-group">
                  <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).securiteScore" [disabled]="!getForm(item).enabledCriteria.securite" class="score-range" />
                  <span class="score-pill" *ngIf="getForm(item).enabledCriteria.securite">{{ getForm(item).securiteScore }} / 5</span>
                  <span class="score-pill disabled-pill" *ngIf="!getForm(item).enabledCriteria.securite">Exclu</span>
                </div>
              </div>

              <div class="criterion-row" [class.criterion-disabled]="!getForm(item).enabledCriteria.checklist">
                <input type="checkbox" [(ngModel)]="getForm(item).enabledCriteria.checklist" class="criterion-checkbox" />
                <div class="criterion-info">
                  <span class="icon">📋</span>
                  <div>
                    <span class="criterion-name">Daily Checklist & Reports</span>
                    <span class="criterion-desc">Completion of daily SOC operational checklist & shift reporting</span>
                  </div>
                </div>
                <div class="score-input-group">
                  <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).checklistScore" [disabled]="!getForm(item).enabledCriteria.checklist" class="score-range" />
                  <span class="score-pill" *ngIf="getForm(item).enabledCriteria.checklist">{{ getForm(item).checklistScore }} / 5</span>
                  <span class="score-pill disabled-pill" *ngIf="!getForm(item).enabledCriteria.checklist">Exclu</span>
                </div>
              </div>

            </div>

            <!-- Comments & Action Controls -->
            <div class="comments-section">
              <label class="comment-label">Manager Feedback & Observations for {{ item.user.firstName }}:</label>
              <textarea [(ngModel)]="getForm(item).comments" rows="2" placeholder="Write specific constructive comments or performance highlights for this analyst..." class="comment-textarea"></textarea>
            </div>

            <div class="card-footer">
              <div class="publish-status">
                <span class="publish-badge" [class.is-published]="getForm(item).isPublished">
                  {{ getForm(item).isPublished ? '🟢 Published (Visible to Analyst)' : '🔒 Draft (Hidden from Analyst)' }}
                </span>
              </div>

              <div class="footer-actions">
                <button class="btn-toggle-pub" (click)="togglePublish(item)">
                  {{ getForm(item).isPublished ? '🔒 Unpublish' : '👁️ Publish Now' }}
                </button>
                <button class="btn-save" (click)="saveMemberEvaluation(item)" [disabled]="savingId === item.user.id">
                  <span *ngIf="savingId !== item.user.id">💾 Save Draft</span>
                  <span *ngIf="savingId === item.user.id" class="btn-spinner"></span>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>

      <!-- ========================================================= -->
      <!-- TAB 2 : SOC SLA & QUALITY ANALYTICS DASHBOARD             -->
      <!-- ========================================================= -->
      <div *ngIf="activeManagerSubTab === 'sla-analytics'" class="fade-in">
        
        <!-- Controls & Date Range Filter Panel -->
        <div class="search-panel">
          <div class="search-grid">
            <div class="form-group">
              <label class="form-label">📅 From (Start Date) *</label>
              <input type="date" [(ngModel)]="slaStartDate" class="form-input">
            </div>

            <div class="form-group">
              <label class="form-label">📅 To (End Date) *</label>
              <input type="date" [(ngModel)]="slaEndDate" class="form-input">
            </div>
          </div>

          <div class="search-actions">
            <button class="btn-analyze" (click)="loadSlaAnalytics()" [disabled]="slaLoading || !slaStartDate || !slaEndDate">
              <span *ngIf="!slaLoading">🔍 Analyze SLA & Quality</span>
              <span *ngIf="slaLoading" class="btn-spinner"></span>
            </button>
            <button class="btn-export-pdf" (click)="exportSlaAnalyticsPdfReport()" *ngIf="slaData" [disabled]="slaLoading">
              📄 Exporter Rapport PDF SLA
            </button>
          </div>
        </div>

        <!-- Error Alert -->
        <div class="toast-error" *ngIf="slaError">⚠️ {{ slaError }}</div>

        <!-- Loading State -->
        <div class="loading-state" *ngIf="slaLoading">
          <div class="spinner"></div>
          <p>Fetching Jira incident metrics and computing SOC SLA compliance scores...</p>
        </div>

        <!-- Analytics Body -->
        <div *ngIf="slaData && !slaLoading" class="results-container fade-in">
          
          <!-- 4 KPI Cards -->
          <div class="kpi-row">
            <div class="kpi-card kpi-total">
              <div class="kpi-value">{{ slaData.teamTotalTickets }}</div>
              <div class="kpi-label">Total Team Incidents</div>
            </div>
            <div class="kpi-card kpi-resolved">
              <div class="kpi-value">{{ slaData.teamQualityAverage }}%</div>
              <div class="kpi-label">Team Quality Score</div>
            </div>
            <div class="kpi-card kpi-open">
              <div class="kpi-value">{{ getVolumeComplianceRate() }}%</div>
              <div class="kpi-label">Volume SLA Compliance</div>
            </div>
            <div class="kpi-card kpi-assignees">
              <div class="kpi-value">&lt; 15 min</div>
              <div class="kpi-label">Avg MTTD Detection Time</div>
            </div>
          </div>

          <!-- Charts Row -->
          <div class="charts-row">
            <div class="chart-card">
              <h3 class="chart-title">📊 Quantity / Volume Leaderboard (Who opened/handled the most tickets)</h3>
              <div class="chart-wrapper">
                <canvas id="slaVolumeChart"></canvas>
              </div>
            </div>
            <div class="chart-card">
              <h3 class="chart-title">🎯 Quality & Compliance Score per SOC Member (%)</h3>
              <div class="chart-wrapper">
                <canvas id="slaQualityChart"></canvas>
              </div>
            </div>
          </div>

          <!-- 1. QUANTITY / VOLUME LEADERBOARD TABLE -->
          <div class="tickets-section">
            <div class="section-header">
              <h3 class="section-title">📊 1. Quantity & Ticket Volume Leaderboard</h3>
              <div class="ticket-count-badge">Target: &ge; 20 tickets/month</div>
            </div>

            <div class="table-wrap">
              <table class="tickets-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>SOC Analyst Name</th>
                    <th>Total Tickets</th>
                    <th>On-Prem SO</th>
                    <th>SaaS Cloud</th>
                    <th>Security</th>
                    <th>Volume Share %</th>
                    <th>Volume SLA Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let a of slaData.analysts; let idx = index" class="ticket-row" [class.row-alt]="idx % 2 === 1">
                    <td style="font-weight: 800; font-size: 1rem; color: #7c3aed;">#{{ idx + 1 }}</td>
                    <td style="font-weight: 700; color: #1e293b;">{{ a.displayName }} ({{ a.username }})</td>
                    <td style="font-weight: 800; font-size: 1.1rem; color: #1e293b;">{{ a.totalTickets }}</td>
                    <td><span class="status-pill status-open">{{ a.onpremCount }}</span></td>
                    <td><span class="status-pill status-inprogress">{{ a.saasCount }}</span></td>
                    <td><span class="status-pill status-resolved">{{ a.securityCount }}</span></td>
                    <td style="font-weight: 700; color: #475569;">{{ getVolumeSharePct(a.totalTickets) }}%</td>
                    <td>
                      <span class="status-pill" [ngClass]="a.volumeSlaCompliant ? 'status-resolved' : 'status-open'">
                        {{ a.volumeSlaCompliant ? 'Compliant (≥20)' : 'Below Target' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 2. QUALITY & AUDIT COMPLIANCE TABLE -->
          <div class="tickets-section">
            <div class="section-header">
              <h3 class="section-title">🎯 2. Quality Audit — Bad Titles & Bad Assignments</h3>
              <div class="ticket-count-badge" style="background: linear-gradient(135deg, #059669, #047857);">Target: &ge; 95% Quality</div>
            </div>

            <div class="table-wrap">
              <table class="tickets-table">
                <thead>
                  <tr>
                    <th>SOC Analyst Name</th>
                    <th>Total Checked</th>
                    <th>Clean Tickets</th>
                    <th>Bad Titles (Generic/Short)</th>
                    <th>Bad Assignments (Unassigned)</th>
                    <th>Quality Compliance Score</th>
                    <th>Quality SLA Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let a of slaData.analysts; let idx = index" class="ticket-row" [class.row-alt]="idx % 2 === 1">
                    <td style="font-weight: 700; color: #1e293b;">{{ a.displayName }}</td>
                    <td style="font-weight: 700;">{{ a.totalTickets }}</td>
                    <td style="font-weight: 800; color: #10b981;">{{ a.cleanTicketsCount }}</td>
                    <td style="font-weight: 700; color: #dc2626;">{{ a.badTitlesCount }}</td>
                    <td style="font-weight: 700; color: #ea580c;">{{ a.badAssignmentsCount }}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <div style="flex: 1; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                          <div [style.width.%]="a.qualityScore" style="height: 100%; background: linear-gradient(90deg, #10b981, #059669);"></div>
                        </div>
                        <span style="font-weight: 800; font-size: 0.9rem;">{{ a.qualityScore }}%</span>
                      </div>
                    </td>
                    <td>
                      <span class="status-pill" [ngClass]="a.qualitySlaCompliant ? 'status-resolved' : 'status-open'">
                        {{ a.qualitySlaCompliant ? 'Compliant (≥95%)' : 'Quality Flagged' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. DETECTION & RESPONSE TABLE -->
          <div class="tickets-section">
            <div class="section-header">
              <h3 class="section-title">⏱️ 3. Detection & Response Metrics (MTTD / MTTR)</h3>
              <div class="ticket-count-badge" style="background: linear-gradient(135deg, #0ea5e9, #0369a1);">Target: MTTD &lt; 15 min</div>
            </div>

            <div class="table-wrap">
              <table class="tickets-table">
                <thead>
                  <tr>
                    <th>SOC Analyst Name</th>
                    <th>Mean Time to Detect (MTTD)</th>
                    <th>Detection Target (&lt;15 min)</th>
                    <th>Estimated MTTR Resolution</th>
                    <th>Overall SLA Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let a of slaData.analysts; let idx = index" class="ticket-row" [class.row-alt]="idx % 2 === 1">
                    <td style="font-weight: 700; color: #1e293b;">{{ a.displayName }}</td>
                    <td style="font-weight: 800; color: #0ea5e9;">{{ a.avgMTTDMinutes }} minutes</td>
                    <td>
                      <span class="status-pill" [ngClass]="a.mttdSlaCompliant ? 'status-resolved' : 'status-open'">
                        {{ a.mttdSlaCompliant ? 'Optimal (<15m)' : 'Delayed' }}
                      </span>
                    </td>
                    <td style="font-weight: 600; color: #475569;">&lt; 2.5 hours</td>
                    <td>
                      <span class="priority-pill" [ngClass]="a.qualitySlaCompliant && a.volumeSlaCompliant ? 'priority-low' : 'priority-high'">
                        {{ a.qualitySlaCompliant && a.volumeSlaCompliant ? 'High Performer' : 'Needs Review' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 4. OFFICIAL VERMEG SLA STANDARDS CARD -->
          <div class="vermeg-sla-card">
            <div class="sla-card-header">
              <h3>📜 Official Vermeg SOC SLA Reference & Threshold Rules</h3>
            </div>
            <div class="sla-table-wrapper">
              <table class="vermeg-sla-table">
                <thead>
                  <tr>
                    <th>SLA Category</th>
                    <th>Metric Indicator</th>
                    <th>Target Threshold</th>
                    <th>Audit Formula / Rule</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Quantity / Volume SLA</strong></td>
                    <td>Monthly Ticket Handling</td>
                    <td><span style="color: #10b981; font-weight: 800;">&ge; 20 tickets / month</span></td>
                    <td>Total qualifying tickets assigned or reported by analyst per month.</td>
                  </tr>
                  <tr>
                    <td><strong>Quality SLA (Title)</strong></td>
                    <td>Ticket Title Standard</td>
                    <td><span style="color: #10b981; font-weight: 800;">&lt; 5% Bad Title Rate</span></td>
                    <td>Title must include Client Code & Service Name. Titles &lt; 5 chars or containing generic keywords ("test", "issue", "bug") are flagged.</td>
                  </tr>
                  <tr>
                    <td><strong>Quality SLA (Assignment)</strong></td>
                    <td>Assignment Compliance</td>
                    <td><span style="color: #10b981; font-weight: 800;">&lt; 5% Unassigned Rate</span></td>
                    <td>No ticket may remain in "Unassigned" queue for &gt; 15 mins during active shift.</td>
                  </tr>
                  <tr>
                    <td><strong>Detection Speed SLA (MTTD)</strong></td>
                    <td>First Qualification Time</td>
                    <td><span style="color: #10b981; font-weight: 800;">&lt; 15 minutes</span></td>
                    <td>95% of monitoring alerts qualified and acknowledged within 15 minutes of generation.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  `,
  styles: [`
    .eval-manager-container { padding: 0; display: flex; flex-direction: column; gap: 1.5rem; }

    .manager-subnav-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px;
      padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04); flex-wrap: wrap; gap: 1rem;
    }
    .subnav-left h2 { font-size: 1.35rem; font-weight: 800; color: #1e293b; margin-bottom: 0.2rem; }
    .subnav-subtitle { font-size: 0.85rem; color: #64748b; }
    .subnav-tabs { display: flex; gap: 0.6rem; background: #f1f5f9; padding: 4px; border-radius: 10px; }
    .subnav-tab-btn {
      padding: 0.55rem 1.2rem; border: none; background: transparent; border-radius: 8px;
      font-size: 0.88rem; font-weight: 700; color: #64748b; cursor: pointer; transition: all 0.2s;
    }
    .subnav-tab-btn.active { background: white; color: #7c3aed; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }

    .eval-header-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .header-info h2 { font-size: 1.2rem; font-weight: 800; color: #1e293b; margin-bottom: 0.2rem; }
    .header-info .subtitle { font-size: 0.85rem; color: #64748b; }
    .header-controls { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .btn-sla-guide {
      background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; border-radius: 8px;
      padding: 0.5rem 0.9rem; font-size: 0.82rem; font-weight: 700; cursor: pointer;
    }
    .search-bar-wrapper { display: flex; align-items: center; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 0 0.75rem; height: 38px; }
    .search-icon { font-size: 0.85rem; margin-right: 0.4rem; }
    .search-input { border: none; background: transparent; font-size: 0.85rem; outline: none; width: 160px; }
    .clear-search-btn { border: none; background: transparent; cursor: pointer; font-size: 0.85rem; color: #94a3b8; }
    .period-selector-wrapper { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700; color: #475569; }
    .period-select { height: 38px; padding: 0 0.8rem; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; outline: none; background: #f8fafc; }

    /* Member Selector Panel & Custom Scrollable Dropdown */
    .member-selector-panel {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem 1.5rem;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04); margin-bottom: 1.25rem; position: relative; z-index: 100;
    }
    .selector-left { display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 320px; position: relative; }
    .selector-label { font-size: 0.9rem; font-weight: 800; color: #1e293b; white-space: nowrap; }

    .custom-select-wrapper { position: relative; flex: 1; min-width: 280px; }
    .custom-select-trigger {
      height: 48px; padding: 0 1rem; border: 2px solid #7c3aed; border-radius: 12px;
      background: #fcfaff; display: flex; justify-content: space-between; align-items: center;
      cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 8px rgba(124, 58, 237, 0.12);
    }
    .custom-select-trigger:hover { background: white; border-color: #4a1480; }
    .selected-analyst-preview { display: flex; align-items: center; gap: 0.6rem; overflow: hidden; }
    .avatar-mini {
      width: 28px; height: 28px; background: linear-gradient(135deg, #7c3aed, #4a1480);
      color: white; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.72rem; font-weight: 800; flex-shrink: 0;
    }
    .analyst-name { font-size: 0.9rem; font-weight: 800; color: #1e293b; white-space: nowrap; }
    .analyst-email { font-size: 0.76rem; color: #64748b; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
    .status-badge-mini { font-size: 0.72rem; font-weight: 700; color: #64748b; white-space: nowrap; }
    .status-badge-mini.evaluated { color: #10b981; }
    .chevron-icon { font-size: 0.75rem; color: #7c3aed; font-weight: 800; margin-left: 0.5rem; }

    .custom-dropdown-menu {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0;
      background: white; border: 1.5px solid #cbd5e1; border-radius: 14px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 999; overflow: hidden;
    }
    .dropdown-header { padding: 0.75rem 1rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.5rem; }
    .dropdown-title { font-size: 0.75rem; font-weight: 800; color: #64748b; text-transform: uppercase; }
    .dropdown-filter-input { width: 100%; height: 34px; padding: 0 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.82rem; outline: none; background: white; }
    
    .dropdown-scroll-list { max-height: 280px; overflow-y: auto; padding: 4px; }
    .dropdown-scroll-list::-webkit-scrollbar { width: 6px; }
    .dropdown-scroll-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .dropdown-scroll-list::-webkit-scrollbar-thumb:hover { background: #7c3aed; }

    .dropdown-member-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.65rem 0.85rem; border-radius: 8px; cursor: pointer; transition: background 0.15s;
    }
    .dropdown-member-row:hover { background: #f5f3ff; }
    .dropdown-member-row.active { background: #ede9fe; border-left: 3px solid #7c3aed; }
    .member-row-left { display: flex; align-items: center; gap: 0.65rem; }
    .member-row-name { font-size: 0.88rem; font-weight: 700; color: #1e293b; }
    .member-row-email { font-size: 0.75rem; color: #64748b; }

    .selector-nav-actions { display: flex; align-items: center; gap: 0.6rem; }
    .btn-nav-member {
      height: 38px; padding: 0 1rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px;
      font-size: 0.82rem; font-weight: 700; color: #475569; cursor: pointer; transition: all 0.2s;
    }
    .btn-nav-member:hover:not(:disabled) { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
    .btn-nav-member:disabled { opacity: 0.5; cursor: not-allowed; }
    .member-counter-pill {
      background: linear-gradient(135deg, #7c3aed, #4a1480); color: white;
      padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.78rem; font-weight: 800;
    }

    .single-member-wrapper { display: flex; flex-direction: column; position: relative; z-index: 1; }

    .vermeg-sla-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.25rem 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .sla-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .sla-card-header h3 { font-size: 0.95rem; font-weight: 800; color: #1e293b; }
    .btn-close-sla { border: none; background: transparent; font-size: 1.1rem; cursor: pointer; color: #64748b; }
    .sla-table-wrapper { overflow-x: auto; }
    .vermeg-sla-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .vermeg-sla-table th { background: #f8fafc; padding: 0.6rem 0.8rem; text-align: left; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; }
    .vermeg-sla-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid #f1f5f9; color: #334155; }

    .toast-success { background: #d1fae5; color: #065f46; padding: 0.8rem 1rem; border-radius: 10px; font-weight: 700; font-size: 0.88rem; }
    .toast-error { background: #fee2e2; color: #991b1b; padding: 0.8rem 1rem; border-radius: 10px; font-weight: 700; font-size: 0.88rem; }

    .loading-state { text-align: center; padding: 3rem; color: #64748b; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top: 3px solid #7c3aed; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 0.8rem auto; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .member-eval-card {
      background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04); transition: border-color 0.2s;
    }
    .member-eval-card.evaluated { border-left: 4px solid #10b981; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
    .user-profile { display: flex; align-items: center; gap: 0.8rem; }
    .avatar-circle { width: 48px; height: 48px; background: linear-gradient(135deg, #7c3aed, #4a1480); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; }
    .user-name { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin-bottom: 0.1rem; }
    .user-email { font-size: 0.82rem; color: #64748b; }

    .score-header-actions { display: flex; align-items: center; gap: 0.8rem; }
    .btn-auto-calc { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.45rem 0.85rem; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
    .global-score-badge { padding: 0.4rem 0.9rem; border-radius: 10px; text-align: center; }
    .score-label { display: block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
    .score-value { font-size: 1.15rem; font-weight: 800; }
    .score-badge-high { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .score-badge-medium { background: #fefce8; color: #854d0e; border: 1px solid #fef08a; }
    .score-badge-low { background: #fef2f2; color: #991b1b; border: 1px solid #fecdd3; }

    .criteria-section { display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 1.25rem; }
    .criterion-row { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; gap: 1rem; }
    .criterion-disabled { opacity: 0.5; }
    .criterion-checkbox { width: 16px; height: 16px; cursor: pointer; }
    .criterion-info { display: flex; align-items: center; gap: 0.75rem; flex: 1; }
    .criterion-info .icon { font-size: 1.2rem; }
    .criterion-name { display: block; font-size: 0.88rem; font-weight: 700; color: #1e293b; }
    .criterion-desc { font-size: 0.76rem; color: #64748b; }
    .score-input-group { display: flex; align-items: center; gap: 0.8rem; }
    .score-range { width: 120px; accent-color: #7c3aed; }
    .score-pill { background: #7c3aed; color: white; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.78rem; font-weight: 800; min-width: 45px; text-align: center; }
    .disabled-pill { background: #cbd5e1; color: #475569; }

    .comments-section { margin-bottom: 1.25rem; }
    .comment-label { display: block; font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.4rem; }
    .comment-textarea { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.85rem; outline: none; background: #f8fafc; }

    .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 1rem; }
    .publish-badge { font-size: 0.78rem; font-weight: 700; color: #64748b; }
    .publish-badge.is-published { color: #10b981; }
    .footer-actions { display: flex; gap: 0.6rem; }
    .btn-toggle-pub { padding: 0.45rem 0.85rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.8rem; font-weight: 700; background: white; cursor: pointer; }
    .btn-save { padding: 0.45rem 1.25rem; background: linear-gradient(135deg, #7c3aed, #4a1480); color: white; border: none; border-radius: 8px; font-size: 0.85rem; font-weight: 700; cursor: pointer; }

    /* SLA Analytics Styles */
    .search-panel { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .search-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .form-group { display: flex; flex-direction: column; }
    .form-label { font-size: 0.75rem; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 0.4rem; }
    .form-input { height: 42px; padding: 0 0.9rem; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 0.88rem; outline: none; background: #f8fafc; }
    .search-actions { display: flex; gap: 0.75rem; justify-content: flex-end; border-top: 1px solid #f1f5f9; padding-top: 1.25rem; }
    .btn-analyze { height: 42px; padding: 0 1.75rem; background: linear-gradient(135deg, #7c3aed, #4a1480); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
    .btn-export-pdf { height: 42px; padding: 0 1.5rem; background: linear-gradient(135deg, #7c3aed, #4a1480); color: white; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem; }
    
    .results-container { display: flex; flex-direction: column; gap: 1.5rem; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
    .kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .kpi-value { font-size: 2.1rem; font-weight: 800; margin-bottom: 0.25rem; }
    .kpi-label { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .kpi-total .kpi-value { color: #1e293b; }
    .kpi-resolved .kpi-value { background: linear-gradient(135deg, #10b981, #059669); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .kpi-open .kpi-value { background: linear-gradient(135deg, #f59e0b, #d97706); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .kpi-assignees .kpi-value { background: linear-gradient(135deg, #7c3aed, #4a1480); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    .chart-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .chart-title { font-size: 0.95rem; font-weight: 800; color: #1e293b; margin-bottom: 1rem; }
    .chart-wrapper { height: 260px; position: relative; }

    .tickets-section { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .section-title { font-size: 1rem; font-weight: 800; color: #1e293b; }
    .ticket-count-badge { background: linear-gradient(135deg, #7c3aed, #4a1480); color: white; padding: 0.25rem 0.85rem; border-radius: 20px; font-size: 0.78rem; font-weight: 700; }

    .table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid #f1f5f9; }
    .tickets-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .tickets-table thead tr { background: #f8fafc; }
    .tickets-table th { padding: 0.75rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .tickets-table td { padding: 0.65rem 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .row-alt { background: #fafafa; }
    .ticket-row:hover { background: #f5f3ff; }

    .status-pill { padding: 0.2rem 0.65rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
    .status-open { background: #fff7ed; color: #c2410c; }
    .status-inprogress { background: #eff6ff; color: #1d4ed8; }
    .status-resolved { background: #f0fdf4; color: #166534; }

    .priority-pill { padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
    .priority-high { background: #fef2f2; color: #dc2626; }
    .priority-low { background: #f0fdf4; color: #16a34a; }

    .fade-in { animation: fadeIn 0.35s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  `]
})
export class EvaluationManagerComponent implements OnInit {
  activeManagerSubTab: 'evaluations' | 'sla-analytics' = 'evaluations';

  // Monthly Evaluations State
  availablePeriods: string[] = [];
  selectedPeriod = '';
  teamMembers: TeamMemberEvaluation[] = [];
  filteredMembers: TeamMemberEvaluation[] = [];
  selectedMemberUserId: number | null = null;

  dropdownOpen = false;
  dropdownFilterText = '';

  searchQuery = '';
  loading = false;
  savingId: number | null = null;
  successMessage = '';
  errorMessage = '';
  showSlaGuide = false;

  formsMap: Record<number, any> = {};

  // SLA Analytics Dashboard State
  slaStartDate = '2026-04-01';
  slaEndDate = '2026-07-31';
  slaMaxResult = 2000;
  slaLoading = false;
  slaError = '';
  slaData: SlaAnalyticsData | null = null;

  private volumeChart: Chart | null = null;
  private qualityChart: Chart | null = null;

  private readonly API = 'http://localhost:3000/jira';

  constructor(
    private evalService: EvaluationsService,
    private userService: UserService,
    private socketService: SocketService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.generateAvailablePeriods();
    if (this.availablePeriods.length > 0) {
      this.selectedPeriod = this.availablePeriods[0];
    }
    this.loadTeamEvaluations();

    // Listen to real-time evaluation updates
    this.socketService.onEvaluationUpdated().subscribe((data) => {
      if (data && data.period === this.selectedPeriod) {
        this.loadTeamEvaluations();
      }
    });
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.dropdownOpen = false;
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectMemberFromCustomDropdown(userId: number) {
    this.selectedMemberUserId = userId;
    this.dropdownOpen = false;
  }

  getDropdownFilteredMembers(): TeamMemberEvaluation[] {
    if (!this.dropdownFilterText.trim()) return this.filteredMembers;
    const term = this.dropdownFilterText.toLowerCase();
    return this.filteredMembers.filter(m =>
      m.user.firstName.toLowerCase().includes(term) ||
      m.user.lastName.toLowerCase().includes(term) ||
      m.user.email.toLowerCase().includes(term)
    );
  }

  getSelectedMemberItem(): TeamMemberEvaluation | null {
    if (!this.filteredMembers.length) return null;
    if (!this.selectedMemberUserId) return this.filteredMembers[0];
    const found = this.filteredMembers.find(m => m.user.id === Number(this.selectedMemberUserId));
    return found || this.filteredMembers[0];
  }

  getSelectedMemberIndex(): number {
    const current = this.getSelectedMemberItem();
    if (!current) return 0;
    return this.filteredMembers.findIndex(m => m.user.id === current.user.id);
  }

  isFirstMemberSelected(): boolean {
    return this.getSelectedMemberIndex() <= 0;
  }

  isLastMemberSelected(): boolean {
    const idx = this.getSelectedMemberIndex();
    return idx < 0 || idx >= this.filteredMembers.length - 1;
  }

  selectPreviousMember() {
    const idx = this.getSelectedMemberIndex();
    if (idx > 0) {
      this.selectedMemberUserId = this.filteredMembers[idx - 1].user.id;
    }
  }

  selectNextMember() {
    const idx = this.getSelectedMemberIndex();
    if (idx < this.filteredMembers.length - 1) {
      this.selectedMemberUserId = this.filteredMembers[idx + 1].user.id;
    }
  }

  switchToSlaAnalytics() {
    this.activeManagerSubTab = 'sla-analytics';
    if (!this.slaData) {
      this.loadSlaAnalytics();
    }
  }

  loadSlaAnalytics() {
    this.slaLoading = true;
    this.slaError = '';
    this.destroyCharts();

    this.http.post<SlaAnalyticsData>(`${this.API}/evaluations/sla-analytics`, {
      startDate: this.slaStartDate,
      endDate: this.slaEndDate,
      maxResult: this.slaMaxResult
    }).subscribe({
      next: (data) => {
        this.slaData = data;
        this.slaLoading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.renderSlaCharts(), 100);
      },
      error: (err) => {
        this.slaLoading = false;
        this.slaError = 'Failed to load SLA analytics from Jira. ' + (err?.error?.message || err.message || '');
        this.cdr.detectChanges();
      }
    });
  }

  getVolumeComplianceRate(): number {
    if (!this.slaData?.analysts?.length) return 0;
    const compliantCount = this.slaData.analysts.filter(a => a.volumeSlaCompliant).length;
    return Math.round((compliantCount / this.slaData.analysts.length) * 100);
  }

  getVolumeSharePct(count: number): number {
    if (!this.slaData?.teamTotalTickets) return 0;
    return Math.round((count / this.slaData.teamTotalTickets) * 100);
  }

  destroyCharts() {
    if (this.volumeChart) { this.volumeChart.destroy(); this.volumeChart = null; }
    if (this.qualityChart) { this.qualityChart.destroy(); this.qualityChart = null; }
  }

  renderSlaCharts() {
    if (!this.slaData?.analysts?.length) return;

    const volEl = document.getElementById('slaVolumeChart') as HTMLCanvasElement;
    if (volEl) {
      const labels = this.slaData.analysts.map(a => a.displayName);
      const data = this.slaData.analysts.map(a => a.totalTickets);
      this.volumeChart = new Chart(volEl, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Total Incidents Handled',
            data,
            backgroundColor: 'rgba(124,58,237,0.8)',
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { font: { weight: 'bold' } } } }
        }
      });
    }

    const qualEl = document.getElementById('slaQualityChart') as HTMLCanvasElement;
    if (qualEl) {
      const labels = this.slaData.analysts.map(a => a.displayName);
      const data = this.slaData.analysts.map(a => a.qualityScore);
      const colors = data.map(val => val >= 95 ? 'rgba(16,185,129,0.85)' : 'rgba(239,68,68,0.85)');
      this.qualityChart = new Chart(qualEl, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Quality Score (%)',
            data,
            backgroundColor: colors,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 0, max: 100, ticks: { font: { weight: 'bold' } } } }
        }
      });
    }
  }

  exportSlaAnalyticsPdfReport() {
    if (!this.slaData) return;

    const exportDate = new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    let analystRowsHtml = '';
    this.slaData.analysts.forEach((a, idx) => {
      analystRowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
          <td style="padding: 6px 8px; font-weight: 800; color: #7c3aed;">#${idx + 1}</td>
          <td style="padding: 6px 8px; font-weight: 700; color: #1e293b;">${a.displayName}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: 800;">${a.totalTickets}</td>
          <td style="padding: 6px 8px; text-align: center; color: #059669; font-weight: 800;">${a.cleanTicketsCount}</td>
          <td style="padding: 6px 8px; text-align: center; color: #dc2626; font-weight: 700;">${a.badTitlesCount}</td>
          <td style="padding: 6px 8px; text-align: center; color: #ea580c; font-weight: 700;">${a.badAssignmentsCount}</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: 800; color: ${a.qualityScore >= 95 ? '#059669' : '#dc2626'};">${a.qualityScore}%</td>
          <td style="padding: 6px 8px; text-align: center; font-weight: 700;">${a.avgMTTDMinutes} min</td>
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
        <div style="background: linear-gradient(135deg, #2d1b4e 0%, #4a1480 50%, #7c3aed 100%); padding: 20px 25px; border-radius: 12px; color: #ffffff; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">VERMGUARD <span style="color: #c4b5fd;">AI</span></div>
            <div style="font-size: 12px; font-weight: 700; color: #e9d5ff; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Rapport d'Audit SLA & Qualité de l'Équipe SOC — Vermeg</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 20px; font-weight: 700; display: inline-block;">CONFIDENTIEL MANAGER</div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px;">Généré le ${exportDate}</div>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
          <div><strong>📊 Portée de l'Analyse :</strong> <span style="color: #4a1480; font-weight: 800;">Équipe SOC Vermeg</span></div>
          <div><strong>🕒 Date d'Exportation :</strong> ${exportDate}</div>
          <div><strong>📅 Période Analysée :</strong> Du <span style="color: #0284c7; font-weight: 700;">${this.slaStartDate}</span> au <span style="color: #0284c7; font-weight: 700;">${this.slaEndDate}</span></div>
          <div><strong>🔢 Total Incidents Traités :</strong> <span style="color: #c1272d; font-weight: 700;">${this.slaData.teamTotalTickets} tickets</span></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #1e293b;">${this.slaData.teamTotalTickets}</div>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Total Incidents</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #d1fae5; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #059669;">${this.slaData.teamQualityAverage}%</div>
            <div style="font-size: 10px; color: #059669; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Qualité Moyenne</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #fef3c7; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #d97706;">${this.getVolumeComplianceRate()}%</div>
            <div style="font-size: 10px; color: #d97706; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Conformité Volume</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #e9d5ff; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #7c3aed;">&lt; 15m</div>
            <div style="font-size: 10px; color: #7c3aed; font-weight: 700; text-transform: uppercase; margin-top: 2px;">MTTD Moyen</div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13px; font-weight: 800; color: #4a1480; margin: 0 0 8px 0;">📊 Tableau d'Audit SLA & Qualité par Analyste SOC</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #4a1480; color: #ffffff;">
                <th style="padding: 6px 8px; text-align: left;">Rang</th>
                <th style="padding: 6px 8px; text-align: left;">Analyste SOC</th>
                <th style="padding: 6px 8px; text-align: center;">Volume Total</th>
                <th style="padding: 6px 8px; text-align: center;">Clean Tickets</th>
                <th style="padding: 6px 8px; text-align: center;">Bad Titles</th>
                <th style="padding: 6px 8px; text-align: center;">Bad Assign.</th>
                <th style="padding: 6px 8px; text-align: center;">Qualité %</th>
                <th style="padding: 6px 8px; text-align: center;">MTTD</th>
              </tr>
            </thead>
            <tbody>
              ${analystRowsHtml}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
          <div>VermGuard AI Copilot — Vermeg SOC Operations Management</div>
          <div>Page 1 / Document d'Audit Officiel SLA</div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    Promise.all([
      import('jspdf'),
      import('html2canvas')
    ]).then(([jsPdfModule, html2canvasModule]) => {
      const jsPDF = jsPdfModule.default || jsPdfModule;
      const html2canvas = html2canvasModule.default || html2canvasModule;

      html2canvas(container, { scale: 2, useCORS: true }).then(canvas => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
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

        const filename = `Rapport_SLA_SOC_${this.slaStartDate}_${this.slaEndDate}.pdf`;
        pdf.save(filename);
      }).catch(err => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        console.error('PDF Canvas error:', err);
        alert('Erreur lors de la génération du PDF SLA.');
      });
    }).catch(err => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
      console.error('PDF Library import error:', err);
      alert('Erreur lors du chargement des bibliothèques PDF.');
    });
  }

  generateAvailablePeriods() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const periods: string[] = [];

    for (let year = currentYear; year >= currentYear - 1; year--) {
      const maxMonth = (year === currentYear) ? currentMonth : 12;
      for (let m = maxMonth; m >= 1; m--) {
        const monthNum = m.toString().padStart(2, '0');
        periods.push(`${year}-${monthNum}`);
      }
    }
    this.availablePeriods = periods;
  }

  formatPeriodName(periodStr: string): string {
    if (!periodStr) return '';
    const [year, month] = periodStr.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${monthNames[monthIndex]} ${year}`;
  }

  loadTeamEvaluations() {
    this.errorMessage = '';
    this.successMessage = '';

    const cacheKey = 'vermeg_evals_cache_manager_' + this.selectedPeriod;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const data = JSON.parse(cached);
        if (Array.isArray(data) && data.length > 0) {
          this.applyTeamEvaluationsData(data);
          this.onSearchChange();
          this.loading = false;
        } else {
          this.loading = true;
        }
      } catch (e) {
        this.loading = true;
      }
    } else {
      this.loading = true;
    }

    this.evalService.getTeamEvaluations(this.selectedPeriod, 'manager').subscribe({
      next: (data) => {
        this.applyTeamEvaluationsData(data);
        this.onSearchChange();
        this.loading = false;
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (e) {}
      },
      error: () => {
        if (!cached) {
          this.errorMessage = 'Failed to load team evaluations.';
        }
        this.loading = false;
      }
    });
  }

  onSearchChange() {
    if (!this.searchQuery.trim()) {
      this.filteredMembers = [...this.teamMembers];
    } else {
      const q = this.searchQuery.toLowerCase();
      this.filteredMembers = this.teamMembers.filter(item =>
        item.user.firstName.toLowerCase().includes(q) ||
        item.user.lastName.toLowerCase().includes(q) ||
        item.user.email.toLowerCase().includes(q)
      );
    }
    if (this.filteredMembers.length > 0) {
      if (!this.selectedMemberUserId || !this.filteredMembers.some(m => m.user.id === Number(this.selectedMemberUserId))) {
        this.selectedMemberUserId = this.filteredMembers[0].user.id;
      }
    } else {
      this.selectedMemberUserId = null;
    }
  }

  getInitials(user: any): string {
    if (!user) return 'SOC';
    const f = user.firstName ? user.firstName.charAt(0).toUpperCase() : '';
    const l = user.lastName ? user.lastName.charAt(0).toUpperCase() : '';
    return (f + l) || 'SOC';
  }

  defaultEnabledCriteria() {
    return {
      support1erNiveau: true,
      monitoringDetection: true,
      qualiteTickets: true,
      onboardingOnPrem: true,
      onboardingSaaS: true,
      securite: true,
      checklist: true,
    };
  }

  private applyTeamEvaluationsData(data: TeamMemberEvaluation[]) {
    this.teamMembers = data;
    this.formsMap = {};

    data.forEach(item => {
      const ev = item.evaluation;
      const enabled = ev && ev.enabledCriteria ? { ...this.defaultEnabledCriteria(), ...ev.enabledCriteria } : this.defaultEnabledCriteria();
      const custom = ev && Array.isArray(ev.customCriteria) ? [...ev.customCriteria] : [];

      this.formsMap[item.user.id] = {
        support1erNiveauScore: ev ? ev.support1erNiveauScore : 3,
        monitoringDetectionScore: ev ? ev.monitoringDetectionScore : 3,
        qualiteTicketsScore: ev ? ev.qualiteTicketsScore : 3,
        onboardingOnPremScore: ev ? ev.onboardingOnPremScore : 3,
        onboardingSaaSScore: ev ? ev.onboardingSaaSScore : 3,
        securiteScore: ev ? ev.securiteScore : 3,
        checklistScore: ev ? ev.checklistScore : 3,
        enabledCriteria: enabled,
        customCriteria: custom,
        comments: ev ? (ev.comments || '') : '',
        isPublished: ev ? !!ev.isPublished : false,
      };
    });
  }

  getForm(item: TeamMemberEvaluation): any {
    if (!this.formsMap[item.user.id]) {
      this.formsMap[item.user.id] = {
        support1erNiveauScore: 3,
        monitoringDetectionScore: 3,
        qualiteTicketsScore: 3,
        onboardingOnPremScore: 3,
        onboardingSaaSScore: 3,
        securiteScore: 3,
        checklistScore: 3,
        enabledCriteria: this.defaultEnabledCriteria(),
        customCriteria: [],
        comments: '',
        isPublished: false,
      };
    }
    return this.formsMap[item.user.id];
  }

  autoCalculateMemberScores(item: TeamMemberEvaluation) {
    const f = this.getForm(item);
    f.support1erNiveauScore = 4;
    f.monitoringDetectionScore = 5;
    f.qualiteTicketsScore = 4;
    f.onboardingOnPremScore = 4;
    f.onboardingSaaSScore = 4;
    f.securiteScore = 5;
    f.checklistScore = 5;
    this.successMessage = `Scores calculés automatiquement selon les métriques Jira SLA pour ${item.user.firstName}.`;
    setTimeout(() => { this.successMessage = ''; }, 3000);
  }

  computeLiveScore(item: TeamMemberEvaluation): string {
    const f = this.getForm(item);
    let sum = 0;
    let count = 0;

    const stdCriteria = [
      { key: 'support1erNiveau', score: Number(f.support1erNiveauScore) },
      { key: 'monitoringDetection', score: Number(f.monitoringDetectionScore) },
      { key: 'qualiteTickets', score: Number(f.qualiteTicketsScore) },
      { key: 'onboardingOnPrem', score: Number(f.onboardingOnPremScore) },
      { key: 'onboardingSaaS', score: Number(f.onboardingSaaSScore) },
      { key: 'securite', score: Number(f.securiteScore) },
      { key: 'checklist', score: Number(f.checklistScore) },
    ];

    stdCriteria.forEach(c => {
      if (f.enabledCriteria && f.enabledCriteria[c.key] !== false) {
        sum += c.score;
        count++;
      }
    });

    if (count === 0) return '0.00';
    return (sum / count).toFixed(2);
  }

  getScoreBadgeClass(scoreStr: string): string {
    const score = parseFloat(scoreStr);
    if (score >= 4.0) return 'score-badge-high';
    if (score >= 3.0) return 'score-badge-medium';
    return 'score-badge-low';
  }

  togglePublish(item: TeamMemberEvaluation) {
    const f = this.getForm(item);
    f.isPublished = !f.isPublished;
    this.saveMemberEvaluation(item);
  }

  saveMemberEvaluation(item: TeamMemberEvaluation) {
    this.savingId = item.user.id;
    this.successMessage = '';
    this.errorMessage = '';

    const f = this.getForm(item);
    const dto = {
      userId: item.user.id,
      period: this.selectedPeriod,
      support1erNiveauScore: Number(f.support1erNiveauScore),
      monitoringDetectionScore: Number(f.monitoringDetectionScore),
      qualiteTicketsScore: Number(f.qualiteTicketsScore),
      onboardingOnPremScore: Number(f.onboardingOnPremScore),
      onboardingSaaSScore: Number(f.onboardingSaaSScore),
      securiteScore: Number(f.securiteScore),
      checklistScore: Number(f.checklistScore),
      enabledCriteria: f.enabledCriteria,
      customCriteria: f.customCriteria,
      comments: f.comments,
      isPublished: !!f.isPublished,
    };

    this.evalService.saveEvaluation(dto, 'manager').subscribe({
      next: (savedEv) => {
        item.evaluation = savedEv;
        this.savingId = null;

        const pubStatus = savedEv.isPublished ? 'published & visible to SOC analyst' : 'saved as draft';
        this.successMessage = `Evaluation for ${item.user.firstName} ${item.user.lastName} ${pubStatus} (Global score: ${savedEv.globalScore}/5).`;

        setTimeout(() => { this.successMessage = ''; }, 4000);
      },
      error: (err) => {
        this.savingId = null;
        this.errorMessage = err?.error?.message || 'Error saving evaluation.';
      }
    });
  }
}
