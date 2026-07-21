import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, User } from '../../services/user.service';
import { JiraTicketsComponent } from '../jira-tickets/jira-tickets';
import { AuditComponent } from '../audit/audit';
import { AuditService } from '../../services/audit.service';
import { SocketService } from '../../services/socket.service';
import { JiraService } from '../../services/jira.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, JiraTicketsComponent, AuditComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
  loggedUserName = 'Admin System';
  loggedUserEmail = '';
  roles = ['manager', 'soc', 'support'];
  activeRole = 'manager';
  selectedRoleFilter = 'all';

  // Navigation SPA : 'directory', 'tickets', 'audit', 'notifications' or 'soc-members'
  currentScreen: 'directory' | 'tickets' | 'audit' | 'notifications' | 'soc-members' = 'directory';

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

  constructor(
    private router: Router, 
    private userService: UserService,
    private auditService: AuditService,
    private socketService: SocketService,
    private jiraService: JiraService,
    private cdr: ChangeDetectorRef
  ) {}

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
}
