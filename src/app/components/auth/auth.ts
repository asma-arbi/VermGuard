import { Component } from '@angular/core';
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
export class AuthComponent {
  isLoginMode = true;
  isLoading = false;
  errorMessage = '';

  formData = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'support' // default dropdown value
  };

  constructor(private router: Router, private userService: UserService) {}

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;
    this.errorMessage = '';
  }

  setMode(loginMode: boolean) {
    this.isLoginMode = loginMode;
    this.errorMessage = '';
  }

  onSubmit() {
    this.isLoading = true;
    this.errorMessage = '';
    
    if (this.isLoginMode) {
      // Simulate Login by fetching users and checking credentials
      this.userService.getUsers().subscribe({
        next: (users) => {
          this.isLoading = false;
          const foundUser = users.find(u => u.email === this.formData.email && u.password === this.formData.password);
          if (foundUser) {
            localStorage.setItem('loggedUser', JSON.stringify({ 
              displayName: `${foundUser.firstName} ${foundUser.lastName}`, 
              role: foundUser.role,
              email: foundUser.email,
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
      // Real Sign Up API Call
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
            displayName: `${createdUser.firstName} ${createdUser.lastName}`, 
            role: createdUser.role,
            email: createdUser.email,
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
