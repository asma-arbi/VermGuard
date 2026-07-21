import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiraService, JiraTicket, TeamTickets } from '../../services/jira.service';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

type TeamView = 'soc' | 'support';
type TabView  = 'onPrem' | 'saas';

@Component({
  selector: 'app-jira-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './jira-tickets.html',
  styleUrl: './jira-tickets.css',
})
export class JiraTicketsComponent implements OnInit, OnDestroy {
  /** Vue active : 'soc' ou 'support' */
  activeTeam: TeamView = 'soc';

  /** Onglet actif dans la vue SOC */
  activeTab: TabView = 'onPrem';

  /** Données de tickets chargées depuis l'API */
  teamTickets: TeamTickets | null = null;

  /** État de chargement */
  isLoading = false;

  /** Message d'erreur éventuel */
  errorMessage = '';

  /** Champ de recherche temps réel */
  searchQuery = '';

  /** Highlight flag for real-time updates */
  showUpdatePulse = false;

  /** Date filters */
  startDateFilter = '';
  endDateFilter = '';

  /** Notifications list */
  notifications: Array<{ id: number; key: string; message: string }> = [];
  nextNotificationId = 0;

  /** Quick Action Panel */
  actionPanelTicket: JiraTicket | null = null;
  assigneeInput = '';
  commentInput = '';
  actionLoading = false;
  actionSuccess = '';
  actionError = '';

  private socketSub!: Subscription;

  constructor(
    private jiraService: JiraService,
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Lire le rôle de l'utilisateur connecté pour pré-sélectionner la vue
    const role = localStorage.getItem('role') || 'soc';
    if (role === 'support') {
      this.activeTeam = 'support';
    } else {
      this.activeTeam = 'soc'; // manager ou soc
    }
    
    this.loadTickets();

    // S'abonner aux mises à jour en temps réel (WebSockets)
    this.socketSub = this.socketService.onJiraTicketsUpdated().subscribe((data) => {
      if (data.team === this.activeTeam) {
        // Détecter les nouveaux tickets
        const oldKeys = new Set<string>();
        if (this.teamTickets) {
          (this.teamTickets.onPrem || []).forEach(t => oldKeys.add(t.key));
          (this.teamTickets.saas || []).forEach(t => oldKeys.add(t.key));
        }

        const newOnPrem = data.tickets.onPrem || [];
        const newSaas = data.tickets.saas || [];

        newOnPrem.forEach((t: any) => {
          if (this.teamTickets && !oldKeys.has(t.key)) {
            this.triggerNotification(t.key, t.fields.summary);
          }
        });
        newSaas.forEach((t: any) => {
          if (this.teamTickets && !oldKeys.has(t.key)) {
            this.triggerNotification(t.key, t.fields.summary);
          }
        });

        this.teamTickets = data.tickets;
        
        // Déclencher l'animation visuelle
        this.showUpdatePulse = true;
        this.cdr.detectChanges(); // Forcer la mise à jour UI pour l'animation
        
        // Jouer un petit son
        this.playPopSound();

        // Retirer l'animation après 2 secondes
        setTimeout(() => {
          this.showUpdatePulse = false;
          this.cdr.detectChanges();
        }, 2000);
      }
    });
  }

