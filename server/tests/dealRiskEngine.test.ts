import { describe, expect, it } from 'vitest';
import { dealRiskEngine } from '../src/domain/risk/dealRiskEngine';
import { DiscountGovernanceResult } from '../src/domain/types';

describe('DealRiskEngine Unit Tests', () => {
  it('1. calculates LOW risk score (0) for fully compliant deal', () => {
    const compliantGov: DiscountGovernanceResult = {
      allowed: true,
      requiresApproval: false,
      triggeredRules: [],
      reasons: [],
      highestSeverity: 'LOW',
    };

    const risk = dealRiskEngine.evaluateRisk(compliantGov);

    expect(risk.riskScore).toBe(0);
    expect(risk.riskLevel).toBe('LOW');
    expect(risk.requiresApproval).toBe(false);
    expect(risk.requiredApprovalRole).toBeNull();
  });

  it('2. calculates MEDIUM risk score for tier penalty', () => {
    const tierGov: DiscountGovernanceResult = {
      allowed: true,
      requiresApproval: true,
      triggeredRules: [
        {
          ruleCode: 'CUSTOMER_TIER_DISCOUNT_EXCEEDED',
          ruleName: 'Tier Ceiling Violation',
          severity: 'MEDIUM',
          penaltyPoints: 35, // Tier penalty
          actualValue: 26.67,
          threshold: 15.0,
          reason: 'Discount of 26.67% exceeds tier ceiling of 15.0%.',
        },
      ],
      reasons: ['Discount of 26.67% exceeds tier ceiling of 15.0%.'],
      highestSeverity: 'MEDIUM',
    };

    const risk = dealRiskEngine.evaluateRisk(tierGov);

    expect(risk.riskScore).toBe(35);
    expect(risk.riskLevel).toBe('MEDIUM');
    expect(risk.requiresApproval).toBe(true);
    expect(risk.requiredApprovalRole).toBe('SALES_MANAGER');
  });

  it('3. applies stacking penalty (+15) when multiple distinct policy rules trigger', () => {
    const multiGov: DiscountGovernanceResult = {
      allowed: true,
      requiresApproval: true,
      triggeredRules: [
        {
          ruleCode: 'CUSTOMER_TIER_DISCOUNT_EXCEEDED',
          ruleName: 'Tier Violation',
          severity: 'HIGH',
          penaltyPoints: 24,
          actualValue: 23,
          threshold: 15,
          reason: 'Tier discount exceeded',
        },
        {
          ruleCode: 'CATEGORY_DISCOUNT_LIMIT_EXCEEDED',
          ruleName: 'Category Violation',
          severity: 'HIGH',
          penaltyPoints: 20,
          actualValue: 15,
          threshold: 10,
          reason: 'Category discount exceeded',
        },
      ],
      reasons: ['Tier discount exceeded', 'Category discount exceeded'],
      highestSeverity: 'HIGH',
    };

    const risk = dealRiskEngine.evaluateRisk(multiGov);

    // 24 + 20 + 15 (stacking) = 59 score -> HIGH because severity is HIGH
    expect(risk.riskScore).toBe(59);
    expect(risk.riskLevel).toBe('HIGH');
    expect(risk.requiresApproval).toBe(true);
    expect(risk.triggeredRules.some((r) => r.ruleCode === 'STACKED_COMMERCIAL_RISK')).toBe(true);
  });

  it('4. caps risk score at 100', () => {
    const extremeGov: DiscountGovernanceResult = {
      allowed: true,
      requiresApproval: true,
      triggeredRules: [
        {
          ruleCode: 'CUSTOMER_TIER_DISCOUNT_EXCEEDED',
          ruleName: 'Extreme Tier Violation',
          severity: 'HIGH',
          penaltyPoints: 90,
          actualValue: 45,
          threshold: 15,
          reason: 'Extreme tier discount',
        },
        {
          ruleCode: 'CRITICAL_MARGIN_EROSION',
          ruleName: 'Critical Erosion',
          severity: 'HIGH',
          penaltyPoints: 50,
          actualValue: -10,
          threshold: 15,
          reason: 'Critical margin erosion',
        },
      ],
      reasons: ['Extreme tier discount', 'Critical margin erosion'],
      highestSeverity: 'HIGH',
    };

    const risk = dealRiskEngine.evaluateRisk(extremeGov);

    expect(risk.riskScore).toBe(100);
    expect(risk.riskLevel).toBe('HIGH');
    expect(risk.requiredApprovalRole).toBe('FINANCE_APPROVER');
  });
});
