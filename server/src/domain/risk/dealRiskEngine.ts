import { DiscountGovernanceResult, RiskEvaluationResult } from '../types';

export class DealRiskEngine {
  /**
   * Evaluates deal risk deterministically based on discount governance results.
   *
   * Formula:
   * RiskScore = min(100, BaseRisk + TierPenalty + CategoryPenalty + MarginPenalty + StackingPenalty)
   */
  public evaluateRisk(
    governanceResult: DiscountGovernanceResult
  ): RiskEvaluationResult {
    let rawScore = 0;
    const triggeredRules = [...governanceResult.triggeredRules];

    for (const rule of triggeredRules) {
      rawScore += rule.penaltyPoints;
    }

    // Stacking penalty if multiple policy rules are violated simultaneously
    const uniqueRuleCodes = new Set(triggeredRules.map((r) => r.ruleCode));
    if (uniqueRuleCodes.size > 1) {
      const stackingPenalty = 15;
      rawScore += stackingPenalty;
      triggeredRules.push({
        ruleCode: 'STACKED_COMMERCIAL_RISK',
        ruleName: 'Stacked Commercial Policy Violations',
        severity: 'HIGH',
        penaltyPoints: stackingPenalty,
        actualValue: uniqueRuleCodes.size,
        threshold: 1,
        reason: `Multiple policy violations (${uniqueRuleCodes.size}) triggered simultaneously.`,
      });
    }

    const riskScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (riskScore >= 60 || triggeredRules.some((r) => r.severity === 'HIGH')) {
      riskLevel = 'HIGH';
    } else if (riskScore >= 30 || triggeredRules.some((r) => r.severity === 'MEDIUM')) {
      riskLevel = 'MEDIUM';
    }

    const requiresApproval =
      riskLevel !== 'LOW' || governanceResult.requiresApproval;

    let requiredApprovalRole: 'SALES_MANAGER' | 'FINANCE_APPROVER' | null = null;
    if (triggeredRules.some((r) => r.ruleCode === 'CRITICAL_MARGIN_EROSION')) {
      requiredApprovalRole = 'FINANCE_APPROVER';
    } else if (requiresApproval) {
      requiredApprovalRole = 'SALES_MANAGER';
    }

    const reasons = triggeredRules.map((r) => r.reason);

    return {
      riskScore,
      riskLevel,
      triggeredRules,
      reasons,
      requiresApproval,
      requiredApprovalRole,
    };
  }
}

export const dealRiskEngine = new DealRiskEngine();