  triggerNotification(key: string, summary: string): void {
    const id = this.nextNotificationId++;
    const msg = `New ticket detected: ${key} - ${summary}`;
    this.notifications.push({
      id,
      key,
      message: msg
    });
    this.socketService.addNotification(key, msg);
    this.cdr.detectChanges();

    // Auto-remove notification toast after 6 seconds
    setTimeout(() => {
      this.notifications = this.notifications.filter(n => n.id !== id);
      this.cdr.detectChanges();
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.socketSub) {
      this.socketSub.unsubscribe();
    }
  }

  /** Génère un petit son "Pop" très discret pour notifier l'utilisateur */
  private playPopSound() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(600, audioCtx.currentTime); // Fréquence douce
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      // AudioContext non supporté ou bloqué par le navigateur, ignorer
    }
  }

  /** Change la vue d'équipe et recharge les tickets */
  setTeam(team: TeamView): void {
    this.activeTeam = team;
    this.activeTab = 'onPrem';
    this.loadTickets();
  }

  /** Change l'onglet actif (On-Prem / SaaS) dans la vue SOC */
  setTab(tab: TabView): void {
    this.activeTab = tab;
  }

  /**/
  get onPremTicketsCount(): number {
    return this.teamTickets?.onPrem?.length || 0;
  }

  get saasTicketsCount(): number {
    return this.teamTickets?.saas?.length || 0;
  }

  get totalTicketsCount(): number {
    return this.onPremTicketsCount + (this.activeTeam === 'soc' ? this.saasTicketsCount : 0);
  }

  /** Retourne le nombre de tickets par niveau de sévérité */
  getPriorityCounts() {
    const tickets = this.activeTeam === 'soc' 
      ? [...(this.teamTickets?.onPrem || []), ...(this.teamTickets?.saas || [])]
      : (this.teamTickets?.onPrem || []);

    let critical = 0;
    let high = 0;
    let medium = 0;

    tickets.forEach(t => {
      const p = t.fields.priority?.name?.toLowerCase();
      if (p === 'critical' || p === 'highest') critical++;
      else if (p === 'high') high++;
      else if (p === 'medium') medium++;
    });

    return { critical, high, medium };
  }

  /** Appel API — récupère les tickets selon l'équipe active */
  loadTickets(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.teamTickets = null;

    this.jiraService.getTicketsForTeam(this.activeTeam).subscribe({
      next: (data) => {
        this.teamTickets = data;
        this.isLoading = false;
        this.cdr.detectChanges(); // Force UI update immediately
      },
      error: (err) => {
        this.errorMessage = 'Unable to load Jira tickets. Check backend connection.';
        this.isLoading = false;
        console.error(err);
        this.cdr.detectChanges();
      },
    });
  }

  /** Tickets actuellement affichés filtrés par la recherche et par les dates */
  get currentTickets(): JiraTicket[] {
    if (!this.teamTickets) return [];
    let raw = this.activeTab === 'saas' ? (this.teamTickets.saas ?? []) : this.teamTickets.onPrem;
    
    // Filtrage par recherche
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      raw = raw.filter(t => 
        t.key.toLowerCase().includes(query) ||
        t.fields.summary.toLowerCase().includes(query) ||
        (t.fields.assignee?.displayName || '').toLowerCase().includes(query) ||
        t.fields.status.name.toLowerCase().includes(query)
      );
    }

    // Filtrage par date de début
    if (this.startDateFilter) {
      const start = new Date(this.startDateFilter);
      start.setHours(0, 0, 0, 0);
      raw = raw.filter(t => new Date(t.fields.created) >= start);
    }

    // Filtrage par date de fin
    if (this.endDateFilter) {
      const end = new Date(this.endDateFilter);
      end.setHours(23, 59, 59, 999);
      raw = raw.filter(t => new Date(t.fields.created) <= end);
    }
    
    return raw;
  }

  /** Exporter la liste filtrée au format CSV */
  exportToCsv(): void {
    const tickets = this.currentTickets;
    if (tickets.length === 0) return;

    let csvContent = '\uFEFFKey,Summary,Status,Priority,Assignee,Created\n';
    tickets.forEach(t => {
      const key = t.key;
      const summary = `"${t.fields.summary.replace(/"/g, '""')}"`;
      const status = t.fields.status.name;
      const priority = t.fields.priority?.name || 'None';
      const assignee = t.fields.assignee ? t.fields.assignee.displayName : 'Unassigned';
      const created = this.formatDate(t.fields.created);
      csvContent += `${key},${summary},${status},${priority},${assignee},${created}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `jira_tickets_${this.activeTeam}_${this.activeTab}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /** Formater la date Jira en format lisible */
  formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  /** Couleur du badge de priorité */
  getPriorityClass(priority: string | null | undefined): string {
    switch (priority?.toLowerCase()) {
      case 'highest':
      case 'critical': return 'priority-critical';
      case 'high':     return 'priority-high';
      case 'medium':   return 'priority-medium';
      case 'low':      return 'priority-low';
      default:         return 'priority-default';
    }
  }

  /** Couleur du badge de statut */
  getStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('progress') || s.includes('review')) return 'status-progress';
    if (s.includes('open') || s.includes('to do'))      return 'status-open';
    return 'status-default';
  }

  // ─── Quick Action Panel ───────────────────────────────────────────

  openActionPanel(ticket: JiraTicket): void {
    this.actionPanelTicket = ticket;
    this.assigneeInput = '';
    this.commentInput = '';
    this.actionSuccess = '';
    this.actionError = '';
  }

  closeActionPanel(): void {
    this.actionPanelTicket = null;
  }

  doTransition(transitionName: string): void {
    if (!this.actionPanelTicket) return;
    this.actionLoading = true;
    this.actionSuccess = '';
    this.actionError = '';
    this.jiraService.transitionTicket(this.actionPanelTicket.key, transitionName).subscribe({
      next: (res) => {
        this.actionLoading = false;
        if (res.success) {
          this.actionSuccess = `Status changed to "${transitionName}" successfully!`;
          // Update local state for immediate UI feedback
          this.actionPanelTicket!.fields.status.name = transitionName;
        } else {
          this.actionError = res.error || 'Transition failed.';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.actionLoading = false;
        this.actionError = 'Could not change status. Check backend connection.';
        this.cdr.detectChanges();
      }
    });
  }

  doAssign(): void {
    if (!this.actionPanelTicket || !this.assigneeInput) return;
    this.actionLoading = true;
    this.actionSuccess = '';
    this.actionError = '';
    this.jiraService.assignTicket(this.actionPanelTicket.key, this.assigneeInput).subscribe({
      next: (res) => {
        this.actionLoading = false;
        this.actionSuccess = `Ticket assigned to "${this.assigneeInput}" successfully!`;
        this.assigneeInput = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.actionLoading = false;
        this.actionError = 'Could not assign ticket. Check backend connection.';
        this.cdr.detectChanges();
      }
    });
  }

  doComment(): void {
    if (!this.actionPanelTicket || !this.commentInput) return;
    const author = localStorage.getItem('loggedUser')
      ? JSON.parse(localStorage.getItem('loggedUser')!).email
      : 'VermGuard User';
    this.actionLoading = true;
    this.actionSuccess = '';
    this.actionError = '';
    this.jiraService.addComment(this.actionPanelTicket.key, this.commentInput, author).subscribe({
      next: () => {
        this.actionLoading = false;
        this.actionSuccess = 'Comment posted successfully!';
        this.commentInput = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.actionLoading = false;
        this.actionError = 'Could not post comment. Check backend connection.';
        this.cdr.detectChanges();
      }
    });
  }
}
