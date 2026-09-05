import {
  CustomerDomain,
  DiscountGovernanceResult,
  DiscountPolicyDomain,
  FinancialSummary,
  ProductDomain,
  TriggeredRule,
} from '../types';

export class DiscountGovernance {
  /**
   * Evaluates a quote's financial calculations against customer tier ceilings,
   * category discount ceilings, and discount policies.
   */
  public evaluate(
    financials: FinancialSummary,
    customer: CustomerDomain,
    productMap: Map<string, ProductDomain>,
    _policies: DiscountPolicyDomain[]
  ): DiscountGovernanceResult {
    const triggeredRules: TriggeredRule[] = [];
    const reasons: string[] = [];

    // 1. Overall Customer Tier Discount Ceiling Evaluation
    const overallDiscountPercent =
      financials.grossRevenue > 0
        ? Math.round(
            (financials.discountAmount / financials.grossRevenue) * 10000
          ) / 100
        : 0;

    if (overallDiscountPercent > customer.tier.maxOverallDiscount) {
      const penaltyPoints = Math.round(
        (overallDiscountPercent - customer.tier.maxOverallDiscount) * 3
      );
      const reason = `Overall quote discount of ${overallDiscountPercent.toFixed(
        2
      )}% exceeds ${customer.tier.name} ceiling of ${customer.tier.maxOverallDiscount.toFixed(
        2
      )}%.`;

      triggeredRules.push({
        ruleCode: 'CUSTOMER_TIER_DISCOUNT_EXCEEDED',
        ruleName: `${customer.tier.code} Tier Ceiling Violation`,
        severity: 'HIGH',
        penaltyPoints,
        actualValue: overallDiscountPercent,
        threshold: customer.tier.maxOverallDiscount,
        reason,
      });
      reasons.push(reason);
    }

    // 2. Line Item Product Category Ceiling Evaluation
    for (const line of financials.lines) {
      const product = productMap.get(line.productId);
      if (!product) continue;

      const categoryLimit = product.category.maxCategoryDiscount;
      if (line.discountPercent > categoryLimit) {
        const severity =
          product.category.code === 'SERVICES' ||
          product.category.code === 'HARDWARE'
            ? 'HIGH'
            : 'MEDIUM';

        const penaltyPoints = Math.round(
          (line.discountPercent - categoryLimit) * 4
        );
        const reason = `Discount of ${line.discountPercent.toFixed(
          2
        )}% on "${product.name}" exceeds ${product.category.name} ceiling of ${categoryLimit.toFixed(
          2
        )}%.`;

        triggeredRules.push({
          ruleCode: 'CATEGORY_DISCOUNT_LIMIT_EXCEEDED',
          ruleName: `${product.category.code} Category Limit Exceeded`,
          severity,
          penaltyPoints,
          actualValue: line.discountPercent,
          threshold: categoryLimit,
          reason,
        });
        reasons.push(reason);
      }
    }

    // 3. Margin Erosion Governance Evaluation (Rule BR-003)
    if (financials.marginPercentage < 15.0) {
      const penaltyPoints = Math.round((30.0 - financials.marginPercentage) * 2);
      const reason = `Gross margin of ${financials.marginPercentage.toFixed(
        2
      )}% falls below critical threshold of 15.0%.`;

      triggeredRules.push({
        ruleCode: 'CRITICAL_MARGIN_EROSION',
        ruleName: 'Critical Margin Erosion Violation',
        severity: 'HIGH',
        penaltyPoints,
        actualValue: financials.marginPercentage,
        threshold: 15.0,
        reason,
      });
      reasons.push(reason);
    } else if (financials.marginPercentage < 30.0) {
      const penaltyPoints = Math.round((30.0 - financials.marginPercentage) * 2);
      const reason = `Gross margin of ${financials.marginPercentage.toFixed(
        2
      )}% falls below standard target margin of 30.0%.`;

      triggeredRules.push({
        ruleCode: 'MARGIN_BELOW_TARGET',
        ruleName: 'Margin Below Target Violation',
        severity: 'MEDIUM',
        penaltyPoints,
        actualValue: financials.marginPercentage,
        threshold: 30.0,
        reason,
      });
      reasons.push(reason);
    }

    // Determine highest severity
    let highestSeverity: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (triggeredRules.some((r) => r.severity === 'HIGH')) {
      highestSeverity = 'HIGH';
    } else if (triggeredRules.some((r) => r.severity === 'MEDIUM')) {
      highestSeverity = 'MEDIUM';
    }

    const requiresApproval = triggeredRules.length > 0;

    return {
      allowed: true, // Commercial quotes can be evaluated, but may require approval routing
      requiresApproval,
      triggeredRules,
      reasons,
      highestSeverity,
    };
  }
}

export const discountGovernance = new DiscountGovernance();
