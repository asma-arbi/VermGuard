import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { AuthComponent } from './components/auth/auth';

export const routes: Routes = [
  { path: '', redirectTo: '/auth', pathMatch: 'full' },
  { path: 'auth', component: AuthComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: '**', redirectTo: '/auth' }
];
