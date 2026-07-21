import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

/** Champs essentiels d'un ticket Jira */
export interface JiraTicketFields {
  summary: string;
  status: { name: string };
  priority: { name: string } | null;
  assignee: { displayName: string; emailAddress?: string } | null;
  reporter: { displayName: string } | null;
  created: string;
  updated: string;
}

/** Structure d'un ticket Jira */
export interface JiraTicket {
  id: string;
  key: string;
  self: string;
  fields: JiraTicketFields;
}

/** Réponse de l'endpoint /jira/tickets/team/:team */
export interface TeamTickets {
  /** Tickets On-Prem — visibles par SUPPORT et SOC */
  onPrem: JiraTicket[];
  /** Tickets SaaS — visibles uniquement par SOC */
  saas?: JiraTicket[];
}

@Injectable({ providedIn: 'root' })
export class JiraService {
  private readonly apiUrl = 'http://localhost:3000/jira';

  constructor(private http: HttpClient) {}

  /**
   * Récupère les tickets non fermés selon l'équipe :
   * - support → { onPrem: [...] }
   * - soc     → { onPrem: [...], saas: [...] }
   *
   * Extension future : ajouter des filtres (ex: date) comme paramètre
   * et les transmettre en query params sans modifier la signature existante.
   */
  getTicketsForTeam(team: 'soc' | 'support'): Observable<TeamTickets> {
    return this.http.get<TeamTickets>(
      `${this.apiUrl}/tickets/team/${team}`,
    );
  }

  /** Ajoute un commentaire sur un ticket */
  addComment(key: string, comment: string, author: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/tickets/${key}/comment`, { comment, author });
  }

  /** Effectue une transition de statut (ex: "In Progress") */
  transitionTicket(key: string, transitionName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/tickets/${key}/transition`, { transitionName });
  }

  /** Assigne le ticket à un utilisateur */
  assignTicket(key: string, assignee: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/tickets/${key}/assign`, { assignee });
  }

  /** Récupère et catégorise les tickets d'un technicien SOC spécifique sur une période donnée */
  getIncidentsPerSocTechnician(
    technician: string,
    startDate: string,
    endDate: string,
    maxResult: number
  ): Observable<any> {
    return this.http.post(`${this.apiUrl}/tickets/technician`, {
      technician,
      startDate,
      endDate,
      maxResult
    });
  }

  /** Récupère la liste des vrais membres du SOC Vermeg */
  getSocMembers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/soc-members`);
  }
}
