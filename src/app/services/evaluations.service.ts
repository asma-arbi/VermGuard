import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EvaluationItem {
  id?: number;
  userId: number;
  evaluatorId?: number;
  period: string; // Format "YYYY-MM"
  support1erNiveauScore: number;
  monitoringDetectionScore: number;
  qualiteTicketsScore: number;
  onboardingOnPremScore: number;
  onboardingSaaSScore: number;
  securiteScore: number;
  checklistScore: number;
  globalScore?: number;
  comments?: string;
  isPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export interface TeamMemberEvaluation {
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  evaluation: EvaluationItem | null;
}

@Injectable({
  providedIn: 'root',
})
export class EvaluationsService {
  private apiUrl = 'http://localhost:3000/evaluations';

  constructor(private http: HttpClient) {}

  /**
   * helper pour injecter les headers de rôle et d'utilisateur
   */
  private getHeaders(role: string = 'manager', userId?: number): HttpHeaders {
    let headers = new HttpHeaders({
      'x-role': role,
    });
    if (userId) {
      headers = headers.set('x-user-id', userId.toString());
    }
    return headers;
  }

  /**
   * Créer ou mettre à jour l'évaluation d'un membre SOC (Manager uniquement)
   */
  saveEvaluation(dto: Partial<EvaluationItem>, role: string = 'manager', loggedUserId?: number): Observable<EvaluationItem> {
    return this.http.post<EvaluationItem>(this.apiUrl, dto, {
      headers: this.getHeaders(role, loggedUserId),
    });
  }

  /**
   * Récupérer toutes les évaluations d'un mois pour tous les membres SOC (Manager uniquement)
   */
  getTeamEvaluations(period: string, role: string = 'manager'): Observable<TeamMemberEvaluation[]> {
    return this.http.get<TeamMemberEvaluation[]>(`${this.apiUrl}/team/${period}`, {
      headers: this.getHeaders(role),
    });
  }

  /**
   * Récupérer les évaluations de l'utilisateur connecté (Lecture seule - SOC ou Manager)
   */
  getMyEvaluations(userId: number, role: string = 'soc'): Observable<EvaluationItem[]> {
    return this.http.get<EvaluationItem[]>(`${this.apiUrl}/my`, {
      headers: this.getHeaders(role, userId),
    });
  }

  /**
   * Supprimer une évaluation (Manager uniquement)
   */
  deleteEvaluation(id: number, role: string = 'manager'): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, {
      headers: this.getHeaders(role),
    });
  }
}
