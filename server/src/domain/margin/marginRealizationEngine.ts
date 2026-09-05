import { CustomerTierDomain, FinancialSummary, MarginRealizationResult } from '../types';

export class MarginRealizationEngine {
  /**
   * Calculates server-authoritative Margin Realization Index (MRI) and associated metrics.
   *
   * @param financials Authoritative financial summary calculated via integer minor units.
   * @param totalQuantity Total units requested across all quote lines.
   * @param tier Authoritative customer tier domain model containing persisted minMarginThreshold.
   */
  public calculateMRI(
    financials: FinancialSummary,
    totalQuantity: number,
    tier: CustomerTierDomain
  ): MarginRealizationResult {
    const netRevenue = financials.netRevenue;
    const estimatedCost = financials.estimatedCost;
    const realizedMarginPercent = financials.marginPercentage;

    const baseTargetMarginPercent = tier.minMarginThreshold;

    // Volume Factor VF = min(0.15, 0.03 * log2(totalQuantity))
    const validQty = Math.max(1, totalQuantity);
    const volumeFactorDecimal = Math.min(0.15, 0.03 * Math.log2(validQty));
    const volumeFactorPercent = Math.round(volumeFactorDecimal * 10000) / 100;

    // Required Target = max(15.0%, baseTarget * (1 - volumeFactorDecimal))
    const calculatedTarget = baseTargetMarginPercent * (1 - volumeFactorDecimal);
    const requiredTargetMarginPercent = Math.round(Math.max(15.0, calculatedTarget) * 100) / 100;

    // Margin Realization Index = (realizedMarginPercent / requiredTargetMarginPercent) * 100
    // Edge case: if netRevenue <= 0 or requiredTarget <= 0, MRI is 0.0
    let marginRealizationPercent = 0.0;
    if (netRevenue > 0 && requiredTargetMarginPercent > 0) {
      marginRealizationPercent =
        Math.round((realizedMarginPercent / requiredTargetMarginPercent) * 10000) / 100;
    }

    return {
      netRevenue,
      estimatedCost,
      realizedMarginPercent,
      baseTargetMarginPercent,
      volumeFactorPercent,
      requiredTargetMarginPercent,
      marginRealizationPercent,
    };
  }
}

export const marginRealizationEngine = new MarginRealizationEngine();
