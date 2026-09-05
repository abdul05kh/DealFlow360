import { describe, expect, it } from 'vitest';
import { marginRealizationEngine } from '../src/domain/margin/marginRealizationEngine';
import { CustomerTierDomain, FinancialSummary } from '../src/domain/types';

describe('MarginRealizationEngine Pure Domain Unit Tests', () => {
  const goldTier: CustomerTierDomain = {
    id: 'tier_gold',
    code: 'GOLD',
    name: 'Gold Tier Customer',
    maxOverallDiscount: 15.0,
    minMarginThreshold: 30.0,
    isActive: true,
  };

  const sampleFinancials: FinancialSummary = {
    lines: [
      {
        productId: 'prod_1',
        quantity: 1,
        unitPrice: 100000,
        unitCost: 60000,
        discountPercent: 0,
        lineGross: 100000,
        discountAmount: 0,
        netTotal: 100000,
        lineCost: 60000,
        lineMargin: 40000,
        lineMarginPercent: 40.0,
      },
    ],
    grossRevenue: 100000,
    discountAmount: 0,
    netRevenue: 100000,
    estimatedCost: 60000,
    grossMargin: 40000,
    marginPercentage: 40.0,
  };

  // 1. Basic calculation for Qty 1, 0% discount
  it('1. Computes deterministic MRI for Qty 1 at 0% discount', () => {
    const result = marginRealizationEngine.calculateMRI(sampleFinancials, 1, goldTier);

    expect(result.netRevenue).toBe(100000);
    expect(result.estimatedCost).toBe(60000);
    expect(result.realizedMarginPercent).toBe(40.0);
    expect(result.baseTargetMarginPercent).toBe(30.0);
    expect(result.volumeFactorPercent).toBe(0.0); // log2(1) = 0
    expect(result.requiredTargetMarginPercent).toBe(30.0);
    // MRI = 40.0 / 30.0 * 100 = 133.33%
    expect(result.marginRealizationPercent).toBe(133.33);
  });

  // 2. Volume factor scaling for Qty 10
  it('2. Scales volume factor and lowers required target margin for Qty 10', () => {
    const result = marginRealizationEngine.calculateMRI(sampleFinancials, 10, goldTier);

    // log2(10) ≈ 3.3219 -> VF = min(0.15, 0.03 * 3.3219) = 0.0997 (9.97%)
    expect(result.volumeFactorPercent).toBe(9.97);
    // Required Target = 30.0 * (1 - 0.099657) ≈ 27.01%
    expect(result.requiredTargetMarginPercent).toBe(27.01);
    // MRI = 40.0 / 27.01 * 100 ≈ 148.09%
    expect(result.marginRealizationPercent).toBe(148.09);
  });

  // 3. Discount impact on realized margin and MRI
  it('3. Discount reduces realized margin and lowers MRI', () => {
    const discountedFinancials: FinancialSummary = {
      ...sampleFinancials,
      discountAmount: 10000,
      netRevenue: 90000,
      grossMargin: 30000,
      marginPercentage: 33.33,
    };

    const result = marginRealizationEngine.calculateMRI(discountedFinancials, 1, goldTier);

    expect(result.realizedMarginPercent).toBe(33.33);
    expect(result.requiredTargetMarginPercent).toBe(30.0);
    // MRI = 33.33 / 30.0 * 100 = 111.1%
    expect(result.marginRealizationPercent).toBe(111.1);
  });

  // 4. Edge case: Zero net revenue
  it('4. Zero net revenue returns 0.0% MRI without NaN or Infinity', () => {
    const zeroFinancials: FinancialSummary = {
      lines: [],
      grossRevenue: 0,
      discountAmount: 0,
      netRevenue: 0,
      estimatedCost: 0,
      grossMargin: 0,
      marginPercentage: 0,
    };

    const result = marginRealizationEngine.calculateMRI(zeroFinancials, 1, goldTier);

    expect(result.marginRealizationPercent).toBe(0.0);
    expect(Number.isNaN(result.marginRealizationPercent)).toBe(false);
  });

  // 5. Edge case: Negative margin (cost > revenue)
  it('5. Negative margin (cost > revenue) returns negative realized margin and negative MRI safely', () => {
    const negativeFinancials: FinancialSummary = {
      lines: [],
      grossRevenue: 50000,
      discountAmount: 0,
      netRevenue: 50000,
      estimatedCost: 60000,
      grossMargin: -10000,
      marginPercentage: -20.0,
    };

    const result = marginRealizationEngine.calculateMRI(negativeFinancials, 1, goldTier);

    expect(result.realizedMarginPercent).toBe(-20.0);
    expect(result.requiredTargetMarginPercent).toBe(30.0);
    // MRI = -20.0 / 30.0 * 100 = -66.67%
    expect(result.marginRealizationPercent).toBe(-66.67);
  });

  // 6. Large quantity clamping at 15% maximum VF
  it('6. Clamps volume factor at 15.0% for extremely large quantities', () => {
    const result = marginRealizationEngine.calculateMRI(sampleFinancials, 10000, goldTier);

    expect(result.volumeFactorPercent).toBe(15.0);
    // Required Target = 30.0 * (1 - 0.15) = 25.5%
    expect(result.requiredTargetMarginPercent).toBe(25.5);
  });

  // 7. Minimum required target floor at 15.0%
  it('7. Enforces 15.0% floor on required target margin even with low base tier target', () => {
    const lowTargetTier: CustomerTierDomain = {
      ...goldTier,
      minMarginThreshold: 16.0,
    };

    const result = marginRealizationEngine.calculateMRI(sampleFinancials, 1000, lowTargetTier);

    // 16.0 * (1 - 0.15) = 13.6% < 15.0% floor -> clamped at 15.0%
    expect(result.requiredTargetMarginPercent).toBe(15.0);
  });
});
