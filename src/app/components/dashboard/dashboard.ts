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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, JiraTicketsComponent, EvaluationManagerComponent, EvaluationSocViewComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  loggedUserName = 'Admin System';
  loggedUserEmail = '';
  roles = ['manager', 'soc', 'support'];
  activeRole = 'manager';
  selectedRoleFilter = 'all';

  // Navigation SPA : 'directory', 'tickets', 'audit', 'notifications', 'soc-members', 'slo-guard' or 'evaluations'
  currentScreen: 'directory' | 'tickets' | 'audit' | 'notifications' | 'soc-members' | 'slo-guard' | 'evaluations' = 'directory';

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
  socMaxResult = 50;
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
            // Premier chargement : enregistre les clés existantes et affiche un pop-up de confirmation
            allList.forEach((t: any) => this.knownTicketKeys.add(t.key));
            this.triggerGlobalNotification('', `⚡ System Active: ${allList.length} Jira tickets synced for ${data.team.toUpperCase()} team.`);
          } else {
            // Détection de nouveaux tickets arrivés ou mis à jour
            allList.forEach((t: any) => {
              if (!this.knownTicketKeys.has(t.key)) {
                this.knownTicketKeys.add(t.key);
                this.triggerGlobalNotification(t.key, `New Ticket Detected: ${t.key} - ${t.fields?.summary || ''}`);
              }
            });
          }
        }
      }
    });
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

    this.socTechLoading = true;
    this.socTechError = '';
    this.socTechTickets = null;
    this.onpremPage = 1;
    this.saasPage = 1;
    this.securityPage = 1;

    this.jiraService.getIncidentsPerSocTechnician(
      this.selectedSocMember,
      this.socStartDate,
      this.socEndDate,
      this.socMaxResult || 50
    ).subscribe({
      next: (data) => {
        this.socTechTickets = data;
        this.socTechLoading = false;
        this.cdr.detectChanges();
        this.initClientChart();
      },
      error: (err) => {
        this.socTechError = 'Unable to fetch incidents from Jira. Please check credentials/connection.';
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

  // --- LOGIC ---

  loadUsers() {
    // We load all users, and then apply frontend filtering
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.applyFilters();
        this.cdr.detectChanges(); // Force UI update immediately
      },
      error: (err) => {
        this.showError('Error loading data.');
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
    this.dbOrgsLoading = true;
    this.dbOrgsError = '';
    this.orgService.getOrganizations().subscribe({
      next: (data) => {
        this.dbOrganizations = data;
        this.dbOrgsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.dbOrgsError = 'Failed to load organizations from database.';
        this.dbOrgsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectOrgForSlos(org: Organization) {
    this.selectedOrg = org;
    this.selectedSlo = null;
    this.sloHistory = null;
    this.orgSlos = [];
    this.orgSlosLoading = true;
    this.orgSlosError = '';
    this.sloViewerTab = 'slos';

    this.orgService.getSlos(org.orgId).subscribe({
      next: (resp) => {
        this.orgSlos = resp.slos;
        this.orgSlosLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.orgSlosError = err?.error?.message || 'Failed to fetch SLOs from Datadog.';
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
    if (ev.datadogDowntimeWindow) {
      if (typeof ev.datadogDowntimeWindow === 'string') return ev.datadogDowntimeWindow;
      if (typeof ev.datadogDowntimeWindow === 'object' && ev.datadogDowntimeWindow.id) {
        return `Mute #${ev.datadogDowntimeWindow.id}`;
      }
    }
    if (ev.timestamp && ev.durationMins) {
      const startStr = this.formatTimestamp(ev.timestamp);
      const endStr = this.formatTimestamp(ev.timestamp + ev.durationMins * 60000);
      return `${startStr} ➔ ${endStr}`;
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



