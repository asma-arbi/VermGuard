import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService, User } from '../../services/user.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css'
})
export class AuthComponent implements OnInit {
  isLoginMode = true;
  isLoading = false;
  errorMessage = '';

  rememberMe = false;

  // Forgot Password Workflow State
  showForgotPasswordModal = false;
  forgotEmail = '';
  forgotStep: 'email' | 'newPassword' | 'success' = 'email';
  forgotUser: User | null = null;
  newPassword = '';
  confirmPassword = '';
  forgotLoading = false;
  forgotError = '';

  formData = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'support' // default dropdown value
  };

  constructor(private router: Router, private userService: UserService) {}

  ngOnInit() {
    // Check remembered credentials on load
    const saved = localStorage.getItem('vermguard_remembered_credentials');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.email && parsed.password) {
          this.formData.email = parsed.email;
          this.formData.password = parsed.password;
          this.rememberMe = true;
        }
      } catch (e) {}
    }
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
  }

  setMode(loginMode: boolean) {
    this.isLoginMode = loginMode;
    this.errorMessage = '';
  }

  // --- FORGOT PASSWORD MODAL ---
  openForgotPasswordModal() {
    this.showForgotPasswordModal = true;
    this.forgotEmail = this.formData.email || '';
    this.forgotStep = 'email';
    this.forgotError = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.forgotUser = null;
  }

  closeForgotPasswordModal() {
    this.showForgotPasswordModal = false;
  }

  verifyForgotEmail() {
    if (!this.forgotEmail || !this.forgotEmail.trim()) {
      this.forgotError = 'Veuillez saisir votre adresse email professionnelle.';
      return;
    }
    this.forgotLoading = true;
    this.forgotError = '';

    this.userService.getUsers().subscribe({
      next: (users) => {
        this.forgotLoading = false;
        const found = users.find(u => u.email.toLowerCase() === this.forgotEmail.toLowerCase().trim());
        if (found) {
          this.forgotUser = found;
          this.forgotStep = 'newPassword';
        } else {
          this.forgotError = `Aucun compte n'a été trouvé pour l'email "${this.forgotEmail}".`;
        }
      },
      error: () => {
        this.forgotLoading = false;
        this.forgotError = 'Erreur lors de la vérification de l\'email.';
      }
    });
  }

  resetPassword() {
    if (!this.newPassword || this.newPassword.length < 3) {
      this.forgotError = 'Le mot de passe doit contenir au moins 3 caractères.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.forgotError = 'Les deux mots de passe ne correspondent pas.';
      return;
    }
    if (!this.forgotUser || !this.forgotUser.id) {
      this.forgotError = 'Utilisateur non identifié.';
      return;
    }

    this.forgotLoading = true;
    this.forgotError = '';

    this.userService.updateUser(this.forgotUser.id, { password: this.newPassword }).subscribe({
      next: () => {
        this.forgotLoading = false;
        this.forgotStep = 'success';
        this.formData.email = this.forgotUser!.email;
        this.formData.password = this.newPassword;
      },
      error: () => {
        this.forgotLoading = false;
        this.forgotError = 'Erreur lors de la mise à jour du mot de passe.';
      }
    });
  }

  onSubmit() {
    this.isLoading = true;
    this.errorMessage = '';
    
    if (this.isLoginMode) {
      // Login — check credentials
      this.userService.getUsers().subscribe({
        next: (users) => {
          this.isLoading = false;
          const foundUser = users.find(u => 
            u.email.toLowerCase() === this.formData.email.toLowerCase().trim() && 
            u.password === this.formData.password
          );
          if (foundUser) {
            // Handle Remember Me
            if (this.rememberMe) {
              localStorage.setItem('vermguard_remembered_credentials', JSON.stringify({
                email: this.formData.email,
                password: this.formData.password
              }));
            } else {
              localStorage.removeItem('vermguard_remembered_credentials');
            }

            localStorage.setItem('loggedUser', JSON.stringify({ 
              id: foundUser.id,
              firstName: foundUser.firstName,
              lastName: foundUser.lastName,
              displayName: `${foundUser.firstName} ${foundUser.lastName}`, 
              role: foundUser.role,
              email: foundUser.email,
              openTicketsCount: foundUser.openTicketsCount || 0,
              canAddUser: foundUser.canAddUser
            }));
            this.router.navigate(['/dashboard']);
          } else {
            this.errorMessage = 'Identifiants incorrects.';
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'Erreur serveur lors de la connexion.';
        }
      });
    } else {
      // Sign Up API Call
      const newUser: User = {
        firstName: this.formData.firstName,
        lastName: this.formData.lastName,
        email: this.formData.email,
        password: this.formData.password,
        role: this.formData.role as any,
        openTicketsCount: 0,
        canAddUser: false
      };

      this.userService.createUser(newUser).subscribe({
        next: (createdUser) => {
          this.isLoading = false;
          localStorage.setItem('loggedUser', JSON.stringify({ 
            id: createdUser.id,
            firstName: createdUser.firstName,
            lastName: createdUser.lastName,
            displayName: `${createdUser.firstName} ${createdUser.lastName}`, 
            role: createdUser.role,
            email: createdUser.email,
            openTicketsCount: 0,
            canAddUser: createdUser.canAddUser
          }));
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = 'Cet email est probablement déjà utilisé.';
        }
      });
    }
  }
}
