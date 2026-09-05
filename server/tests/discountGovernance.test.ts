import { describe, expect, it } from 'vitest';
import { discountGovernance } from '../src/domain/governance/discountGovernance';
import { CustomerDomain, FinancialSummary, ProductDomain } from '../src/domain/types';

describe('DiscountGovernance Unit Tests', () => {
  const goldCustomer: CustomerDomain = {
    id: 'cust_gold',
    name: 'Acme Industries',
    tierId: 'tier_gold',
    tier: {
      id: 'tier_gold',
      code: 'GOLD',
      name: 'Gold Tier Customer',
      maxOverallDiscount: 15.0,
      minMarginThreshold: 30.0,
      isActive: true,
    },
    currency: 'INR',
    status: 'ACTIVE',
  };

  const productMap = new Map<string, ProductDomain>([
    [
      'prod_service_01',
      {
        id: 'prod_service_01',
        sku: 'SV-IMP-001',
        name: 'Implementation Services',
        categoryId: 'cat_services',
        category: {
          id: 'cat_services',
          code: 'SERVICES',
          name: 'Services & Consulting',
          maxCategoryDiscount: 10.0,
        },
        sellingPrice: 50000.0,
        costPrice: 30000.0,
        isActive: true,
      },
    ],
  ]);

  it('1. permits quotes compliant with all customer tier and category ceilings', () => {
    const compliantFinancials: FinancialSummary = {
      lines: [
        {
          productId: 'prod_service_01',
          quantity: 1,
          unitPrice: 50000,
          unitCost: 30000,
          discountPercent: 8.0, // <= 10.0% category limit & <= 15.0% tier limit
          lineGross: 50000,
          discountAmount: 4000,
          netTotal: 46000,
          lineCost: 30000,
          lineMargin: 16000,
          lineMarginPercent: 34.78, // >= 30% margin
        },
      ],
      grossRevenue: 50000,
      discountAmount: 4000,
      netRevenue: 46000,
      estimatedCost: 30000,
      grossMargin: 16000,
      marginPercentage: 34.78,
    };

    const result = discountGovernance.evaluate(
      compliantFinancials,
      goldCustomer,
      productMap,
      []
    );

    expect(result.requiresApproval).toBe(false);
    expect(result.triggeredRules.length).toBe(0);
    expect(result.highestSeverity).toBe('LOW');
  });

  it('2. triggers CUSTOMER_TIER_DISCOUNT_EXCEEDED when overall discount exceeds tier ceiling', () => {
    const tierExceededFinancials: FinancialSummary = {
      lines: [
        {
          productId: 'prod_service_01',
          quantity: 1,
          unitPrice: 50000,
          unitCost: 20000,
          discountPercent: 18.0, // > 15.0% tier limit
          lineGross: 50000,
          discountAmount: 9000,
          netTotal: 41000,
          lineCost: 20000,
          lineMargin: 21000,
          lineMarginPercent: 51.22,
        },
      ],
      grossRevenue: 50000,
      discountAmount: 9000,
      netRevenue: 41000,
      estimatedCost: 20000,
      grossMargin: 21000,
      marginPercentage: 51.22,
    };

    const result = discountGovernance.evaluate(
      tierExceededFinancials,
      goldCustomer,
      productMap,
      []
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.highestSeverity).toBe('HIGH');
    expect(result.triggeredRules.some((r) => r.ruleCode === 'CUSTOMER_TIER_DISCOUNT_EXCEEDED')).toBe(true);
  });

  it('3. triggers CATEGORY_DISCOUNT_LIMIT_EXCEEDED when line discount exceeds category ceiling', () => {
    const categoryExceededFinancials: FinancialSummary = {
      lines: [
        {
          productId: 'prod_service_01',
          quantity: 1,
          unitPrice: 50000,
          unitCost: 20000,
          discountPercent: 12.0, // > 10.0% Services category limit, but overall 12% <= 15% tier limit
          lineGross: 50000,
          discountAmount: 6000,
          netTotal: 44000,
          lineCost: 20000,
          lineMargin: 24000,
          lineMarginPercent: 54.55,
        },
      ],
      grossRevenue: 50000,
      discountAmount: 6000,
      netRevenue: 44000,
      estimatedCost: 20000,
      grossMargin: 24000,
      marginPercentage: 54.55,
    };

    const result = discountGovernance.evaluate(
      categoryExceededFinancials,
      goldCustomer,
      productMap,
      []
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.triggeredRules.some((r) => r.ruleCode === 'CATEGORY_DISCOUNT_LIMIT_EXCEEDED')).toBe(true);
  });

  it('4. flags CRITICAL_MARGIN_EROSION when margin drops below 15%', () => {
    const criticalMarginFinancials: FinancialSummary = {
      lines: [
        {
          productId: 'prod_service_01',
          quantity: 1,
          unitPrice: 50000,
          unitCost: 45000,
          discountPercent: 5.0,
          lineGross: 50000,
          discountAmount: 2500,
          netTotal: 47500,
          lineCost: 45000,
          lineMargin: 2500,
          lineMarginPercent: 5.26, // < 15.0%
        },
      ],
      grossRevenue: 50000,
      discountAmount: 2500,
      netRevenue: 47500,
      estimatedCost: 45000,
      grossMargin: 2500,
      marginPercentage: 5.26,
    };

    const result = discountGovernance.evaluate(
      criticalMarginFinancials,
      goldCustomer,
      productMap,
      []
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.highestSeverity).toBe('HIGH');
    expect(result.triggeredRules.some((r) => r.ruleCode === 'CRITICAL_MARGIN_EROSION')).toBe(true);
  });
});
