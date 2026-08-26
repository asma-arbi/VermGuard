import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EvaluationsService, EvaluationItem } from '../../../services/evaluations.service';

@Component({
  selector: 'app-evaluation-soc-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="eval-soc-container fade-in">
      
      <!-- Top Header Card -->
      <div class="eval-header-card">
        <div>
          <h2>📈 My Monthly Performance Evaluations</h2>
          <p class="subtitle">Read-only historical view of your monthly performance evaluations conducted by the SOC Manager.</p>
        </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading your performance evaluations...</p>
      </div>

      <!-- Empty / Waiting State Card -->
      <div *ngIf="!loading && evaluations.length === 0" class="empty-card">
        <div class="empty-icon">⏳</div>
        <h3>You don't have any evaluations yet</h3>
        <p>You don't have any performance evaluations published by your manager at this moment. Please wait for your manager to review and publish your evaluation.</p>
      </div>

      <!-- Evaluation History List -->
      <div *ngIf="!loading && evaluations.length > 0" class="history-list">
        <div *ngFor="let ev of evaluations" class="eval-card">
          
          <!-- Month & Global Score Banner -->
          <div class="card-banner">
            <div class="period-title">
              <span class="calendar-icon">📅</span>
              <span class="period-name">{{ formatPeriodName(ev.period) }}</span>
            </div>

            <div class="global-score-badge" [ngClass]="getScoreBadgeClass(ev.globalScore)">
              <span class="score-label">Monthly Global Score</span>
              <span class="score-number">{{ ev.globalScore | number:'1.2-2' }} / 5</span>
            </div>
          </div>

          <!-- 7 Criteria Grid Breakdown -->
          <div class="criteria-grid">
            
            <div class="criterion-item">
              <div class="criterion-header">
                <span class="icon">🎧</span>
                <span class="label">1st Level Support</span>
                <span class="score-value">{{ ev.support1erNiveauScore }} / 5</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="(ev.support1erNiveauScore / 5) * 100" [ngClass]="getBarClass(ev.support1erNiveauScore)"></div>
              </div>
            </div>

            <div class="criterion-item">
              <div class="criterion-header">
                <span class="icon">📡</span>
                <span class="label">Monitoring & Detection</span>
                <span class="score-value">{{ ev.monitoringDetectionScore }} / 5</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="(ev.monitoringDetectionScore / 5) * 100" [ngClass]="getBarClass(ev.monitoringDetectionScore)"></div>
              </div>
            </div>

            <div class="criterion-item">
              <div class="criterion-header">
                <span class="icon">🎫</span>
                <span class="label">Ticket Quality</span>
                <span class="score-value">{{ ev.qualiteTicketsScore }} / 5</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="(ev.qualiteTicketsScore / 5) * 100" [ngClass]="getBarClass(ev.qualiteTicketsScore)"></div>
              </div>
            </div>

            <div class="criterion-item">
              <div class="criterion-header">
                <span class="icon">🏢</span>
                <span class="label">On-Prem Onboarding</span>
                <span class="score-value">{{ ev.onboardingOnPremScore }} / 5</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="(ev.onboardingOnPremScore / 5) * 100" [ngClass]="getBarClass(ev.onboardingOnPremScore)"></div>
              </div>
            </div>

            <div class="criterion-item">
              <div class="criterion-header">
                <span class="icon">☁️</span>
                <span class="label">SaaS Onboarding</span>
                <span class="score-value">{{ ev.onboardingSaaSScore }} / 5</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="(ev.onboardingSaaSScore / 5) * 100" [ngClass]="getBarClass(ev.onboardingSaaSScore)"></div>
              </div>
            </div>

            <div class="criterion-item">
              <div class="criterion-header">
                <span class="icon">🛡️</span>
                <span class="label">Security</span>
                <span class="score-value">{{ ev.securiteScore }} / 5</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="(ev.securiteScore / 5) * 100" [ngClass]="getBarClass(ev.securiteScore)"></div>
              </div>
            </div>

            <div class="criterion-item">
              <div class="criterion-header">
                <span class="icon">✅</span>
                <span class="label">Compliance Checklist</span>
                <span class="score-value">{{ ev.checklistScore }} / 5</span>
              </div>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" [style.width.%]="(ev.checklistScore / 5) * 100" [ngClass]="getBarClass(ev.checklistScore)"></div>
              </div>
            </div>

          </div>

          <!-- Manager Comments Box -->
          <div *ngIf="ev.comments" class="manager-comments-box">
            <div class="comments-header">
              <span class="chat-icon">💬</span>
              <span>Manager Feedback & Comments:</span>
            </div>
            <p class="comments-text">{{ ev.comments }}</p>
          </div>

          <div class="card-footer">
            <span>Evaluation published on {{ ev.updatedAt | date:'dd/MM/yyyy' }}</span>
            <span class="read-only-badge">🔒 Read-Only</span>
          </div>

        </div>
      </div>

    </div>
  `,
  styles: [`
    .eval-soc-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .eval-header-card {
      background: #ffffff;
      border: 1px solid rgba(168, 85, 247, 0.2);
      border-radius: 18px;
      padding: 1.5rem 2rem;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.08);
    }

    .eval-header-card h2 {
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

    .empty-card {
      background: #ffffff;
      border: 1.5px dashed #cbd5e1;
      border-radius: 20px;
      padding: 3rem;
      text-align: center;
      color: #64748b;
    }

    .empty-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }

    .empty-card h3 {
      font-size: 1.1rem;
      font-weight: 700;
      color: #334155;
      margin-bottom: 0.3rem;
    }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .eval-card {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 22px;
      padding: 1.75rem;
      display: flex;
      flex-direction: column;
      gap: 1.4rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    }

    .card-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid #f1f5f9;
    }

    .period-title {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .calendar-icon {
      font-size: 1.3rem;
    }

    .period-name {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0f172a;
    }

    .global-score-badge {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding: 0.55rem 1rem;
      border-radius: 14px;
    }

    .score-badge-high {
      background: #dcfce7;
      color: #15803d;
      border: 1.5px solid #86efac;
    }

    .score-badge-medium {
      background: #fef9c3;
      color: #a16207;
      border: 1.5px solid #fde047;
    }

    .score-badge-low {
      background: #fee2e2;
      color: #b91c1c;
      border: 1.5px solid #fca5a5;
    }

    .score-label {
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .score-number {
      font-size: 1.25rem;
      font-weight: 900;
    }

    .criteria-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }

    .criterion-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 0.85rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .criterion-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .criterion-header .icon {
      margin-right: 0.4rem;
    }

    .criterion-header .label {
      font-size: 0.82rem;
      font-weight: 700;
      color: #334155;
      flex: 1;
    }

    .criterion-header .score-value {
      font-size: 0.85rem;
      font-weight: 800;
      color: #4f46e5;
    }

    .progress-bar-track {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease-in-out;
    }

    .bar-high {
      background: linear-gradient(90deg, #22c55e, #16a34a);
    }

    .bar-medium {
      background: linear-gradient(90deg, #eab308, #ca8a04);
    }

    .bar-low {
      background: linear-gradient(90deg, #ef4444, #dc2626);
    }

    .manager-comments-box {
      background: #faf5ff;
      border: 1.5px solid #e9d5ff;
      border-radius: 14px;
      padding: 1rem 1.25rem;
    }

    .comments-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      font-weight: 700;
      color: #6b21a8;
      margin-bottom: 0.4rem;
    }

    .comments-text {
      font-size: 0.88rem;
      color: #3b0764;
      margin: 0;
      line-height: 1.5;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.78rem;
      color: #94a3b8;
      padding-top: 0.5rem;
    }

    .read-only-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 0.2rem 0.6rem;
      border-radius: 8px;
      font-weight: 600;
    }
  `]
})
export class EvaluationSocViewComponent implements OnInit {
  evaluations: EvaluationItem[] = [];
  loading = false;

  constructor(
    private evalService: EvaluationsService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.loadMyEvaluations();
  }

  private CACHE_KEY = 'vermguard_eval_my_cache';

  loadMyEvaluations() {
    const storedUser = localStorage.getItem('loggedUser');
    let loggedUserId = 3; // Default Wissem Saadli (role: soc)
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        if (u.id) loggedUserId = u.id;
      } catch {}
    }

    const cached = localStorage.getItem(this.CACHE_KEY + '_' + loggedUserId);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.evaluations = parsed;
          this.loading = false;
        }
      } catch (e) {}
    }

    this.evalService.getMyEvaluations(loggedUserId, 'soc').subscribe({
      next: (data) => {
        this.ngZone.run(() => {
          this.evaluations = data || [];
          localStorage.setItem(this.CACHE_KEY + '_' + loggedUserId, JSON.stringify(this.evaluations));
          this.loading = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.ngZone.run(() => {
          this.loading = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  formatPeriodName(period: string): string {
    if (!period) return '';
    const [year, month] = period.split('-');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const idx = parseInt(month, 10) - 1;
    return `${months[idx] || month} ${year}`;
  }

  getScoreBadgeClass(score?: number): string {
    if (!score) return 'score-badge-medium';
    if (score >= 4.0) return 'score-badge-high';
    if (score >= 3.0) return 'score-badge-medium';
    return 'score-badge-low';
  }

  getBarClass(score: number): string {
    if (score >= 4) return 'bar-high';
    if (score >= 3) return 'bar-medium';
    return 'bar-low';
  }
}
