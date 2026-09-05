import { marginCalculator } from '../margin/marginCalculator';
import {
  CrossSellRuleDomain,
  FinancialSummary,
  ProductDomain,
  QuoteLineInput,
  RecommendationResult,
} from '../types';

export class RecommendationEngine {
  /**
   * Evaluates deterministic cross-sell recommendations for a quote.
   *
   * Threshold Requirement:
   * Projected margin % must satisfy CrossSellRule.minMarginPercent (configuration-driven).
   */
  public evaluateRecommendations(
    currentLines: QuoteLineInput[],
    _currentFinancials: FinancialSummary,
    crossSellRules: CrossSellRuleDomain[],
    productMap: Map<string, ProductDomain>
  ): RecommendationResult[] {
    const recommendations: RecommendationResult[] = [];
    const existingProductIds = new Set(currentLines.map((l) => l.productId));

    for (const rule of crossSellRules) {
      // 1. Check if trigger product is present in current lines
      if (!existingProductIds.has(rule.triggerProductId)) continue;

      // 2. Check if recommended product is NOT already present in current lines
      if (existingProductIds.has(rule.recommendedProductId)) continue;

      const recProduct = productMap.get(rule.recommendedProductId);
      if (!recProduct || !recProduct.isActive) continue;

      // 3. Simulate hypothetical quote lines with recommended product added at list price
      const hypotheticalLines: QuoteLineInput[] = [
        ...currentLines,
        {
          productId: recProduct.id,
          quantity: 1,
          discountPercent: 0,
        },
      ];

      try {
        const projectedFinancials = marginCalculator.calculateQuote(
          hypotheticalLines,
          productMap
        );

        // 4. Validate margin constraint: projectedMarginPercent >= rule.minMarginPercent
        if (projectedFinancials.marginPercentage >= rule.minMarginPercent) {
          recommendations.push({
            ruleId: rule.id,
            triggerProductId: rule.triggerProductId,
            recommendedProduct: recProduct,
            reason: rule.reasonTemplate,
            projectedNetRevenue: projectedFinancials.netRevenue,
            projectedMarginPercent: projectedFinancials.marginPercentage,
          });
        }
      } catch {
        // Skip recommendation if hypothetical calculation fails
        continue;
      }
    }

    return recommendations;
  }
}

export const recommendationEngine = new RecommendationEngine();
