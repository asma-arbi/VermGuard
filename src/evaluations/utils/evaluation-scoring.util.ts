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
 * Calcule le score global en prenant en compte les critères activés et les critères personnalisés.
 */
export function calculateGlobalScore(
  scores: EvaluationScoresInput,
  enabledCriteria?: Record<string, boolean>,
  customCriteria?: Array<{ id: string; name: string; score: number; enabled: boolean }>,
): number {
  let totalScore = 0;
  let count = 0;

  const criteriaMap: Record<string, number> = {
    support1erNiveau: scores.support1erNiveauScore,
    monitoringDetection: scores.monitoringDetectionScore,
    qualiteTickets: scores.qualiteTicketsScore,
    onboardingOnPrem: scores.onboardingOnPremScore,
    onboardingSaaS: scores.onboardingSaaSScore,
    securite: scores.securiteScore,
    checklist: scores.checklistScore,
  };

  for (const [key, val] of Object.entries(criteriaMap)) {
    if (!enabledCriteria || enabledCriteria[key] !== false) {
      totalScore += (val || 0);
      count++;
    }
  }

  if (customCriteria && Array.isArray(customCriteria)) {
    customCriteria.forEach(c => {
      if (c && c.enabled !== false) {
        totalScore += (c.score || 0);
        count++;
      }
    });
  }

  if (count === 0) return 0;
  return Math.round((totalScore / count) * 100) / 100;
}
