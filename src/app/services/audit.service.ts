import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AuditLog {
  id: string;
  action: string;
  performedBy: string;
  details: string;
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuditService {
  private apiUrl = 'http://localhost:3000/audit';

  constructor(private http: HttpClient) {}

  /**
   * Enregistre une nouvelle action dans l'historique
   */
  logAction(action: string, performedBy: string, details: string): Observable<AuditLog> {
    return this.http.post<AuditLog>(`${this.apiUrl}/log`, { action, performedBy, details });
  }

  /**
   * Récupère la liste de tous les logs (pour le Manager)
   */
  getLogs(): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(this.apiUrl);
  }
}
