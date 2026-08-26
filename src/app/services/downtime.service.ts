import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Downtime {
  id?: number;
  organizationName: string;
  startTime: string; // datetime-local format or string
  endTime: string; // datetime-local format or string
  duration: number; // in minutes
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DowntimeService {
  private apiUrl = 'http://localhost:3000/downtime';

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const stored = localStorage.getItem('loggedUser');
    const role = stored ? JSON.parse(stored).role : 'soc';
    return new HttpHeaders({ 'x-role': role });
  }

  getDowntimes(): Observable<Downtime[]> {
    return this.http.get<Downtime[]>(this.apiUrl, { headers: this.getAuthHeaders() });
  }

  getDowntimeById(id: number): Observable<Downtime> {
    return this.http.get<Downtime>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }

  createDowntime(downtime: Downtime): Observable<Downtime> {
    return this.http.post<Downtime>(this.apiUrl, downtime, { headers: this.getAuthHeaders() });
  }

  updateDowntime(id: number, downtime: Partial<Downtime>): Observable<Downtime> {
    return this.http.patch<Downtime>(`${this.apiUrl}/${id}`, downtime, { headers: this.getAuthHeaders() });
  }

  deleteDowntime(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: this.getAuthHeaders() });
  }
}
