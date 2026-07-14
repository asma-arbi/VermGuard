/**
 * Constantes JQL pour les requêtes Jira VermGuard.
 * Centralisées ici pour éviter toute duplication dans les services.
 * Pour ajouter un filtre (ex: date), modifier uniquement ici.
 */

/**
 * JQL — Tickets non fermés de l'équipe SOC / On-Prem (projet SO).
 * Utilisé par : équipe SUPPORT (uniquement) et équipe SOC (partie On-Prem).
 */
export const SOC_NOT_CLOSED_JQL = `
  project = "SO"
  AND status NOT IN ("Closed", "Resolved", "Done")
  ORDER BY created DESC
`.trim();

/**
 * JQL — Tickets non fermés de la catégorie SaaS, projet SAASINSUR.
 * Utilisé par : équipe SOC uniquement (vue complète).
 */
export const GIS_SAAS_NOT_CLOSED_JQL = `
  project = "SAASINSUR"
  AND status NOT IN ("Closed", "Resolved", "Done")
  ORDER BY created DESC
`.trim();
