import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id?: number;
  firstName: string;
  lastName: string;
  password?: string;
  email: string;
  role: 'manager' | 'soc' | 'support';
  openTicketsCount: number;
  canAddUser?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:3000/users';

  constructor(private http: HttpClient) {}

  // Build headers with the current user's role from localStorage
  private getAuthHeaders(): HttpHeaders {
    const stored = localStorage.getItem('loggedUser');
    const role = stored ? JSON.parse(stored).role : 'manager';
    return new HttpHeaders({ 'x-role': role });
  }

  // POST /users — Public (no header needed for sign up)
  createUser(user: User): Observable<User> {
    return this.http.post<User>(this.apiUrl, user);
  }

  // GET /users — Requires x-role header
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl, { headers: this.getAuthHeaders() });
  }

  // GET /users/role/:role — Requires x-role header
  getUsersByRole(role: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/role/${role}`, { headers: this.getAuthHeaders() });
  }

  // PATCH /users/:id — Manager only
  updateUser(id: number, user: Partial<User>): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}`, user, { headers: this.getAuthHeaders() });
  }

  // DELETE /users/:id — Manager only
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }
}
