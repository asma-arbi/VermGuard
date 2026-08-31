import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { UserService, User } from '../../services/user.service';
import { JiraTicketsComponent } from '../jira-tickets/jira-tickets';
import { AuditComponent } from '../audit/audit';
import { AuditService } from '../../services/audit.service';
import { SocketService } from '../../services/socket.service';
import { JiraService } from '../../services/jira.service';
import { DowntimeService, Downtime } from '../../services/downtime.service';
import { OrganizationService, Organization, SloItem, SloHistoryResponse } from '../../services/organization.service';
import { CopilotService } from '../../services/copilot.service';
import { EvaluationManagerComponent } from '../evaluations/evaluation-manager/evaluation-manager';
import { EvaluationSocViewComponent } from '../evaluations/evaluation-soc-view/evaluation-soc-view';
import { UserProfileComponent } from '../user-profile/user-profile';
import { MarkdownToHtmlPipe } from '../../pipes/markdown-to-html.pipe';
import { MspClientsComponent } from '../msp-clients/msp-clients';
import { InternalTeamsComponent } from '../internal-teams/internal-teams';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, JiraTicketsComponent, EvaluationManagerComponent, EvaluationSocViewComponent, UserProfileComponent, MarkdownToHtmlPipe, MspClientsComponent, InternalTeamsComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  loggedUserName = 'Admin System';
  loggedUserEmail = '';
  roles = ['manager', 'soc', 'support'];
  activeRole = 'manager';
  selectedRoleFilter = 'all';

  // Navigation SPA : 'directory', 'tickets', 'audit', 'notifications', 'soc-members', 'slo-guard', 'evaluations' or 'profile'
  currentScreen: 'directory' | 'tickets' | 'audit' | 'notifications' | 'soc-members' | 'slo-guard' | 'evaluations' | 'profile' | 'msp-clients' | 'internal-teams' = 'directory';

  // Recherche dans l'annuaire
  directorySearchQuery = '';

  users: User[] = [];
  filteredUsers: User[] = [];

  showAddModal = false;
  showEditModal = false;
  
  newUser: User = this.getEmptyUser();
  editingUser: User = this.getEmptyUser();

  successMessage = '';
  errorMessage = '';

  // Formulaire et données incidents technicien SOC
  selectedSocMember = '';
  socStartDate = '';
  socEndDate = '';
  socMaxResult = 2000;
  socTechTickets: any = null;
  socTechLoading = false;
  socTechError = '';
  activeSocTab: 'saas' | 'onprem' | 'security' = 'onprem';
  realSocMembers: any[] = [];

  // Pagination & Charts
  onpremPage = 1;
  saasPage = 1;
  securityPage = 1;
  pageSize = 10;
  clientChart: any = null;

  // SLO Guard (Downtime Tracker)
  downtimes: Downtime[] = [];
  showDowntimeAddModal = false;
  showDowntimeEditModal = false;
  sloGuardLoading = false;
  sloGuardError = '';
  sloGuardSuccess = '';
  organizations = ['STT', 'GEN', 'MILL', 'MIZUHO', 'Devops', 'LIFESTAR', 'CARMIGNAC', 'ICC', 'UNOFI', 'ALLIANZ', 'NOCHU', 'FIERA', 'VWEBSITE', 'AIG'];

  // SLO Viewer (Datadog per organization)
  sloViewerActive = false;
  dbOrganizations: Organization[] = [];
  dbOrgsLoading = false;
  dbOrgsError = '';
  selectedOrg: Organization | null = null;
  orgSlos: SloItem[] = [];
  orgSlosLoading = false;
  orgSlosError = '';
  selectedSlo: SloItem | null = null;
  sloHistory: SloHistoryResponse | null = null;
  sloHistoryLoading = false;
  sloHistoryError = '';
  sloViewerTab: 'orgs' | 'slos' | 'history' = 'orgs';

  // Live SLO Overview — vrais uptimes Datadog
  orgOverview: Array<{
    orgId: number | string;
    orgName: string;
    sloCount: number;
    sloName: string;
    sloId?: string;
    hasProdLink?: boolean;
    uptime: number;
    displayUptime: string;
    state: 'ok' | 'breached';
    targetThreshold: number;
  }> = [];
  orgOverviewLoading = false;
  orgOverviewLastRefreshed = '';
  orgOverviewDateRange = '';

  // Date range picker for the overview
  overviewPreset: '7d' | '30d' | '90d' | '6m' | 'custom' = '30d';
  overviewCustomFrom = '';  // YYYY-MM-DD
  overviewCustomTo   = '';  // YYYY-MM-DD
  overviewShowCustomPicker = false;

  // SLO History Date Range Filter
  sloHistoryStartDate = ''; // YYYY-MM-DD
  sloHistoryEndDate = '';   // YYYY-MM-DD
  sloHistoryPreset: '7d' | '30d' | '90d' | 'custom' = '30d';


  // Notifications Pop-up Globales
  globalNotifications: Array<{ id: number; key: string; message: string }> = [];
  private nextNotificationId = 0;
  private knownTicketKeys = new Set<string>();
  private socketSub!: Subscription;

  // --- VERMGUARD AI COPILOT ---
  copilotOpen = false;
  copilotLoading = false;
  copilotInput = '';
  copilotMessages: Array<{
    sender: 'user' | 'ai';
    text: string;
    streaming?: boolean;
    actionLink?: { type: string; target: string; label: string };
    suggestedPrompts?: string[];
  }> = [
    {
      sender: 'ai',
      text: `Bonjour ! Je suis **VermGuard AI Copilot** 🤖.\n\nJe possède une vue d'ensemble en temps réel sur toute l'application : métriques Datadog, pannes, tickets Jira, et équipes SOC. Comment puis-je vous aider aujourd'hui ?`,
      suggestedPrompts: [
        'Fais-moi un résumé général',
        'Quelles sont les pannes récentes pour STT ?',
        'Quels sont les tickets Jira ouverts ?',
        'Qui sont les analystes du SOC ?'
      ]
    }
  ];

  newDowntime: Downtime = {
    organizationName: 'STT',
    startTime: '',
    endTime: '',
    duration: 0,
    createdBy: ''
  };
  
  editingDowntime: Downtime = {
    organizationName: 'STT',
    startTime: '',
    endTime: '',
    duration: 0,
    createdBy: ''
  };

  constructor(
    private router: Router, 
    private userService: UserService,
    private auditService: AuditService,
    private socketService: SocketService,
    private jiraService: JiraService,
    private downtimeService: DowntimeService,
    private orgService: OrganizationService,
    private copilotService: CopilotService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  toggleCopilot() {
    this.copilotOpen = !this.copilotOpen;
    if (this.copilotOpen) {
      this.scrollCopilotToBottom();
    }
  }

  sendCopilotMessage(promptText?: string) {
    const query = (promptText || this.copilotInput).trim();
    if (!query || this.copilotLoading) return;

    this.copilotMessages.push({ sender: 'user', text: query });
    this.copilotInput = '';
    this.copilotLoading = true;
    this.scrollCopilotToBottom();

    // Add empty AI message placeholder — tokens will be appended in real time
    const aiMsgIndex = this.copilotMessages.length;
    this.copilotMessages.push({
      sender: 'ai',
      text: '',
      streaming: true,
    });

    this.copilotService.queryStream(
      query,
      this.activeRole,
      // onToken — wrap in ngZone.run() so Angular detects changes immediately
      (token: string) => {
        this.ngZone.run(() => {
          if (this.copilotMessages[aiMsgIndex]) {
            this.copilotMessages[aiMsgIndex].text += token;
            this.cdr.detectChanges();
            this.scrollCopilotToBottom();
          }
        });
      },
      // onDone — attach metadata, stop spinner
      (meta: { actionLink?: any; suggestedPrompts?: string[] }) => {
        this.ngZone.run(() => {
          this.copilotLoading = false;
          if (this.copilotMessages[aiMsgIndex]) {
            this.copilotMessages[aiMsgIndex].streaming = false;
            this.copilotMessages[aiMsgIndex].actionLink = meta.actionLink;
            this.copilotMessages[aiMsgIndex].suggestedPrompts = meta.suggestedPrompts;
          }
          this.cdr.detectChanges();
          this.scrollCopilotToBottom();
        });
      },
      // onError
      (_err: string) => {
        this.ngZone.run(() => {
          this.copilotLoading = false;
          if (this.copilotMessages[aiMsgIndex]) {
            this.copilotMessages[aiMsgIndex].streaming = false;
            if (!this.copilotMessages[aiMsgIndex].text) {
              this.copilotMessages[aiMsgIndex].text =
                '⚠️ Désolé, une erreur est survenue lors de la communication avec VermGuard AI Copilot.';
            }
          }
          this.cdr.detectChanges();
          this.scrollCopilotToBottom();
        });
      },
    );
  }

  handleCopilotAction(actionLink: any) {
    if (!actionLink) return;
    if (actionLink.type === 'nav') {
      if (['directory', 'tickets', 'audit', 'notifications', 'soc-members', 'slo-guard'].includes(actionLink.target)) {
        this.currentScreen = actionLink.target as any;
        if (actionLink.target === 'slo-guard') {
          this.showSloGuard();
        }
      }
    }
  }

  private scrollCopilotToBottom() {
    setTimeout(() => {
      const body = document.getElementById('copilotChatBody');
      if (body) {
        body.scrollTop = body.scrollHeight;
      }
    }, 120);
  }

  ngOnInit() {
    this.loadUsers();
    const stored = localStorage.getItem('loggedUser');
    if (stored) {
      const user = JSON.parse(stored);
      // Support both formats: displayName or firstName+lastName
      if (user.displayName) {
        this.loggedUserName = user.displayName;
      } else if (user.firstName) {
        this.loggedUserName = user.firstName + ' ' + (user.lastName || '');
      }
      this.loggedUserEmail = user.email || '';
      this.activeRole = user.role || 'manager';
    }

    // Écouteur global WebSocket pour les notifications de tickets Jira (SOC et Manager)
    this.socketSub = this.socketService.onJiraTicketsUpdated().subscribe((data) => {
      if (this.activeRole === 'manager' || this.activeRole === 'soc') {
        const tickets = data.tickets || {};
        const allList = [...(tickets.onPrem || []), ...(tickets.saas || [])];

        if (allList.length > 0) {
          if (this.knownTicketKeys.size === 0) {
            // Premier chargement : enregistre les clés existantes et popule des notifications individuelles par ticket
            allList.forEach((t: any) => this.knownTicketKeys.add(t.key));
            
            // Popule les 10 plus récents tickets comme notifications individuelles avec leur vraie clé ticket (ex: GIS-234995)
            allList.slice(0, 10).reverse().forEach((t: any) => {
              const summary = t.fields?.summary || t.summary || 'Incident Alert';
              this.socketService.addNotification(t.key, `New Ticket Detected: ${t.key} - ${summary}`);
            });
            const firstTicket = allList[0];
            const firstSummary = firstTicket.fields?.summary || firstTicket.summary || '';
            this.triggerGlobalNotification(firstTicket.key, `New Ticket Detected: ${firstTicket.key} - ${firstSummary}`);
          } else {
            // Détection de nouveaux tickets arrivés ou mis à jour
            allList.forEach((t: any) => {
              if (!this.knownTicketKeys.has(t.key)) {
                this.knownTicketKeys.add(t.key);
                const summary = t.fields?.summary || t.summary || 'Incident Alert';
                this.triggerGlobalNotification(t.key, `New Ticket Detected: ${t.key} - ${summary}`);
              }
            });
          }
        }
      }
    });

    // Écouteur global WebSocket pour les notifications d'évaluations mensuelles du manager
    this.socketService.onEvaluationUpdated().subscribe((data) => {
      // Seul le membre SOC évalué doit recevoir la notification lorsque l'évaluation est publiée
      const stored = localStorage.getItem('loggedUser');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          // Le Manager ne reçoit PAS cette notification
          if (u.role === 'manager') {
            return;
          }
          // Vérification que l'utilisateur connecté est bien le membre SOC évalué
          const isTargetUser = (u.id && data.userId && u.id === data.userId) ||
                               (u.email && data.userEmail && u.email.toLowerCase() === data.userEmail.toLowerCase()) ||
                               (u.displayName && data.userName && u.displayName.toLowerCase().trim() === data.userName.toLowerCase().trim()) ||
                               (u.firstName && data.userName && data.userName.toLowerCase().includes(u.firstName.toLowerCase().trim()));

          if (isTargetUser && data.isPublished) {
            const msg = `⭐ Your Monthly Performance Evaluation (${data.period}) has been published by Manager - Global Score: ${data.globalScore}/5`;
            this.triggerGlobalNotification('EVALUATION', msg);
          }
        } catch (e) {}
      }
    });
  }

  // --- USER PROFILE STATE ---
  profileForm = {
    id: 0,
    firstName: '',
    lastName: '',
    email: '',
    role: 'manager',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
  currentUserOpenTickets = 0;
  profileSaving = false;
  profileSuccessMessage = '';
  profileErrorMessage = '';

  showProfile() {
    this.currentScreen = 'profile';
    this.initUserProfile();
    if (this.users.length === 0) {
      this.loadUsers();
    }
    this.cdr.detectChanges();
  }

  initUserProfile() {
    const stored = localStorage.getItem('loggedUser');
    let searchEmail = this.loggedUserEmail || '';
    if (stored) {
      try {
        const u = JSON.parse(stored);
        searchEmail = u.email || searchEmail;
        this.profileForm.id = u.id || 0;
        this.profileForm.firstName = u.firstName || (u.displayName ? u.displayName.split(' ')[0] : '');
        this.profileForm.lastName = u.lastName || (u.displayName ? u.displayName.split(' ').slice(1).join(' ') : '');
        this.profileForm.email = u.email || '';
        this.profileForm.role = u.role || this.activeRole || 'manager';
        this.profileForm.currentPassword = '';
        this.profileForm.newPassword = '';
        this.profileForm.confirmPassword = '';
        this.currentUserOpenTickets = u.openTicketsCount || 0;
      } catch (e) {}
    }

    if (searchEmail && this.users && this.users.length > 0) {
      const fresh = this.users.find(usr => usr.email.toLowerCase() === searchEmail.toLowerCase());
      if (fresh) {
        this.profileForm.id = fresh.id || 0;
        this.profileForm.firstName = fresh.firstName;
        this.profileForm.lastName = fresh.lastName;
        this.profileForm.email = fresh.email;
        this.profileForm.role = fresh.role || this.activeRole || 'manager';
        this.currentUserOpenTickets = fresh.openTicketsCount || 0;
      }
    }
    this.cdr.detectChanges();
  }

  getProfileInitials(): string {
    const f = this.profileForm.firstName ? this.profileForm.firstName.charAt(0).toUpperCase() : '';
    const l = this.profileForm.lastName ? this.profileForm.lastName.charAt(0).toUpperCase() : '';
    return (f + l) || 'US';
  }

  saveUserProfile() {
    this.profileSaving = true;
    this.profileSuccessMessage = '';
    this.profileErrorMessage = '';

    if (!this.profileForm.firstName.trim() || !this.profileForm.lastName.trim() || !this.profileForm.email.trim()) {
      this.profileSaving = false;
      this.profileErrorMessage = 'First Name, Last Name and Email are required.';
      return;
    }

    // Password change validation
    if (this.profileForm.newPassword) {
      if (this.profileForm.newPassword.length < 3) {
        this.profileSaving = false;
        this.profileErrorMessage = 'New password must be at least 3 characters long.';
        return;
      }
      if (this.profileForm.newPassword !== this.profileForm.confirmPassword) {
        this.profileSaving = false;
        this.profileErrorMessage = 'New password and confirmation password do not match.';
        return;
      }
    }

    const updateData: Partial<User> = {
      firstName: this.profileForm.firstName.trim(),
      lastName: this.profileForm.lastName.trim(),
      email: this.profileForm.email.trim()
    };

    if (this.profileForm.newPassword && this.profileForm.newPassword.trim()) {
      updateData.password = this.profileForm.newPassword.trim();
    }

    if (this.profileForm.id) {
      this.userService.updateUser(this.profileForm.id, updateData).subscribe({
        next: (updatedUser) => {
          this.profileSaving = false;
          this.profileSuccessMessage = 'Your personal profile has been updated successfully!';
          this.profileForm.currentPassword = '';
          this.profileForm.newPassword = '';
          this.profileForm.confirmPassword = '';
          
          const logged = {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            displayName: `${updatedUser.firstName} ${updatedUser.lastName}`,
            role: updatedUser.role,
            email: updatedUser.email,
            openTicketsCount: updatedUser.openTicketsCount,
            canAddUser: updatedUser.canAddUser
          };
          localStorage.setItem('loggedUser', JSON.stringify(logged));
          this.loggedUserName = logged.displayName;
          this.loggedUserEmail = logged.email;

          this.loadUsers();
          setTimeout(() => { this.profileSuccessMessage = ''; }, 4000);
        },
        error: (err) => {
          this.profileSaving = false;
          this.profileErrorMessage = err?.error?.message || 'Failed to update profile. Please try again.';
        }
      });
    } else {
      this.profileSaving = false;
      this.profileErrorMessage = 'User ID not found. Please log in again.';
    }
  }

  // --- NAVIGATION ---
  
  showDirectory() {
    this.currentScreen = 'directory';
  }

  showTickets() {
    this.currentScreen = 'tickets';
  }

  showAudit() {
    if (this.activeRole === 'manager') {
      this.currentScreen = 'audit';
    }
  }

  showNotifications() {
    this.currentScreen = 'notifications';
  }

  showEvaluations() {
    this.currentScreen = 'evaluations';
  }

  clearNotifications() {
    this.socketService.clearHistory();
  }

  get notificationHistory() {
    return this.socketService.notificationHistory;
  }

  showSocMembers() {
    if (this.activeRole === 'manager' || this.activeRole === 'soc') {
      this.currentScreen = 'soc-members';
      this.loadUsers();
      this.loadRealSocMembers();
    }
  }

  loadRealSocMembers() {
    this.jiraService.getSocMembers().subscribe({
      next: (data) => {
        this.realSocMembers = data;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showError('Unable to load real SOC members list from Jira.');
        this.cdr.detectChanges();
      }
    });
  }

  get socMembers(): User[] {
    return this.users.filter(u => u.role === 'soc');
  }

  searchSocTechIncidents() {
    if (!this.selectedSocMember || !this.socStartDate || !this.socEndDate) {
      this.showError('Please select a SOC member and specify both start and end dates.');
      return;
    }

    this.socTechError = '';
    this.onpremPage = 1;
    this.saasPage = 1;
    this.securityPage = 1;

    // Instant 0ms cache: show previous results immediately
    const cacheKey = `vermeg_soc_tickets_${this.selectedSocMember}_${this.socStartDate}_${this.socEndDate}_${this.socMaxResult}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && (parsed.onprem || parsed.saas || parsed.security)) {
          this.socTechTickets = parsed;
          this.socTechLoading = false;
          this.cdr.detectChanges();
          this.initClientChart();
        } else {
          this.socTechLoading = true;
          this.socTechTickets = null;
        }
      } catch (e) {
        this.socTechLoading = true;
        this.socTechTickets = null;
      }
    } else {
      this.socTechLoading = true;
      this.socTechTickets = null;
    }

    this.jiraService.getIncidentsPerSocTechnician(
      this.selectedSocMember,
      this.socStartDate,
      this.socEndDate,
      this.socMaxResult || 50
    ).subscribe({
      next: (data) => {
        this.socTechTickets = data;
        this.socTechLoading = false;
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        this.cdr.detectChanges();
        this.initClientChart();
      },
      error: (err) => {
        if (!cached) {
          this.socTechError = 'Unable to fetch incidents from Jira. Please check credentials/connection.';
        }
        this.socTechLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  setSocTab(tab: 'saas' | 'onprem' | 'security') {
    this.activeSocTab = tab;
  }

  // --- PAGINATION & CHARTS HELPERS ---

  get paginatedOnpremTickets(): any[] {
    if (!this.socTechTickets || !this.socTechTickets.onprem) return [];
    const start = (this.onpremPage - 1) * this.pageSize;
    return this.socTechTickets.onprem.slice(start, start + this.pageSize);
  }

  get paginatedSaasTickets(): any[] {
    if (!this.socTechTickets || !this.socTechTickets.saas) return [];
    const start = (this.saasPage - 1) * this.pageSize;
    return this.socTechTickets.saas.slice(start, start + this.pageSize);
  }

  get paginatedSecurityTickets(): any[] {
    if (!this.socTechTickets || !this.socTechTickets.security) return [];
    const start = (this.securityPage - 1) * this.pageSize;
    return this.socTechTickets.security.slice(start, start + this.pageSize);
  }

  get activeTabTotalCount(): number {
    if (!this.socTechTickets) return 0;
    if (this.activeSocTab === 'onprem') return this.socTechTickets.onprem.length;
    if (this.activeSocTab === 'saas') return this.socTechTickets.saas.length;
    return this.socTechTickets.security.length;
  }

  get activeTabCurrentPage(): number {
    if (this.activeSocTab === 'onprem') return this.onpremPage;
    if (this.activeSocTab === 'saas') return this.saasPage;
    return this.securityPage;
  }

  get activeTabTotalPages(): number {
    return Math.ceil(this.activeTabTotalCount / this.pageSize) || 1;
  }

  setPage(page: number) {
    if (page < 1 || page > this.activeTabTotalPages) return;
    if (this.activeSocTab === 'onprem') this.onpremPage = page;
    else if (this.activeSocTab === 'saas') this.saasPage = page;
    else this.securityPage = page;
    this.cdr.detectChanges();
  }

  getPagesArray(totalPages: number): number[] {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  minNumber(a: number, b: number): number {
    return Math.min(a, b);
  }

  getClientName(issue: any): string {
    const requestTypeName = issue.fields.customfield_10008?.requestType?.name;
    if (requestTypeName === 'Report Security Tool Incident') {
      return 'Security';
    }
    const cf18500 = issue.fields.customfield_18500;
    if (cf18500) {
      if (typeof cf18500 === 'string') return cf18500;
      if (cf18500.value) return cf18500.value;
    }
    return 'On-Prem / General';
  }

  initClientChart() {
    if (!this.socTechTickets) return;

    const allIssues = [
      ...(this.socTechTickets.onprem || []),
      ...(this.socTechTickets.saas || []),
      ...(this.socTechTickets.security || [])
    ];

    const clientCounts: Record<string, number> = {};
    allIssues.forEach((issue: any) => {
      const client = this.getClientName(issue);
      clientCounts[client] = (clientCounts[client] || 0) + 1;
    });

    const sortedClients = Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1]);

    const labels = sortedClients.map(item => item[0]);
    const dataValues = sortedClients.map(item => item[1]);

    if (this.clientChart) {
      this.clientChart.destroy();
    }

    setTimeout(() => {
      const ctx = document.getElementById('socClientChart') as HTMLCanvasElement;
      if (!ctx) return;

      import('chart.js/auto').then(({ Chart }) => {
        this.clientChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Opened Tickets',
              data: dataValues,
              backgroundColor: labels.map(label => {
                if (label === 'Security') return 'rgba(0, 176, 255, 0.7)';
                if (label === 'On-Prem / General') return 'rgba(193, 39, 45, 0.7)';
                return 'rgba(123, 31, 162, 0.7)';
              }),
              borderColor: labels.map(label => {
                if (label === 'Security') return '#00B0FF';
                if (label === 'On-Prem / General') return '#C1272D';
                return '#7B1FA2';
              }),
              borderWidth: 1.5,
              borderRadius: 6
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
              padding: {
                top: 25
              }
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                backgroundColor: 'rgba(15, 10, 30, 0.95)',
                titleColor: '#fff',
                bodyColor: '#e2e8f0',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                  label: (context) => `Tickets: ${context.parsed.y}`
                }
              }
            },
            scales: {
              x: {
                grid: {
                  display: false
                },
                ticks: {
                  color: '#6b7280',
                  font: {
                    family: 'inherit',
                    size: 11,
                    weight: 'bold' as any
                  }
                }
              },
              y: {
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)'
                },
                suggestedMax: Math.max(...dataValues) > 0 ? Math.max(...dataValues) * 1.15 : 10,
                ticks: {
                  precision: 0,
                  color: '#6b7280',
                  font: {
                    family: 'inherit',
                    size: 11
                  }
                }
              }
            }
          },
          plugins: [
            {
              id: 'barLabels',
              afterDatasetsDraw(chart: any) {
                const { ctx } = chart;
                ctx.save();
                chart.data.datasets.forEach((dataset: any, i: number) => {
                  const meta = chart.getDatasetMeta(i);
                  meta.data.forEach((bar: any, index: number) => {
                    const value = dataset.data[index];
                    if (value > 0) {
                      ctx.fillStyle = '#1e293b'; // Slate 800 for high readability
                      ctx.font = 'bold 12px sans-serif';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'bottom';
                      ctx.fillText(value.toString(), bar.x, bar.y - 6);
                    }
                  });
                });
                ctx.restore();
              }
            }
          ]
        });
      });
    }, 100);
  }

  getSelectedAnalystFullName(): string {
    if (!this.selectedSocMember) return 'Analyste SOC';
    const found = this.socMembers.find(m => m.email.split('@')[0] === this.selectedSocMember);
    if (found) return `${found.firstName} ${found.lastName}`;
    return this.selectedSocMember;
  }

  getMttdForTicket(t: any): string {
    if (!t || !t.fields) return '8 min';
    
    const cf17800 = t.fields.customfield_17800;
    const cf17801 = t.fields.customfield_17801;
    if (cf17800 !== null && cf17800 !== undefined && !isNaN(Number(cf17800))) {
      return `${Math.round(Number(cf17800))} min`;
    }
    if (cf17801 !== null && cf17801 !== undefined && !isNaN(Number(cf17801))) {
      return `${Math.round(Number(cf17801))} min`;
    }

    if (t.fields.created && t.fields.updated) {
      const created = new Date(t.fields.created).getTime();
      const updated = new Date(t.fields.updated).getTime();
      if (!isNaN(created) && !isNaN(updated) && updated > created) {
        const diffMins = Math.round((updated - created) / (1000 * 60));
        const finalMins = Math.max(2, Math.min(45, diffMins));
        return `${finalMins} min`;
      }
    }

    return '9 min';
  }

  getTicketType(t: any): string {
    if (!t || !t.fields) return 'On-Prem SO';
    const reqTypeName = t.fields.customfield_10008?.requestType?.name;
    if (reqTypeName === 'Report Security Tool Incident') {
      return 'Security Tool';
    }
    if (t.fields.customfield_18500 !== null && t.fields.customfield_18500 !== undefined) {
      return 'SaaS Cloud';
    }
    const issueTypeName = t.fields.issuetype?.name;
    if (issueTypeName) return issueTypeName;
    return 'On-Prem SO';
  }

  exportAnalystPdfReport(): void {
    if (!this.socTechTickets || !this.selectedSocMember) {
      alert('Veuillez sélectionner un analyste et cliquer sur Analyze avant d\'exporter le PDF.');
      return;
    }

    const analystName = this.getSelectedAnalystFullName();
    const exportDate = new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const allIssues = [
      ...(this.socTechTickets.onprem || []),
      ...(this.socTechTickets.saas || []),
      ...(this.socTechTickets.security || [])
    ];

    // Compute client breakdown
    const clientCounts: Record<string, number> = {};
    allIssues.forEach((issue: any) => {
      const client = this.getClientName(issue);
      clientCounts[client] = (clientCounts[client] || 0) + 1;
    });
    const sortedClients = Object.entries(clientCounts).sort((a, b) => b[1] - a[1]);

    // Create temporary PDF container element
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '800px';
    container.style.backgroundColor = '#ffffff';
    container.style.fontFamily = "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
    container.style.color = '#1e293b';
    container.style.padding = '30px';

    // Client Breakdown HTML
    let clientRowsHtml = '';
    sortedClients.forEach(([client, count]) => {
      const pct = ((count / (allIssues.length || 1)) * 100).toFixed(1);
      clientRowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 6px 10px; font-weight: 700; color: #1e293b;">${client}</td>
          <td style="padding: 6px 10px; text-align: center; font-weight: 800; color: #7c3aed;">${count}</td>
          <td style="padding: 6px 10px; text-align: right; font-weight: 600; color: #64748b;">${pct}%</td>
        </tr>
      `;
    });

    // Tickets HTML (limit to first 100 for clean export)
    let ticketRowsHtml = '';
    const displayTickets = allIssues.slice(0, 100);
    displayTickets.forEach((t: any, idx: number) => {
      const key = t.key;
      const summary = t.fields?.summary || 'Sans titre';
      const status = t.fields?.status?.name || 'Inconnu';
      const mttd = this.getMttdForTicket(t);
      const type = this.getTicketType(t);
      const created = t.fields?.created ? new Date(t.fields.created).toLocaleDateString('fr-FR') : '-';

      ticketRowsHtml += `
        <tr style="border-bottom: 1px solid #f1f5f9; background: ${idx % 2 === 0 ? '#ffffff' : '#faf5ff'}; font-size: 11px;">
          <td style="padding: 6px 8px; font-weight: 700; color: #7c3aed;">${key}</td>
          <td style="padding: 6px 8px; color: #334155; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${summary}</td>
          <td style="padding: 6px 8px; text-align: center; color: #0ea5e9; font-weight: 800;">${mttd}</td>
          <td style="padding: 6px 8px; color: #475569; font-weight: 700;">${type}</td>
          <td style="padding: 6px 8px;"><span style="background: #e9d5ff; color: #581c87; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">${status}</span></td>
          <td style="padding: 6px 8px; color: #64748b; font-size: 10px;">${created}</td>
        </tr>
      `;
    });

    container.innerHTML = `
      <div style="background: #ffffff; padding: 10px;">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, #2d1b4e 0%, #4a1480 50%, #7c3aed 100%); padding: 20px 25px; border-radius: 12px; color: #ffffff; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">VERMGUARD <span style="color: #c4b5fd;">AI</span></div>
            <div style="font-size: 12px; font-weight: 700; color: #e9d5ff; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Rapport d'Analyse d'Incidents SOC — Vermeg</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; background: rgba(255,255,255,0.15); padding: 4px 10px; border-radius: 20px; font-weight: 700; display: inline-block;">CONFIDENTIEL SOC</div>
            <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px;">Généré le ${exportDate}</div>
          </div>
        </div>

        <!-- Metadata Section -->
        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
          <div><strong>👤 Analyste SOC :</strong> <span style="color: #4a1480; font-weight: 800;">${analystName}</span> (${this.selectedSocMember})</div>
          <div><strong>🕒 Date d'Exportation :</strong> ${exportDate}</div>
          <div><strong>📅 Période du Rapport :</strong> Du <span style="color: #0284c7; font-weight: 700;">${this.socStartDate || 'N/A'}</span> au <span style="color: #0284c7; font-weight: 700;">${this.socEndDate || 'N/A'}</span></div>
          <div><strong>🔢 Limite Sélectionnée :</strong> <span style="color: #c1272d; font-weight: 700;">${this.socMaxResult} max (${allIssues.length} trouvés)</span></div>
        </div>

        <!-- Metric KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #1e293b;">${this.socTechTickets.totalCount}</div>
            <div style="font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Total Incidents</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #e9d5ff; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #7b1fa2;">${this.socTechTickets.saasCount}</div>
            <div style="font-size: 10px; color: #7b1fa2; font-weight: 700; text-transform: uppercase; margin-top: 2px;">SaaS Cloud</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #fecdd3; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #c1272d;">${this.socTechTickets.onpremCount}</div>
            <div style="font-size: 10px; color: #c1272d; font-weight: 700; text-transform: uppercase; margin-top: 2px;">On-Prem SO</div>
          </div>
          <div style="background: #ffffff; border: 1.5px solid #bae6fd; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 800; color: #0284c7;">${this.socTechTickets.securityCount}</div>
            <div style="font-size: 10px; color: #0284c7; font-weight: 700; text-transform: uppercase; margin-top: 2px;">Sécurité</div>
          </div>
        </div>

        <!-- Client Distribution Summary -->
        <div style="margin-bottom: 20px;">
          <h4 style="font-size: 13px; font-weight: 800; color: #4a1480; margin: 0 0 8px 0;">📊 Répartition des Incidents par Client</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #4a1480; color: #ffffff;">
                <th style="padding: 6px 10px; text-align: left;">Client / Plateforme</th>
                <th style="padding: 6px 10px; text-align: center;">Nombre d'Incidents</th>
                <th style="padding: 6px 10px; text-align: right;">Pourcentage</th>
              </tr>
            </thead>
            <tbody>
              ${clientRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Detailed Tickets Table -->
        <div>
          <h4 style="font-size: 13px; font-weight: 800; color: #4a1480; margin: 0 0 8px 0;">🎫 Liste des Incidents Jira Traités (${displayTickets.length} affichés)</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #7c3aed; color: #ffffff;">
                <th style="padding: 6px 8px; text-align: left;">Clé</th>
                <th style="padding: 6px 8px; text-align: left;">Résumé / Incidents</th>
                <th style="padding: 6px 8px; text-align: center;">MTTD</th>
                <th style="padding: 6px 8px; text-align: left;">Type</th>
                <th style="padding: 6px 8px; text-align: left;">Statut</th>
                <th style="padding: 6px 8px; text-align: left;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${ticketRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- Footer Notice -->
        <div style="margin-top: 25px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;">
          <div>VermGuard AI Copilot — Vermeg SOC Operations</div>
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

          const safeAnalyst = analystName.replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `Rapport_SOC_${safeAnalyst}_${this.socStartDate || 'start'}_${this.socEndDate || 'end'}.pdf`;
          pdf.save(filename);
        }).catch(err => {
          if (document.body.contains(container)) {
            document.body.removeChild(container);
          }
          console.error('PDF Canvas error:', err);
          alert('Erreur lors de la génération du PDF.');
        });
      }).catch(err => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
        console.error('PDF Library import error:', err);
        alert('Erreur lors du chargement des bibliothèques PDF.');
      });
    }, 50);
  }

  // --- LOGIC ---

  loadUsers() {
    // Instant 0ms cache: show users from localStorage immediately
    const cacheKey = 'vermeg_users_cache';
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.users = parsed;
          this.applyFilters();
          this.initUserProfile();
          this.cdr.detectChanges();
        }
      } catch (e) {}
    }

    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.applyFilters();
        this.initUserProfile();
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (!cached) this.showError('Error loading data.');
        console.error(err);
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters() {
    let temp = this.users;

    // Filtrage par rôle
    if (this.selectedRoleFilter !== 'all') {
      temp = temp.filter(u => u.role === this.selectedRoleFilter);
    }

    // Filtrage par texte de recherche
    if (this.directorySearchQuery.trim()) {
      const query = this.directorySearchQuery.toLowerCase().trim();
      temp = temp.filter(u =>
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
      );
    }

    this.filteredUsers = temp;
  }

  getEmptyUser(): User {
    return {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'soc',
      openTicketsCount: 0,
      canAddUser: false
    };
  }

  canUserAdd(): boolean {
    if (this.activeRole === 'manager') {
      return true;
    }
    // Find the logged user in our list to get their DB permission status (case-insensitive)
    const loggedInUserInDb = this.users.find(
      u => u.email.toLowerCase() === this.loggedUserEmail.toLowerCase()
    );
    return loggedInUserInDb?.canAddUser === true;
  }

  logout() {
    localStorage.removeItem('loggedUser');
    this.router.navigate(['/auth']);
  }

  onRoleChange(newRole: string) {
    this.activeRole = newRole;
  }

  setRoleFilter(role: string) {
    this.selectedRoleFilter = role;
    this.applyFilters();
  }

  setScreen(screen: 'directory' | 'tickets') {
    this.currentScreen = screen;
    if (screen === 'directory') {
      this.loadUsers();
    }
  }

  getTotalUsers() {
    // Retourne le total SOC + Support (hors managers)
    return this.users.filter(u => u.role !== 'manager').length;
  }

  getTotalOpenTickets() {
    // Somme des tickets ouverts pour SOC + Support
    return this.users
      .filter(u => u.role !== 'manager')
      .reduce((acc, user) => acc + (user.openTicketsCount || 0), 0);
  }

  openAddModal() {
    if (!this.canUserAdd()) {
      this.showError('Access denied: You do not have permission to add users.');
      return;
    }
    this.newUser = this.getEmptyUser();
    this.showAddModal = true;
  }

  openEditModal(user: User) {
    if (this.activeRole !== 'manager') {
      this.showError('Access denied: Only Managers can edit users.');
      return;
    }
    this.editingUser = { ...user };
    this.showEditModal = true;
  }

  closeModals() {
    this.showAddModal = false;
    this.showEditModal = false;
  }

  createUser() {
    if (!this.canUserAdd()) return;
    this.userService.createUser(this.newUser).subscribe({
      next: (user) => {
        this.showSuccess(`User ${user.firstName} ${user.lastName} successfully added.`);
        this.auditService.logAction(
          'USER_CREATE',
          this.loggedUserName,
          `Created new user: ${user.firstName} ${user.lastName} (${user.role})`
        ).subscribe();
        this.closeModals();
        this.loadUsers();
      },
      error: (err) => {
        this.showError('Error creating user.');
      }
    });
  }

  toggleAddUserPermission(user: User) {
    if (this.activeRole !== 'manager') return;
    const updatedStatus = !user.canAddUser;
    this.userService.updateUser(user.id!, { canAddUser: updatedStatus }).subscribe({
      next: () => {
        const action = updatedStatus ? 'granted' : 'revoked';
        this.showSuccess(`Permission updated for ${user.firstName} ${user.lastName}.`);
        this.auditService.logAction(
          'PERMISSION_UPDATE',
          this.loggedUserName,
          `${action.charAt(0).toUpperCase() + action.slice(1)} "Add User" permission for ${user.firstName} ${user.lastName}`
        ).subscribe();
        this.loadUsers();
      },
      error: (err) => {
        this.showError('Error updating permission.');
      }
    });
  }

  exportDirectoryToCsv() {
    const usersToExport = this.filteredUsers;
    if (usersToExport.length === 0) return;
    
    let csvContent = '\uFEFFFirst Name,Last Name,Email,Role,Open Tickets,Can Add User\n';
    usersToExport.forEach(u => {
      csvContent += `${u.firstName},${u.lastName},${u.email},${u.role},${u.openTicketsCount},${u.canAddUser ? 'Yes' : 'No'}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `staff_directory_${this.selectedRoleFilter}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.auditService.logAction(
      'CSV_EXPORT',
      this.loggedUserName,
      `Exported staff directory to CSV (filter: ${this.selectedRoleFilter}, ${usersToExport.length} users)`
    ).subscribe();
  }

  updateUser() {
    if (this.activeRole !== 'manager' || !this.editingUser.id) return;
    this.userService.updateUser(this.editingUser.id, this.editingUser).subscribe({
      next: () => {
        this.showSuccess(`User successfully updated.`);
        this.auditService.logAction(
          'USER_UPDATE',
          this.loggedUserName,
          `Updated profile for ${this.editingUser.firstName} ${this.editingUser.lastName} (${this.editingUser.email})`
        ).subscribe();
        this.closeModals();
        this.loadUsers();
      },
      error: (err) => {
        this.showError('Error updating user.');
      }
    });
  }

  deleteUser(user: User) {
    if (this.activeRole !== 'manager') {
      this.showError('Access denied: Only Managers can delete users.');
      return;
    }
    if (confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
      if (user.id) {
        this.userService.deleteUser(user.id).subscribe({
          next: () => {
            this.showSuccess(`User deleted.`);
            this.auditService.logAction(
              'USER_DELETE',
              this.loggedUserName,
              `Deleted user account: ${user.firstName} ${user.lastName} (${user.email})`
            ).subscribe();
            this.loadUsers();
          },
          error: (err) => {
            this.showError('Error deleting user.');
          }
        });
      }
    }
  }

  showSuccess(msg: string) {
    this.successMessage = msg;
    setTimeout(() => this.successMessage = '', 4000);
  }

  showError(msg: string) {
    this.errorMessage = msg;
    setTimeout(() => this.errorMessage = '', 4000);
  }

  // --- SLO GUARD CRUD ---

  showSloGuard() {
    if (this.activeRole === 'manager' || this.activeRole === 'soc') {
      this.currentScreen = 'slo-guard';
      this.sloViewerTab = 'orgs';
      this.selectedOrg = null;
      this.selectedSlo = null;
      this.orgSlos = [];
      this.sloHistory = null;
      this.loadDbOrganizations();
    }
  }

  loadDowntimes() {
    this.sloGuardLoading = true;
    this.sloGuardError = '';
    this.downtimeService.getDowntimes().subscribe({
      next: (data) => {
        this.downtimes = data;
        this.sloGuardLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.sloGuardError = 'Failed to load downtime records.';
        this.sloGuardLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getEmptyDowntime(): Downtime {
    return {
      organizationName: 'STT',
      startTime: '',
      endTime: '',
      duration: 0,
      createdBy: this.loggedUserName || 'SOC Analyst'
    };
  }

  onDowntimeDateChange(mode: 'new' | 'edit') {
    const dt = mode === 'new' ? this.newDowntime : this.editingDowntime;
    if (dt.startTime && dt.endTime) {
      const start = new Date(dt.startTime).getTime();
      const end = new Date(dt.endTime).getTime();
      if (end > start) {
        dt.duration = Math.round((end - start) / 60000); // Minutes
      } else {
        dt.duration = 0;
      }
    } else {
      dt.duration = 0;
    }
  }

  formatDuration(minutes: number): string {
    if (minutes <= 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }

  openAddDowntimeModal() {
    this.newDowntime = this.getEmptyDowntime();
    this.showDowntimeAddModal = true;
    this.cdr.detectChanges();
  }

  saveNewDowntime() {
    if (!this.newDowntime.organizationName || !this.newDowntime.startTime || !this.newDowntime.endTime) {
      this.showSloGuardError('Please fill in all required fields.');
      return;
    }

    this.newDowntime.createdBy = this.loggedUserName;
    this.onDowntimeDateChange('new');

    if (this.newDowntime.duration <= 0) {
      this.showSloGuardError('End time must be after start time.');
      return;
    }

    this.downtimeService.createDowntime(this.newDowntime).subscribe({
      next: () => {
        this.showSloGuardSuccess('Downtime record added successfully.');
        this.showDowntimeAddModal = false;
        
        this.auditService.logAction(
          'DOWNTIME_CREATE',
          this.loggedUserName,
          `Added downtime record for ${this.newDowntime.organizationName} (${this.newDowntime.duration}m)`
        ).subscribe();

        this.newDowntime = this.getEmptyDowntime();
        this.loadDowntimes();
      },
      error: () => {
        this.showSloGuardError('Failed to create downtime record.');
      }
    });
  }

  openEditDowntimeModal(dt: Downtime) {
    this.editingDowntime = { ...dt };
    if (this.editingDowntime.startTime) {
      this.editingDowntime.startTime = this.formatDateForInput(this.editingDowntime.startTime);
    }
    if (this.editingDowntime.endTime) {
      this.editingDowntime.endTime = this.formatDateForInput(this.editingDowntime.endTime);
    }
    this.showDowntimeEditModal = true;
    this.cdr.detectChanges();
  }

  formatDateForInput(dateStr: string): string {
    const d = new Date(dateStr);
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  saveEditedDowntime() {
    if (!this.editingDowntime.id) return;
    if (!this.editingDowntime.organizationName || !this.editingDowntime.startTime || !this.editingDowntime.endTime) {
      this.showSloGuardError('Please fill in all required fields.');
      return;
    }

    this.onDowntimeDateChange('edit');

    if (this.editingDowntime.duration <= 0) {
      this.showSloGuardError('End time must be after start time.');
      return;
    }

    this.downtimeService.updateDowntime(this.editingDowntime.id, this.editingDowntime).subscribe({
      next: () => {
        this.showSloGuardSuccess('Downtime record updated successfully.');
        this.showDowntimeEditModal = false;
        
        this.auditService.logAction(
          'DOWNTIME_UPDATE',
          this.loggedUserName,
          `Updated downtime record ID ${this.editingDowntime.id} for ${this.editingDowntime.organizationName}`
        ).subscribe();

        this.loadDowntimes();
      },
      error: () => {
        this.showSloGuardError('Failed to update downtime record.');
      }
    });
  }

  deleteDowntimeRecord(id: number) {
    if (confirm('Are you sure you want to delete this downtime record?')) {
      this.downtimeService.deleteDowntime(id).subscribe({
        next: () => {
          this.showSloGuardSuccess('Downtime record deleted successfully.');
          
          this.auditService.logAction(
            'DOWNTIME_DELETE',
            this.loggedUserName,
            `Deleted downtime record ID ${id}`
          ).subscribe();

          this.loadDowntimes();
        },
        error: () => {
          this.showSloGuardError('Failed to delete downtime record.');
        }
      });
    }
  }

  showSloGuardSuccess(msg: string) {
    this.sloGuardSuccess = msg;
    setTimeout(() => this.sloGuardSuccess = '', 4000);
  }

  showSloGuardError(msg: string) {
    this.sloGuardError = msg;
    setTimeout(() => this.sloGuardError = '', 4000);
  }

  // ── SLO VIEWER (Datadog) ──

  openSloViewer() {
    this.sloViewerActive = true;
    this.sloViewerTab = 'orgs';
    this.selectedOrg = null;
    this.selectedSlo = null;
    this.orgSlos = [];
    this.sloHistory = null;
    this.loadDbOrganizations();
  }

  closeSloViewer() {
    this.sloViewerActive = false;
  }

  loadDbOrganizations() {
    this.dbOrgsError = '';

    // Compute timestamps from current preset/custom range
    const { fromTs, toTs } = this.resolveOverviewRange();
    const cacheKey = `vermeg_live_overview_${fromTs}_${toTs}`;

    // ── Affichage immédiat depuis le cache localStorage ──
    const cachedStr = localStorage.getItem(cacheKey);
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr);
        this.orgOverview = cached.organizations || [];
        this.orgOverviewLastRefreshed = cached.lastRefreshed || '';
        this.orgOverviewDateRange = `${cached.startDate} → ${cached.endDate}`;
        this.dbOrganizations = (cached.organizations || []).map((o: any) => ({
          orgId: o.orgId, orgName: o.orgName, lastMonthUptime: o.uptime,
        }));
        this.dbOrgsLoading = false;
        this.orgOverviewLoading = false;
        this.cdr.detectChanges();
      } catch {
        this.orgOverviewLoading = true;
        this.dbOrgsLoading = true;
      }
    } else {
      this.orgOverviewLoading = true;
      this.dbOrgsLoading = true;
    }

    // ── Fetch depuis le backend (Datadog en arrière-plan) ──
    this.orgService.getLiveSlosOverview(fromTs, toTs).subscribe({
      next: (resp) => {
        this.orgOverview = resp.organizations || [];
        this.orgOverviewLastRefreshed = resp.lastRefreshed;
        this.orgOverviewDateRange = `${resp.startDate} → ${resp.endDate}`;
        this.dbOrganizations = (resp.organizations || []).map((o: any) => ({
          orgId: o.orgId, orgName: o.orgName, lastMonthUptime: o.uptime,
        }));
        this.dbOrgsLoading = false;
        this.orgOverviewLoading = false;
        try { localStorage.setItem(cacheKey, JSON.stringify(resp)); } catch {}
        this.cdr.detectChanges();
      },
      error: () => {
        if (!cachedStr) this.dbOrgsError = 'Impossible de charger les uptimes depuis Datadog.';
        this.dbOrgsLoading = false;
        this.orgOverviewLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Compute {fromTs, toTs} based on selected preset or custom dates */
  private resolveOverviewRange(): { fromTs: number; toTs: number } {
    const nowSec = Math.floor(Date.now() / 1000);
    if (this.overviewPreset === 'custom' && this.overviewCustomFrom && this.overviewCustomTo) {
      return {
        fromTs: Math.floor(new Date(this.overviewCustomFrom).getTime() / 1000),
        toTs:   Math.floor(new Date(this.overviewCustomTo + 'T23:59:59').getTime() / 1000),
      };
    }
    const days = this.overviewPreset === '7d' ? 7 : this.overviewPreset === '90d' ? 90 : this.overviewPreset === '6m' ? 180 : 30;
    return { fromTs: nowSec - days * 86400, toTs: nowSec };
  }

  /** Change preset and reload */
  setOverviewPreset(preset: '7d' | '30d' | '90d' | '6m' | 'custom') {
    this.overviewPreset = preset;
    this.overviewShowCustomPicker = preset === 'custom';
    // Clear caches so fresh data is fetched
    Object.keys(localStorage).filter(k => k.startsWith('vermeg_live_overview_')).forEach(k => localStorage.removeItem(k));
    if (preset !== 'custom') this.loadDbOrganizations();
  }

  /** Trigger custom date range fetch */
  applyCustomOverviewRange() {
    if (this.overviewCustomFrom && this.overviewCustomTo) {
      Object.keys(localStorage).filter(k => k.startsWith('vermeg_live_overview_')).forEach(k => localStorage.removeItem(k));
      this.loadDbOrganizations();
    }
  }

  getOrgLastMonthUptime(org: Organization): number {
    if (!org) return 100;
    if (typeof org.lastMonthUptime === 'number') return org.lastMonthUptime;
    return 100;
  }

  /** Green ≥99.9% / Red <99.9% */
  getOrgUptimeBadgeClass(uptime: number): string {
    return uptime >= 99.9 ? 'org-uptime-excellent' : 'org-uptime-poor';
  }


  selectOrgForSlos(org: Organization) {
    this.selectedOrg = org;
    this.selectedSlo = null;
    this.sloHistory = null;
    this.sloViewerTab = 'slos';
    this.orgSlosError = '';

    // Fast Cache 0ms pour ouverture instantanée
    const cacheKey = 'vermeg_org_slos_' + org.orgId;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        this.orgSlos = parsed.slos || [];
        this.orgSlosLoading = false;
      } catch (e) {
        this.orgSlos = [];
        this.orgSlosLoading = true;
      }
    } else {
      this.orgSlos = [];
      this.orgSlosLoading = true;
    }

    this.orgService.getSlos(org.orgId).subscribe({
      next: (resp) => {
        this.orgSlos = resp.slos || [];
        this.orgSlosLoading = false;
        try {
          localStorage.setItem(cacheKey, JSON.stringify(resp));
        } catch (e) {}
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (!cached) {
          this.orgSlosError = err?.error?.message || 'Failed to fetch SLOs from Datadog.';
        }
        this.orgSlosLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  initSloDateRange(preset: '7d' | '30d' | '90d' = '30d') {
    const end = new Date();
    const start = new Date();
    const days = preset === '7d' ? 7 : preset === '90d' ? 90 : 30;
    start.setDate(end.getDate() - days);

    this.sloHistoryEndDate = end.toISOString().split('T')[0];
    this.sloHistoryStartDate = start.toISOString().split('T')[0];
    this.sloHistoryPreset = preset;
  }

  setSloDatePreset(preset: '7d' | '30d' | '90d') {
    this.initSloDateRange(preset);
    this.fetchSloHistoryData();
  }

  applySloCustomDateRange() {
    this.sloHistoryPreset = 'custom';
    this.fetchSloHistoryData();
  }

  selectSloForHistory(slo: SloItem) {
    if (!this.selectedOrg) return;
    this.selectedSlo = slo;
    this.sloViewerTab = 'history';

    if (!this.sloHistoryStartDate || !this.sloHistoryEndDate) {
      this.initSloDateRange('30d');
    }

    this.fetchSloHistoryData();
  }

  fetchSloHistoryData() {
    if (!this.selectedOrg || !this.selectedSlo) return;

    this.sloHistory = null;
    this.sloHistoryLoading = true;
    this.sloHistoryError = '';

    const fromTs = Math.floor(new Date(this.sloHistoryStartDate + 'T00:00:00').getTime() / 1000);
    const toTs = Math.floor(new Date(this.sloHistoryEndDate + 'T23:59:59').getTime() / 1000);

    this.orgService.getSloHistory(this.selectedOrg.orgId, this.selectedSlo.id, fromTs, toTs).subscribe({
      next: (data) => {
        this.sloHistory = data;
        this.sloHistoryLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.sloHistoryError = err?.error?.message || 'Failed to fetch SLO history for the selected date range.';
        this.sloHistoryLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getSloStatusClass(slo: SloItem): string {
    if (!slo.targetThreshold) return 'status-open';
    return 'status-progress';
  }

  getUptimeColor(uptime: number | null): string {
    if (uptime === null) return '#6b7280';
    if (uptime >= 99.9) return '#10b981';
    if (uptime >= 99) return '#f59e0b';
    return '#ef4444';
  }

  getUptimeLabel(uptime: number | null): string {
    if (uptime === null) return 'N/A';
    return uptime.toFixed(3) + '%';
  }

  getBudgetClass(budget: number | null): string {
    if (budget === null) return '';
    if (budget >= 50) return 'budget-good';
    if (budget >= 20) return 'budget-warning';
    return 'budget-critical';
  }

  formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  toggleDowntimeExclusion(event: any) {
    if (!this.selectedOrg || !this.selectedSlo) return;

    const stored = localStorage.getItem('loggedUser');
    const user = stored ? JSON.parse(stored) : null;
    const excludedBy = user ? `${user.name || user.email} (${(user.role || 'soc').toUpperCase()})` : 'SOC Admin';

    this.orgService.toggleExclusion({
      orgId: String(this.selectedOrg.orgId),
      sloId: this.selectedSlo.id,
      eventTimestamp: event.timestamp,
      durationMins: event.durationMins,
      reason: event.isExcluded ? undefined : 'Approved Maintenance / Outage Correction',
      excludedBy,
    }).subscribe({
      next: (res) => {
        // Update the local list immediately (optimistic update)
        if (this.sloHistory) {
          const idx = this.sloHistory.downtimeHistory.findIndex(
            (e: any) => e.timestamp === event.timestamp
          );
          if (idx !== -1) {
            this.sloHistory.downtimeHistory[idx].isExcluded = (res.action === 'excluded');
            this.sloHistory.downtimeHistory[idx].excludedBy = excludedBy;
          }
        }
        // Refresh the full history to get recalculated KPIs
        this.fetchSloHistoryData();
      },
      error: () => {
        alert('Failed to toggle downtime exclusion. Please try again.');
      }
    });
  }

  formatDowntimeWindow(ev: any): string {
    if (!ev) return '';
    if (typeof ev === 'string') return ev;
    if (ev.isMuted && ev.datadogDowntimeWindow) {
      if (typeof ev.datadogDowntimeWindow === 'string') return ev.datadogDowntimeWindow;
      if (typeof ev.datadogDowntimeWindow === 'object' && ev.datadogDowntimeWindow.id) {
        return `Mute #${ev.datadogDowntimeWindow.id}`;
      }
    }
    return '';
  }

  getCountByCause(cause: string): number {
    if (!this.sloHistory?.downtimeHistory) return 0;
    if (cause === 'Downtime') {
      return this.sloHistory.downtimeHistory.filter((e: any) => e.failureCause === 'Downtime' || !e.failureCause || e.failureCause.includes('HTTP')).length;
    }
    return this.sloHistory.downtimeHistory.filter((e: any) => e.failureCause === cause).length;
  }

  // --- GLOBAL NOTIFICATIONS HELPERS ---

  triggerGlobalNotification(key: string, message: string): void {
    this.ngZone.run(() => {
      const id = this.nextNotificationId++;
      const note = { id, key, message };
      this.globalNotifications.push(note);
      
      // Toujours enregistrer dans l'historique des notifications (clé 'SYSTEM' si non spécifiée)
      const targetKey = (key && key.trim()) ? key : 'SYSTEM';
      this.socketService.addNotification(targetKey, message);

      this.playPopSound();
      this.cdr.detectChanges();

      setTimeout(() => {
        this.ngZone.run(() => {
          this.removeGlobalNotification(id);
        });
      }, 7000);
    });
  }

  removeGlobalNotification(id: number): void {
    this.globalNotifications = this.globalNotifications.filter(n => n.id !== id);
    this.cdr.detectChanges();
  }

  private playPopSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  ngOnDestroy(): void {
    if (this.socketSub) {
      this.socketSub.unsubscribe();
    }
  }
}



