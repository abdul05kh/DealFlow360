import { describe, expect, it } from 'vitest';
import { dealRiskEngine } from '../src/domain/risk/dealRiskEngine';
import { discountGovernance } from '../src/domain/governance/discountGovernance';
import { marginCalculator } from '../src/domain/margin/marginCalculator';
import { CustomerDomain, ProductDomain, QuoteLineInput } from '../src/domain/types';

describe('Security & Anti-Tampering Domain Tests', () => {
  const masterCustomer: CustomerDomain = {
    id: 'cust_acme_101',
    name: 'Acme Industries',
    tierId: 'tier_gold',
    tier: {
      id: 'tier_gold',
      code: 'GOLD',
      name: 'Gold Tier Customer',
      maxOverallDiscount: 15.0, // Authoritative Gold Tier Limit
      minMarginThreshold: 30.0,
    },
    currency: 'INR',
    status: 'ACTIVE',
  };

  const masterProductMap = new Map<string, ProductDomain>([
    [
      'prod_server_01',
      {
        id: 'prod_server_01',
        sku: 'HW-SRV-001',
        name: 'Enterprise Server',
        categoryId: 'cat_hardware',
        category: {
          id: 'cat_hardware',
          code: 'HARDWARE',
          name: 'Hardware Products',
          maxCategoryDiscount: 15.0, // Authoritative Category Limit
        },
        sellingPrice: 150000.0, // Authoritative Selling Price
        costPrice: 90000.0,    // Authoritative Cost Price
        isActive: true,
      },
    ],
  ]);

  it('1. ignores client-supplied fake cost price and enforces authoritative unit cost', () => {
    // Malicious payload attempts to supply unitCost = 1.0 (fake cost to boost fake margin)
    const clientPayload: QuoteLineInput & { fakeCostPrice?: number } = {
      productId: 'prod_server_01',
      quantity: 1,
      discountPercent: 10,
      fakeCostPrice: 1.0,
    };

    // Server retrieves authoritative master data and ignores fakeCostPrice
    const financials = marginCalculator.calculateQuote(
      [clientPayload],
      masterProductMap
    );

    // Verified: Server used authoritative costPrice (90,000), NOT fake cost (1.0)
    expect(financials.estimatedCost).toBe(90000);
    expect(financials.grossMargin).toBe(45000);
    expect(financials.marginPercentage).toBe(33.33);
  });

  it('2. overrides client-supplied fake risk level and approval status with authoritative governance evaluation', () => {
    // Malicious request payload claiming LOW risk and AUTO_APPROVED status for an 18% discount (violating 15% tier ceiling)
    const maliciousPayload = {
      customerId: 'cust_acme_101',
      items: [{ productId: 'prod_server_01', quantity: 1, discountPercent: 25 }],
      fakeRiskLevel: 'LOW',
      fakeApprovalStatus: 'APPROVED',
      fakeRequiredRole: 'NONE',
    };

    // Server calculates authoritative financials using master data
    const financials = marginCalculator.calculateQuote(
      maliciousPayload.items,
      masterProductMap
    );

    // Server evaluates discount governance
    const govResult = discountGovernance.evaluate(
      financials,
      masterCustomer,
      masterProductMap,
      []
    );

    // Server evaluates deal risk
    const riskResult = dealRiskEngine.evaluateRisk(govResult);

    // Verified: Authoritative governance flags HIGH risk, requires approval, and demands SALES_MANAGER role
    expect(riskResult.riskLevel).toBe('HIGH');
    expect(riskResult.requiresApproval).toBe(true);
    expect(riskResult.requiredApprovalRole).toBe('SALES_MANAGER');
    expect(riskResult.reasons[0]).toContain('exceeds Gold Tier Customer ceiling of 15.00%');
  });

  it('3. rejects attempts to bypass critical margin erosion checks via client-side parameters', () => {
    const lossPayload: QuoteLineInput = {
      productId: 'prod_server_01',
      quantity: 1,
      discountPercent: 42.0, // Net revenue = 87,000, Cost = 90,000 -> Negative margin (-3.45%)
    };

    const financials = marginCalculator.calculateQuote(
      [lossPayload],
      masterProductMap
    );

    const govResult = discountGovernance.evaluate(
      financials,
      masterCustomer,
      masterProductMap,
      []
    );

    const riskResult = dealRiskEngine.evaluateRisk(govResult);

    // Verified: Backend flags CRITICAL_MARGIN_EROSION and escalates required approval to FINANCE_APPROVER
    expect(govResult.triggeredRules.some((r) => r.ruleCode === 'CRITICAL_MARGIN_EROSION')).toBe(true);
    expect(riskResult.requiredApprovalRole).toBe('FINANCE_APPROVER');
  });
});
