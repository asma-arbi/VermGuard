/**
 * Constantes JQL pour les requêtes Jira VermGuard.
 * Reprises exactement depuis le code de l'équipe SOC.
 * Centralisées ici pour éviter toute duplication dans les services.
 */

/**
 * JQL — Incidents et tickets de monitoring SOC non fermés (On-Prem).
 *
 * Cible :
 *  - Projet "Global Internal Support" (tickets On-Prem avec champ cf[12690] renseigné OU cf[12910] != SaaS)
 *  - OU projets DevOps internes (Build & DevOps, Colline DevOps, Expertise Intervention Project)
 *
 * Filtres :
 *  - Créé par les membres de l'équipe SOC (comptes Jira SOC Vermeg)
 *  - Créé depuis le 2024-06-01
 *  - Statut NON terminé (Closed, Resolved, Rejected, Canceled, Implementing)
 *  - Types : SOC Monitoring, Incident, Problem Report
 *  - Champ "Outage End" non renseigné (incident toujours ouvert)
 *
 * Utilisé par : équipe SOC (vue On-Prem) et équipe SUPPORT.
 */
export const SOC_NOT_CLOSED_JQL = `
  (
    (
      project = "Global Internal Support"
      AND (cf[12690] IS NOT EMPTY OR cf[12910] != SaaS)
    )
    OR project IN ("Build & DevOps", "Colline DevOps", "Expertise Intervention Project")
  )
  AND creator IN (
    it_soc, sbenaissia, hghiloufi, anamouchi, zhammami,
    khksibi, ojebali, mselmani, sfradj, ybenamara, socuser, wsaadli
  )
  AND created >= 2024-06-01
  AND status NOT IN (Closed, Resolved, Rejected, Canceled, Implementing)
  AND issuetype IN ("SOC Monitoring", "Incident", "Problem Report")
  AND "Outage End" = null
  ORDER BY created DESC
`.trim();

/**
 * JQL — Open Incidents SaaS (projet GIS).
 *
 * Cible :
 *  - Projet GIS (Global Internal Support), filtre SaaS (cf[12910] = SaaS)
 *
 * Filtres :
 *  - Reporter appartenant à l'équipe SOC Vermeg
 *  - Créateur = socuser
 *  - Statut NON terminé (Closed, Resolved, Rejected, Canceled, Implementing, Verified)
 *
 * Utilisé par : équipe SOC uniquement (vue SaaS).
 */
export const GIS_SAAS_NOT_CLOSED_JQL = `
  project = GIS
  AND reporter IN (
    mkouissi, it_soc, sbenaissia, hghiloufi, anamouchi,
    nabbes, zhammami, khksibi, ojebali, mselmani,
    onssibi, ybenamara, socuser, wsaadli
  )
  AND cf[12910] = SaaS
  AND status NOT IN (Closed, Resolved, Rejected, Canceled, Implementing, Verified)
  AND creator = socuser
  ORDER BY created DESC
`.trim();
