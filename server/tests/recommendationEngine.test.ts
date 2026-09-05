import { describe, expect, it } from 'vitest';
import { marginCalculator } from '../src/domain/margin/marginCalculator';
import { recommendationEngine } from '../src/domain/recommendation/recommendationEngine';
import { CrossSellRuleDomain, ProductDomain, QuoteLineInput } from '../src/domain/types';

describe('RecommendationEngine Unit Tests', () => {
  const sampleProducts = new Map<string, ProductDomain>([
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
          maxCategoryDiscount: 15.0,
        },
        sellingPrice: 150000.0,
        costPrice: 90000.0,
        isActive: true,
      },
    ],
    [
      'prod_warranty_01',
      {
        id: 'prod_warranty_01',
        sku: 'SW-WRN-001',
        name: 'Extended Warranty',
        categoryId: 'cat_software',
        category: {
          id: 'cat_software',
          code: 'SOFTWARE',
          name: 'Software & Licenses',
          maxCategoryDiscount: 20.0,
        },
        sellingPrice: 25000.0,
        costPrice: 5000.0,
        isActive: true,
      },
    ],
  ]);

  const crossSellRules: CrossSellRuleDomain[] = [
    {
      id: 'rule_cs_01',
      triggerProductId: 'prod_server_01',
      recommendedProductId: 'prod_warranty_01',
      reasonTemplate:
        'Customers purchasing Enterprise Server commonly add Extended Warranty to protect hardware investments.',
      minMarginPercent: 30.0,
    },
  ];

  it('1. recommends cross-sell product when trigger is present, recommendation is missing, and margin threshold is satisfied', () => {
    const lines: QuoteLineInput[] = [
      { productId: 'prod_server_01', quantity: 1, discountPercent: 0 },
    ];
    const financials = marginCalculator.calculateQuote(lines, sampleProducts);

    const recs = recommendationEngine.evaluateRecommendations(
      lines,
      financials,
      crossSellRules,
      sampleProducts
    );

    expect(recs.length).toBe(1);
    expect(recs[0].recommendedProduct.id).toBe('prod_warranty_01');
    expect(recs[0].projectedMarginPercent).toBeGreaterThanOrEqual(30.0);
  });

  it('2. does NOT recommend product if recommended product is already added to quote', () => {
    const lines: QuoteLineInput[] = [
      { productId: 'prod_server_01', quantity: 1, discountPercent: 0 },
      { productId: 'prod_warranty_01', quantity: 1, discountPercent: 0 },
    ];
    const financials = marginCalculator.calculateQuote(lines, sampleProducts);

    const recs = recommendationEngine.evaluateRecommendations(
      lines,
      financials,
      crossSellRules,
      sampleProducts
    );

    expect(recs.length).toBe(0);
  });

  it('3. does NOT recommend product if trigger product is missing from quote', () => {
    const lines: QuoteLineInput[] = [
      { productId: 'prod_warranty_01', quantity: 1, discountPercent: 0 },
    ];
    const financials = marginCalculator.calculateQuote(lines, sampleProducts);

    const recs = recommendationEngine.evaluateRecommendations(
      lines,
      financials,
      crossSellRules,
      sampleProducts
    );

    expect(recs.length).toBe(0);
  });

  it('4. suppresses recommendation if projected margin falls below rule minMarginPercent', () => {
    // Heavy discount on server so projected margin drops below 30%
    const lines: QuoteLineInput[] = [
      { productId: 'prod_server_01', quantity: 1, discountPercent: 35 }, // Server net = 97,500, cost = 90,000. With warranty net = 122,500, cost = 95,000 -> margin = 27,500 (22.45% < 30%)
    ];
    const financials = marginCalculator.calculateQuote(lines, sampleProducts);

    const recs = recommendationEngine.evaluateRecommendations(
      lines,
      financials,
      crossSellRules,
      sampleProducts
    );

    expect(recs.length).toBe(0);
  });
});
