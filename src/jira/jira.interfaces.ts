/**
 * Interfaces TypeScript pour les tickets Jira.
 * Typage strict — conforme au modèle de l'API Jira REST v3.
 */

/** Champs essentiels d'un ticket Jira retournés par l'API */
export interface JiraTicketFields {
  summary: string;
  status: { name: string };
  priority: { name: string } | null;
  assignee: { displayName: string; emailAddress?: string } | null;
  reporter: { displayName: string } | null;
  created: string;
  updated: string;
  /** Permet d'ajouter facilement d'autres champs sans casser le typage */
  [key: string]: unknown;
}

/** Structure d'un ticket Jira tel que renvoyé par l'API */
export interface JiraTicket {
  id: string;
  key: string;
  self: string;
  fields: JiraTicketFields;
}

/** Résultat paginé d'une recherche Jira (JQL) */
export interface JiraSearchResult {
  total: number;
  startAt: number;
  maxResults: number;
  issues: JiraTicket[];
}

/** DTO retourné par l'endpoint GET /jira/tickets/team/:team */
export interface TeamTicketsDto {
  /** Tickets On-Prem non fermés — disponibles pour SUPPORT et SOC */
  onPrem: JiraTicket[];
  /** Tickets SaaS non fermés — disponibles uniquement pour l'équipe SOC */
  saas?: JiraTicket[];
}
