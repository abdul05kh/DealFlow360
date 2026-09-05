import { describe, expect, it } from 'vitest';
import { marginCalculator } from '../src/domain/margin/marginCalculator';
import { DomainValidationError, ProductDomain } from '../src/domain/types';

describe('MarginCalculator Unit Tests', () => {
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

  it('1. calculates single line quote with zero discount', () => {
    const result = marginCalculator.calculateQuote(
      [{ productId: 'prod_server_01', quantity: 1, discountPercent: 0 }],
      sampleProducts
    );

    expect(result.grossRevenue).toBe(150000);
    expect(result.discountAmount).toBe(0);
    expect(result.netRevenue).toBe(150000);
    expect(result.estimatedCost).toBe(90000);
    expect(result.grossMargin).toBe(60000);
    expect(result.marginPercentage).toBe(40.0);
  });

  it('2. calculates normal discount correctly', () => {
    const result = marginCalculator.calculateQuote(
      [{ productId: 'prod_server_01', quantity: 1, discountPercent: 10 }],
      sampleProducts
    );

    expect(result.grossRevenue).toBe(150000);
    expect(result.discountAmount).toBe(15000);
    expect(result.netRevenue).toBe(135000);
    expect(result.estimatedCost).toBe(90000);
    expect(result.grossMargin).toBe(45000);
    expect(result.marginPercentage).toBe(33.33);
  });

  it('3. handles 100% discount correctly', () => {
    const result = marginCalculator.calculateQuote(
      [{ productId: 'prod_server_01', quantity: 1, discountPercent: 100 }],
      sampleProducts
    );

    expect(result.grossRevenue).toBe(150000);
    expect(result.discountAmount).toBe(150000);
    expect(result.netRevenue).toBe(0);
    expect(result.estimatedCost).toBe(90000);
    expect(result.grossMargin).toBe(-90000);
    expect(result.marginPercentage).toBe(0);
  });

  it('4. calculates multi-line quote accurately', () => {
    const result = marginCalculator.calculateQuote(
      [
        { productId: 'prod_server_01', quantity: 2, discountPercent: 10 }, // 300,000 gross, 30,000 disc, 270,000 net, 180,000 cost
        { productId: 'prod_service_01', quantity: 1, discountPercent: 5 },  // 50,000 gross, 2,500 disc, 47,500 net, 30,000 cost
      ],
      sampleProducts
    );

    expect(result.grossRevenue).toBe(350000);
    expect(result.discountAmount).toBe(32500);
    expect(result.netRevenue).toBe(317500);
    expect(result.estimatedCost).toBe(210000);
    expect(result.grossMargin).toBe(107500);
    expect(result.marginPercentage).toBe(33.86);
  });

  it('5. rejects zero quantity', () => {
    expect(() =>
      marginCalculator.calculateQuote(
        [{ productId: 'prod_server_01', quantity: 0, discountPercent: 10 }],
        sampleProducts
      )
    ).toThrow(DomainValidationError);
  });

  it('6. rejects negative quantity', () => {
    expect(() =>
      marginCalculator.calculateQuote(
        [{ productId: 'prod_server_01', quantity: -2, discountPercent: 10 }],
        sampleProducts
      )
    ).toThrow(DomainValidationError);
  });

  it('7. rejects fractional quantity', () => {
    expect(() =>
      marginCalculator.calculateQuote(
        [{ productId: 'prod_server_01', quantity: 1.5, discountPercent: 10 }],
        sampleProducts
      )
    ).toThrow(DomainValidationError);
  });

  it('8. rejects discount below 0', () => {
    expect(() =>
      marginCalculator.calculateQuote(
        [{ productId: 'prod_server_01', quantity: 1, discountPercent: -5 }],
        sampleProducts
      )
    ).toThrow(DomainValidationError);
  });

  it('9. rejects discount above 100', () => {
    expect(() =>
      marginCalculator.calculateQuote(
        [{ productId: 'prod_server_01', quantity: 1, discountPercent: 105 }],
        sampleProducts
      )
    ).toThrow(DomainValidationError);
  });

  it('10. handles cost greater than net revenue (negative margin)', () => {
    const customProducts = new Map<string, ProductDomain>([
      [
        'prod_loss_01',
        {
          id: 'prod_loss_01',
          sku: 'HW-LOSS-001',
          name: 'Loss Leader Item',
          categoryId: 'cat_hardware',
          category: {
            id: 'cat_hardware',
            code: 'HARDWARE',
            name: 'Hardware Products',
            maxCategoryDiscount: 15.0,
          },
          sellingPrice: 100.0,
          costPrice: 200.0,
          isActive: true,
        },
      ],
    ]);

    const result = marginCalculator.calculateQuote(
      [{ productId: 'prod_loss_01', quantity: 1, discountPercent: 0 }],
      customProducts
    );

    expect(result.netRevenue).toBe(100);
    expect(result.estimatedCost).toBe(200);
    expect(result.grossMargin).toBe(-100);
    expect(result.marginPercentage).toBe(-100.0);
  });

  it('11. rejects missing product', () => {
    expect(() =>
      marginCalculator.calculateQuote(
        [{ productId: 'prod_nonexistent', quantity: 1, discountPercent: 10 }],
        sampleProducts
      )
    ).toThrow(DomainValidationError);
  });

  it('12. maintains precision safety for small monetary values', () => {
    const precisionProducts = new Map<string, ProductDomain>([
      [
        'prod_small_01',
        {
          id: 'prod_small_01',
          sku: 'HW-SML-001',
          name: 'Micro Component',
          categoryId: 'cat_hardware',
          category: {
            id: 'cat_hardware',
            code: 'HARDWARE',
            name: 'Hardware Products',
            maxCategoryDiscount: 15.0,
          },
          sellingPrice: 0.33,
          costPrice: 0.11,
          isActive: true,
        },
      ],
    ]);

    const result = marginCalculator.calculateQuote(
      [{ productId: 'prod_small_01', quantity: 3, discountPercent: 10 }],
      precisionProducts
    );

    expect(result.grossRevenue).toBe(0.99);
    expect(result.discountAmount).toBe(0.1);
    expect(result.netRevenue).toBe(0.89);
    expect(result.estimatedCost).toBe(0.33);
    expect(result.grossMargin).toBe(0.56);
  });
});
