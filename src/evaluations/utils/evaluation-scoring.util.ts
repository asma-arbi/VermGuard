/**
 * Utilitaire officiel de calcul des scores d'évaluation pour l'équipe SOC Vermeg.
 * Basé sur la grille officielle des objectifs et des barèmes SLA Vermeg.
 */

export interface EvaluationScoresInput {
  support1erNiveauScore: number;
  monitoringDetectionScore: number;
  qualiteTicketsScore: number;
  onboardingOnPremScore: number;
  onboardingSaaSScore: number;
  securiteScore: number;
  checklistScore: number;
}

/**
 * Barème officiel Vermeg pour "Qualité des tickets":
 * Formule : (1 - Bad Tickets / Total) * 100
 * - (5) > 98%
 * - (4) 96% - 97%
 * - (3) 86% - 95%
 * - (2) 76% - 85%
 * - (1) < 75%
 */
export function calculateQualiteTicketsScore(
  manualScore: number,
  badTickets?: number,
  totalTickets?: number,
): number {
  if (badTickets !== undefined && totalTickets !== undefined && totalTickets > 0) {
    const qualityPct = (1 - badTickets / totalTickets) * 100;
    if (qualityPct > 98) return 5;
    if (qualityPct >= 96) return 4;
    if (qualityPct >= 86) return 3;
    if (qualityPct >= 76) return 2;
    return 1;
  }
  return manualScore;
}

/**
 * Barème officiel Vermeg pour "Monitoring - Detection & Incident Management":
 * Délai de détection et qualification des incidents :
 * - (5) < 5 mn
 * - (4) 6 - 10 mn
 * - (3) 11 - 20 mn
 * - (2) 21 - 30 mn
 * - (1) > 30 mn
 */
export function calculateMonitoringDetectionScore(
  manualScore: number,
  avgDetectionTimeMinutes?: number,
): number {
  if (avgDetectionTimeMinutes !== undefined) {
    if (avgDetectionTimeMinutes < 5) return 5;
    if (avgDetectionTimeMinutes <= 10) return 4;
    if (avgDetectionTimeMinutes <= 20) return 3;
    if (avgDetectionTimeMinutes <= 30) return 2;
    return 1;
  }
  return manualScore;
}

/**
 * Barème officiel Vermeg pour "Traitement des tickets Checklist":
 * Taux de traitement des checklists dans les SLA :
 * - (5) 100%
 * - (4) 98% - 99%
 * - (3) 95% - 97%
 * - (2) 90% - 94%
 * - (1) < 89%
 */
export function calculateChecklistScore(
  manualScore: number,
  slaPercentage?: number,
): number {
  if (slaPercentage !== undefined) {
    if (slaPercentage >= 100) return 5;
    if (slaPercentage >= 98) return 4;
    if (slaPercentage >= 95) return 3;
    if (slaPercentage >= 90) return 2;
    return 1;
  }
  return manualScore;
}

/**
 * Calcule le score global comme la moyenne des 7 critères d'évaluation, arrondie à 2 décimales.
 */
export function calculateGlobalScore(scores: EvaluationScoresInput): number {
  const sum =
    scores.support1erNiveauScore +
    scores.monitoringDetectionScore +
    scores.qualiteTicketsScore +
    scores.onboardingOnPremScore +
    scores.onboardingSaaSScore +
    scores.securiteScore +
    scores.checklistScore;

  const average = sum / 7;
  return Math.round(average * 100) / 100;
}
