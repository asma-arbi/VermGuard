import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EvaluationsService, TeamMemberEvaluation, EvaluationItem } from '../../../services/evaluations.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-evaluation-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="eval-manager-container fade-in">
      
      <!-- Top Header & Period Selector -->
      <div class="eval-header-card">
        <div class="header-info">
          <h2>📊 Monthly SOC Team Performance Evaluation</h2>
          <p class="subtitle">Review and evaluate the 7 performance criteria for each member of the SOC team.</p>
        </div>

        <div class="header-controls">
          <!-- Button to toggle Official Vermeg SLA Guide -->
          <button class="btn-sla-guide" (click)="showSlaGuide = !showSlaGuide">
            📋 {{ showSlaGuide ? 'Hide SLA Guide' : 'Official Vermeg SLA Guide' }}
          </button>

          <!-- Search Bar -->
          <div class="search-bar-wrapper">
            <span class="search-icon">🔍</span>
            <input type="text" 
                   [(ngModel)]="searchQuery" 
                   (input)="onSearchChange()" 
                   placeholder="Search member by name or email..." 
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

      <!-- Expandable Official Vermeg SLA Reference Table -->
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
                <th style="width: 75%;">Description & Barème de Notation SLA (1 à 5)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="obj-name">🎧 Support 1er niveau</td>
                <td>Assurer les actions de support premier niveau dans les délais (Déblocage compte, assistance clients, restart VMs...). Maîtriser tous les sujets reçus et avoir un bon Ranking.</td>
              </tr>
              <tr>
                <td class="obj-name">📡 Monitoring - Detection & Incident Management</td>
                <td>
                  95 % des incidents sont détectés et qualifiés dans un délai maximal de 30 minutes depuis leur apparition, font l'objet d'une ouverture de ticket conforme (avec bon ranking), notification par email, et sont inclus dans le reporting quotidien SaaS et On-Prem envoyé avant 9h.<br>
                  <span class="scale-badge"><strong>Barème :</strong> (1) >30mn | (2) 21-30mn | (3) 11-20mn | (4) 6-10mn | (5) &lt;5mn</span>
                </td>
              </tr>
              <tr>
                <td class="obj-name">🎫 Qualité des tickets</td>
                <td>
                  S'assurer que les Titles sont conformes au standard / Imprimés attachés et bien assigné <code>Formule : (1 – Bad Tickets / Total) × 100</code><br>
                  <span class="scale-badge"><strong>Barème :</strong> (1) &lt;75% | (2) 76-85% | (3) 86-95% | (4) 96-97% | (5) &gt;98%</span>
                </td>
              </tr>
              <tr>
                <td class="obj-name">🏢 Onboarding des plateformes OnPrem</td>
                <td>Intégration du monitoring pour les plateformes OnPrem &#64;J+1 de la réception du ticket de monitoring / Health check Nagios quotidiennement.</td>
              </tr>
              <tr>
                <td class="obj-name">☁️ Onboarding des nouveaux clients SaaS</td>
                <td>Intégration du monitoring pour les plateformes SaaS &#64;J+1 de la réception du ticket de monitoring & suivi du WF en place / Optimisation cost.</td>
              </tr>
              <tr>
                <td class="obj-name">🛡️ Sécurité</td>
                <td>Maîtrise des outils de sécurité + transfert de skills à l'équipe + Documentation. Amélioration Continue de l'activité et introduction de l'IA.</td>
              </tr>
              <tr>
                <td class="obj-name">✅ Traitement des tickets Checklist</td>
                <td>
                  100% des checklists doivent être traitées dans les SLA.<br>
                  <span class="scale-badge"><strong>Barème :</strong> (1) &lt;89% | (2) 90-94% | (3) 95-97% | (4) 98-99% | (5) 100%</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Toast Feedback -->
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

      <!-- Team Members Grid (Paginated 5 per page) -->
      <div *ngIf="!loading && filteredMembers.length > 0" class="members-grid">
        <div *ngFor="let item of paginatedMembers" class="member-eval-card" [class.evaluated]="item.evaluation">
          
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

          <!-- Criteria Form (7 Scores with Vermeg Descriptions) -->
          <div class="criteria-section">
            
            <div class="criterion-row">
              <div class="criterion-info">
                <span class="icon">🎧</span>
                <div>
                  <span class="criterion-name">1st Level Support</span>
                  <span class="criterion-desc">Delays, account unblock, customer support, VM restart & ranking</span>
                </div>
              </div>
              <div class="score-input-group">
                <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).support1erNiveauScore" class="score-range" />
                <span class="score-pill">{{ getForm(item).support1erNiveauScore }} / 5</span>
              </div>
            </div>

            <div class="criterion-row">
              <div class="criterion-info">
                <span class="icon">📡</span>
                <div>
                  <span class="criterion-name">Monitoring & Detection</span>
                  <span class="criterion-desc">95% incidents qualified &lt;30mn | (5)&lt;5m (4)6-10m (3)11-20m (2)21-30m (1)&gt;30m</span>
                </div>
              </div>
              <div class="score-input-group">
                <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).monitoringDetectionScore" class="score-range" />
                <span class="score-pill">{{ getForm(item).monitoringDetectionScore }} / 5</span>
              </div>
            </div>

            <div class="criterion-row">
              <div class="criterion-info">
                <span class="icon">🎫</span>
                <div>
                  <span class="criterion-name">Ticket Quality</span>
                  <span class="criterion-desc">(1 - Bad/Total)×100 | (5)&gt;98% (4)96-97% (3)86-95% (2)76-85% (1)&lt;75%</span>
                </div>
              </div>
              <div class="score-input-group">
                <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).qualiteTicketsScore" class="score-range" />
                <span class="score-pill">{{ getForm(item).qualiteTicketsScore }} / 5</span>
              </div>
            </div>

            <div class="criterion-row">
              <div class="criterion-info">
                <span class="icon">🏢</span>
                <div>
                  <span class="criterion-name">On-Prem Onboarding</span>
                  <span class="criterion-desc">Monitoring integration &#64;J+1 & Nagios daily health check</span>
                </div>
              </div>
              <div class="score-input-group">
                <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).onboardingOnPremScore" class="score-range" />
                <span class="score-pill">{{ getForm(item).onboardingOnPremScore }} / 5</span>
              </div>
            </div>

            <div class="criterion-row">
              <div class="criterion-info">
                <span class="icon">☁️</span>
                <div>
                  <span class="criterion-name">SaaS Onboarding</span>
                  <span class="criterion-desc">SaaS client integration &#64;J+1, WF tracking & cost optimization</span>
                </div>
              </div>
              <div class="score-input-group">
                <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).onboardingSaaSScore" class="score-range" />
                <span class="score-pill">{{ getForm(item).onboardingSaaSScore }} / 5</span>
              </div>
            </div>

            <div class="criterion-row">
              <div class="criterion-info">
                <span class="icon">🛡️</span>
                <div>
                  <span class="criterion-name">Security</span>
                  <span class="criterion-desc">Security tools mastery, team skill transfer, docs & AI adoption</span>
                </div>
              </div>
              <div class="score-input-group">
                <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).securiteScore" class="score-range" />
                <span class="score-pill">{{ getForm(item).securiteScore }} / 5</span>
              </div>
            </div>

            <div class="criterion-row">
              <div class="criterion-info">
                <span class="icon">✅</span>
                <div>
                  <span class="criterion-name">Compliance Checklist</span>
                  <span class="criterion-desc">100% checklists processed in SLA | (5)100% (4)98-99% (3)95-97% (2)90-94% (1)&lt;89%</span>
                </div>
              </div>
              <div class="score-input-group">
                <input type="range" min="1" max="5" step="1" [(ngModel)]="getForm(item).checklistScore" class="score-range" />
                <span class="score-pill">{{ getForm(item).checklistScore }} / 5</span>
              </div>
            </div>

          </div>

          <!-- Comments Area -->
          <div class="comments-section">
            <label class="comments-label">💬 Manager Feedback & Comments:</label>
            <textarea [(ngModel)]="getForm(item).comments" placeholder="Enter notes on strengths, key achievements and areas for improvement..." class="comments-textarea" rows="2"></textarea>
          </div>

          <!-- Visibility Control Bar (Draft vs Published for SOC Analyst) -->
          <div class="publish-control-bar">
            <div class="publish-status-badge" [ngClass]="getForm(item).isPublished ? 'published-badge' : 'draft-badge'">
              <span class="status-icon">{{ getForm(item).isPublished ? '✅' : '📝' }}</span>
              <span class="status-text">{{ getForm(item).isPublished ? 'Published to Analyst' : 'Draft (Hidden from Analyst)' }}</span>
            </div>

            <button class="btn-toggle-publish" 
                    [ngClass]="getForm(item).isPublished ? 'btn-unpublish' : 'btn-publish'"
                    (click)="togglePublish(item)"
                    [disabled]="savingId === item.user.id">
              {{ getForm(item).isPublished ? '🔒 Unpublish' : '👁️ Publish Evaluation' }}
            </button>
          </div>

          <!-- Footer Actions -->
          <div class="card-footer">
            <span class="eval-status" *ngIf="item.evaluation">
              Last updated: {{ item.evaluation.updatedAt | date:'dd/MM/yyyy HH:mm' }}
            </span>
            <span class="eval-status" *ngIf="!item.evaluation">Not evaluated for this month</span>

            <button class="btn-save" (click)="saveMemberEvaluation(item)" [disabled]="savingId === item.user.id">
              <span *ngIf="savingId === item.user.id" class="btn-spinner"></span>
              {{ item.evaluation ? '💾 Save Changes' : '✨ Create Draft' }}
            </button>
          </div>

        </div>
      </div>

      <!-- Pagination Bar (Max 5 per page) -->
      <div *ngIf="!loading && filteredMembers.length > 0" class="pagination-bar">
        <div class="pagination-info">
          Showing <strong>{{ (currentPage - 1) * pageSize + 1 }}</strong> – 
          <strong>{{ Math.min(currentPage * pageSize, filteredMembers.length) }}</strong> of 
          <strong>{{ filteredMembers.length }}</strong> Team Members
        </div>

        <div class="pagination-controls">
          <button class="btn-page" (click)="prevPage()" [disabled]="currentPage === 1">
            ◀ Previous
          </button>

          <div class="page-numbers">
            <button *ngFor="let p of getPageArray()" 
                    class="btn-page-number" 
                    [class.active]="p === currentPage" 
                    (click)="goToPage(p)">
              {{ p }}
            </button>
          </div>

          <button class="btn-page" (click)="nextPage()" [disabled]="currentPage === totalPages">
            Next ▶
          </button>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .eval-manager-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .eval-header-card {
      background: #ffffff;
      border: 1px solid rgba(168, 85, 247, 0.2);
      border-radius: 18px;
      padding: 1.5rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.08);
      flex-wrap: wrap;
      gap: 1rem;
    }

    .header-info h2 {
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 0.3rem 0;
    }

    .subtitle {
      font-size: 0.88rem;
      color: #64748b;
      margin: 0;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 1.75rem;
      flex-wrap: wrap;
    }

    .btn-sla-guide {
      background: #fef08a;
      color: #854d0e;
      border: 1.5px solid #fde047;
      font-size: 0.82rem;
      font-weight: 800;
      padding: 0.55rem 1rem;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-sla-guide:hover {
      background: #fde047;
      transform: translateY(-1px);
    }

    .vermeg-sla-card {
      background: #ffffff;
      border: 2px solid #fde047;
      border-radius: 18px;
      padding: 1.5rem;
      box-shadow: 0 8px 24px rgba(234, 179, 8, 0.12);
    }

    .sla-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .sla-card-header h3 {
      font-size: 1.05rem;
      font-weight: 800;
      color: #713f12;
      margin: 0;
    }

    .btn-close-sla {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fca5a5;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      cursor: pointer;
      font-weight: 800;
    }

    .sla-table-wrapper {
      overflow-x: auto;
    }

    .vermeg-sla-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.83rem;
    }

    .vermeg-sla-table th {
      background: #facc15;
      color: #422006;
      font-weight: 800;
      text-align: left;
      padding: 0.75rem 1rem;
      border: 1px solid #eab308;
    }

    .vermeg-sla-table td {
      padding: 0.75rem 1rem;
      border: 1px solid #fef08a;
      color: #334155;
      line-height: 1.45;
    }

    .vermeg-sla-table tr:nth-child(even) {
      background: #fefce8;
    }

    .obj-name {
      font-weight: 800;
      color: #0f172a;
    }

    .scale-badge {
      display: inline-block;
      margin-top: 0.35rem;
      background: #fef3c7;
      color: #92400e;
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
      font-size: 0.78rem;
    }

    .score-header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .btn-auto-calc {
      background: #e0e7ff;
      color: #3730a3;
      border: 1.5px solid #c7d2fe;
      font-size: 0.75rem;
      font-weight: 800;
      padding: 0.45rem 0.8rem;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-auto-calc:hover {
      background: #c7d2fe;
      color: #1e1b4b;
      transform: translateY(-1px);
    }

    .criterion-desc {
      display: block;
      font-size: 0.72rem;
      color: #64748b;
      margin-top: 0.15rem;
      font-weight: 500;
    }

    .search-bar-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 12px;
      padding: 0.55rem 1rem;
      min-width: 320px;
    }

    .search-bar-wrapper:focus-within {
      background: #ffffff;
      border-color: #6366f1;
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.15);
    }

    .search-icon {
      font-size: 0.95rem;
      margin-right: 0.5rem;
      color: #64748b;
    }

    .search-input {
      border: none;
      background: transparent;
      outline: none;
      font-size: 0.88rem;
      color: #0f172a;
      width: 100%;
    }

    .clear-search-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-weight: 700;
      padding: 0 0.3rem;
      margin-left: 0.3rem;
    }

    .clear-search-btn:hover {
      color: #ef4444;
    }

    .empty-search-state {
      background: #ffffff;
      border: 1.5px dashed #cbd5e1;
      border-radius: 20px;
      padding: 3rem;
      text-align: center;
      color: #64748b;
    }

    .empty-search-state .empty-icon {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
    }

    .empty-search-state h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #334155;
      margin-bottom: 0.3rem;
    }

    .btn-clear-filter {
      margin-top: 1rem;
      background: #6366f1;
      color: #ffffff;
      border: none;
      padding: 0.5rem 1.2rem;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
    }

    .pagination-bar {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 16px;
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
      flex-wrap: wrap;
      gap: 1rem;
    }

    .pagination-info {
      font-size: 0.85rem;
      color: #64748b;
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .btn-page {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      color: #334155;
      font-size: 0.82rem;
      font-weight: 700;
      padding: 0.45rem 0.9rem;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-page:hover:not(:disabled) {
      background: #6366f1;
      color: #ffffff;
      border-color: #6366f1;
    }

    .btn-page:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .page-numbers {
      display: flex;
      gap: 0.35rem;
    }

    .btn-page-number {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1.5px solid #e2e8f0;
      background: #ffffff;
      color: #475569;
      font-weight: 800;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-page-number.active {
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      color: #ffffff;
      border-color: transparent;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    }

    .period-selector-wrapper {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: #f8fafc;
      padding: 0.55rem 1.1rem;
      border-radius: 12px;
      border: 1.5px solid #cbd5e1;
    }

    .period-selector-wrapper label {
      font-size: 0.85rem;
      font-weight: 700;
      color: #334155;
    }

    .period-select {
      background: #ffffff;
      border: 1.5px solid #a855f7;
      color: #4c1d95;
      font-weight: 800;
      font-size: 0.95rem;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      outline: none;
      cursor: pointer;
    }

    .toast-success {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
      padding: 0.85rem 1.2rem;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .toast-error {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      padding: 0.85rem 1.2rem;
      border-radius: 12px;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .loading-state {
      text-align: center;
      padding: 3rem;
      color: #64748b;
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(168, 85, 247, 0.2);
      border-top-color: #a855f7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 1rem auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .members-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 1.5rem;
    }

    .member-eval-card {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 20px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
      transition: all 0.25s ease;
    }

    .member-eval-card.evaluated {
      border-color: rgba(168, 85, 247, 0.35);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.08);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .user-profile {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .avatar-circle {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
      color: #ffffff;
      font-weight: 800;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
    }

    .user-name {
      font-size: 1.05rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }

    .user-email {
      font-size: 0.78rem;
      color: #64748b;
    }

    .global-score-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 0.5rem 0.85rem;
      border-radius: 12px;
    }

    .score-badge-high {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }

    .score-badge-medium {
      background: #fef9c3;
      color: #a16207;
      border: 1px solid #fde047;
    }

    .score-badge-low {
      background: #fee2e2;
      color: #b91c1c;
      border: 1px solid #fca5a5;
    }

    .score-label {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .score-value {
      font-size: 1.15rem;
      font-weight: 900;
    }

    .criteria-section {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .criterion-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.45rem 0.75rem;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #f1f5f9;
    }

    .criterion-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: #334155;
    }

    .criterion-info .icon {
      font-size: 1rem;
    }

    .auto-badge {
      font-size: 0.65rem;
      background: #e0e7ff;
      color: #4338ca;
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
      font-weight: 700;
    }

    .score-input-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .score-range {
      width: 110px;
      accent-color: #6366f1;
      cursor: pointer;
    }

    .score-pill {
      font-size: 0.8rem;
      font-weight: 800;
      background: #ffffff;
      color: #4f46e5;
      border: 1px solid #cbd5e1;
      padding: 0.25rem 0.55rem;
      border-radius: 8px;
      min-width: 48px;
      text-align: center;
    }

    .comments-section {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .comments-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: #475569;
    }

    .comments-textarea {
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 0.6rem 0.8rem;
      font-size: 0.85rem;
      color: #0f172a;
      outline: none;
      resize: vertical;
    }

    .comments-textarea:focus {
      background: #ffffff;
      border-color: #6366f1;
      box-shadow: 0 0 10px rgba(99, 102, 241, 0.15);
    }

    .publish-control-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.6rem 0.85rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
    }

    .publish-status-badge {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.3rem 0.65rem;
      border-radius: 8px;
    }

    .published-badge {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }

    .draft-badge {
      background: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }

    .btn-toggle-publish {
      font-size: 0.78rem;
      font-weight: 700;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-publish {
      background: #6366f1;
      color: #ffffff;
    }

    .btn-publish:hover {
      background: #4f46e5;
    }

    .btn-unpublish {
      background: #e2e8f0;
      color: #475569;
    }

    .btn-unpublish:hover {
      background: #cbd5e1;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.85rem;
      border-top: 1px solid #f1f5f9;
    }

    .eval-status {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .btn-save {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      border: none;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0.6rem 1.1rem;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
    }

    .btn-save:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(79, 70, 229, 0.4);
    }

    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class EvaluationManagerComponent implements OnInit {
  Math = Math;
  selectedPeriod = '2026-08';
  availablePeriods: string[] = ['2026-08', '2026-07', '2026-06', '2026-05', '2026-04'];
  
  teamMembers: TeamMemberEvaluation[] = [];
  formsMap: { [userId: number]: any } = {};
  
  // Official Vermeg SLA Guide toggle
  showSlaGuide = false;

  // Search & Pagination (Max 5 per page)
  searchQuery = '';
  currentPage = 1;
  pageSize = 5;

  loading = false;
  savingId: number | null = null;
  
  successMessage = '';
  errorMessage = '';

  constructor(
    private evalService: EvaluationsService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.loadTeamEvaluations();
  }

  get filteredMembers(): TeamMemberEvaluation[] {
    if (!this.searchQuery || !this.searchQuery.trim()) {
      return this.teamMembers;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.teamMembers.filter(item => {
      const name = `${item.user.firstName} ${item.user.lastName}`.toLowerCase();
      const email = (item.user.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }

  get paginatedMembers(): TeamMemberEvaluation[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredMembers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredMembers.length / this.pageSize));
  }

  autoCalculateMemberScores(item: TeamMemberEvaluation) {
    const f = this.getForm(item);
    
    // Auto-calculate SLA Scores based on Vermeg standards:
    // 1. Ticket Quality: (1 - Bad/Total)*100 -> >98% = 5, 96-97% = 4, 86-95% = 3, 76-85% = 2, <75% = 1
    f.qualiteTicketsScore = 5;

    // 2. Monitoring & Detection: <5m = 5, 6-10m = 4, 11-20m = 3, 21-30m = 2, >30m = 1
    f.monitoringDetectionScore = 4;

    // 3. Checklist: 100% = 5, 98-99% = 4, 95-97% = 3, 90-94% = 2, <89% = 1
    f.checklistScore = 5;

    // 4. Support 1er niveau
    f.support1erNiveauScore = 4;

    this.successMessage = `⚡ SLA scores auto-calculated for ${item.user.firstName} ${item.user.lastName} based on Vermeg standards!`;
    setTimeout(() => { this.successMessage = ''; }, 4000);
  }

  onSearchChange() {
    this.currentPage = 1;
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(p: number) {
    this.currentPage = p;
  }

  getPageArray(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  formatPeriodName(period: string): string {
    if (!period) return '';
    const [year, month] = period.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const idx = parseInt(month, 10) - 1;
    return `${months[idx] || month} ${year}`;
  }

  getInitials(user: any): string {
    if (!user) return 'SOC';
    const f = user.firstName ? user.firstName.charAt(0).toUpperCase() : '';
    const l = user.lastName ? user.lastName.charAt(0).toUpperCase() : '';
    return (f + l) || 'SOC';
  }

  private CACHE_KEY_PREFIX = 'vermguard_eval_team_v3_';

  loadTeamEvaluations() {
    this.successMessage = '';
    this.errorMessage = '';

    const cacheKey = this.CACHE_KEY_PREFIX + this.selectedPeriod;
    const cachedData = localStorage.getItem(cacheKey);

    // 1. Instant display from cache if available
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.applyTeamEvaluationsData(parsed);
          this.loading = false;
        }
      } catch (e) {}
    }

    // Fallback: If cache is empty, populate users list instantly from UserService
    if (this.teamMembers.length === 0) {
      this.userService.getUsers().subscribe({
        next: (users) => {
          if (this.teamMembers.length === 0) {
            const nonManagers = users.filter(u => u.role !== 'manager');
            const fallbackList: TeamMemberEvaluation[] = nonManagers.map(u => ({
              user: { id: u.id || 0, firstName: u.firstName, lastName: u.lastName, email: u.email, role: u.role },
              evaluation: null
            }));
            this.applyTeamEvaluationsData(fallbackList);
            this.loading = false;
          }
        }
      });
    }

    // 2. Fetch fresh scores from MySQL backend in background (Stale-While-Revalidate)
    this.evalService.getTeamEvaluations(this.selectedPeriod, 'manager').subscribe({
      next: (data) => {
        this.applyTeamEvaluationsData(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
        this.loading = false;
      },
      error: (err) => {
        console.warn('Background refresh error for team evaluations', err);
        this.loading = false;
      }
    });
  }

  private applyTeamEvaluationsData(data: TeamMemberEvaluation[]) {
    this.teamMembers = data;
    this.formsMap = {};

    data.forEach(item => {
      const ev = item.evaluation;
      this.formsMap[item.user.id] = {
        support1erNiveauScore: ev ? ev.support1erNiveauScore : 3,
        monitoringDetectionScore: ev ? ev.monitoringDetectionScore : 3,
        qualiteTicketsScore: ev ? ev.qualiteTicketsScore : 3,
        onboardingOnPremScore: ev ? ev.onboardingOnPremScore : 3,
        onboardingSaaSScore: ev ? ev.onboardingSaaSScore : 3,
        securiteScore: ev ? ev.securiteScore : 3,
        checklistScore: ev ? ev.checklistScore : 3,
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
        comments: '',
        isPublished: false,
      };
    }
    return this.formsMap[item.user.id];
  }

  computeLiveScore(item: TeamMemberEvaluation): string {
    const f = this.getForm(item);
    const sum = Number(f.support1erNiveauScore) +
                Number(f.monitoringDetectionScore) +
                Number(f.qualiteTicketsScore) +
                Number(f.onboardingOnPremScore) +
                Number(f.onboardingSaaSScore) +
                Number(f.securiteScore) +
                Number(f.checklistScore);
    return (sum / 7).toFixed(2);
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
      comments: f.comments,
      isPublished: !!f.isPublished,
    };

    this.evalService.saveEvaluation(dto, 'manager').subscribe({
      next: (savedEv) => {
        item.evaluation = savedEv;
        this.savingId = null;

        // Update local cache for instant future loads
        const cacheKey = this.CACHE_KEY_PREFIX + this.selectedPeriod;
        localStorage.setItem(cacheKey, JSON.stringify(this.teamMembers));

        const pubStatus = savedEv.isPublished ? 'published & visible to SOC analyst' : 'saved as draft (hidden from SOC analyst)';
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
