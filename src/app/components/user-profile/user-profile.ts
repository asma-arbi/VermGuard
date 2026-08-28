import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService, User } from '../../services/user.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.css'
})
export class UserProfileComponent implements OnInit {
  profileForm = {
    id: 0,
    firstName: 'Aymen',
    lastName: 'Bchir',
    email: 'aymen@vermeg.com',
    role: 'manager',
    newPassword: '',
    confirmPassword: ''
  };

  openTicketsCount = 0;
  isLoading = false;
  isSaving = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    this.isLoading = true;
    const stored = localStorage.getItem('loggedUser');
    let emailToFind = '';

    if (stored) {
      try {
        const u = JSON.parse(stored);
        this.profileForm.id = u.id || 0;
        this.profileForm.firstName = u.firstName || (u.displayName ? u.displayName.split(' ')[0] : 'Aymen');
        this.profileForm.lastName = u.lastName || (u.displayName ? u.displayName.split(' ').slice(1).join(' ') : 'Bchir');
        this.profileForm.email = u.email || 'aymen@vermeg.com';
        this.profileForm.role = u.role || 'manager';
        this.openTicketsCount = u.openTicketsCount || 0;
        emailToFind = u.email || '';
      } catch (e) {}
    }

    // Immediate change detection for synchronous render
    this.cdr.detectChanges();

    // Fetch fresh user data from API backend asynchronously
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.isLoading = false;
        if (users && users.length > 0) {
          const search = emailToFind || this.profileForm.email;
          const fresh = users.find(usr => usr.email.toLowerCase() === search.toLowerCase());
          if (fresh) {
            this.profileForm.id = fresh.id || this.profileForm.id;
            this.profileForm.firstName = fresh.firstName || this.profileForm.firstName;
            this.profileForm.lastName = fresh.lastName || this.profileForm.lastName;
            this.profileForm.email = fresh.email || this.profileForm.email;
            this.profileForm.role = fresh.role || this.profileForm.role;
            this.openTicketsCount = fresh.openTicketsCount || 0;
          }
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getInitials(): string {
    const f = (this.profileForm.firstName || 'A').charAt(0).toUpperCase();
    const l = (this.profileForm.lastName || 'B').charAt(0).toUpperCase();
    return (f + l) || 'AB';
  }

  saveProfile() {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.profileForm.firstName.trim() || !this.profileForm.lastName.trim() || !this.profileForm.email.trim()) {
      this.errorMessage = 'First Name, Last Name and Email Address are required.';
      return;
    }

    if (this.profileForm.newPassword) {
      if (this.profileForm.newPassword.length < 3) {
        this.errorMessage = 'New password must be at least 3 characters long.';
        return;
      }
      if (this.profileForm.newPassword !== this.profileForm.confirmPassword) {
        this.errorMessage = 'New password and confirmation password do not match.';
        return;
      }
    }

    if (!this.profileForm.id) {
      this.errorMessage = 'User ID not identified. Please re-login.';
      return;
    }

    this.isSaving = true;

    const updateData: Partial<User> = {
      firstName: this.profileForm.firstName.trim(),
      lastName: this.profileForm.lastName.trim(),
      email: this.profileForm.email.trim()
    };

    if (this.profileForm.newPassword && this.profileForm.newPassword.trim()) {
      updateData.password = this.profileForm.newPassword.trim();
    }

    this.userService.updateUser(this.profileForm.id, updateData).subscribe({
      next: (updated) => {
        this.isSaving = false;
        this.successMessage = 'Your personal profile has been updated successfully!';
        this.profileForm.newPassword = '';
        this.profileForm.confirmPassword = '';

        // Update local session
        const logged = {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          displayName: `${updated.firstName} ${updated.lastName}`,
          role: updated.role,
          email: updated.email,
          openTicketsCount: updated.openTicketsCount,
          canAddUser: updated.canAddUser
        };
        localStorage.setItem('loggedUser', JSON.stringify(logged));
        this.cdr.detectChanges();

        setTimeout(() => { this.successMessage = ''; }, 4000);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.message || 'Failed to update profile. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
