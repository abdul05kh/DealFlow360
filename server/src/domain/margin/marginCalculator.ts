import {
  CalculatedLine,
  DomainValidationError,
  FinancialSummary,
  ProductDomain,
  QuoteLineInput,
} from '../types';

export class MarginCalculator {
  /**
   * Computes deterministic financial metrics for quote lines using integer minor units.
   *
   * Minor Unit Rules:
   * 1. 1 major unit = 100 minor units (e.g. ₹150,000.00 = 15,000,000 minor units).
   * 2. Line gross minor = quantity * unitPriceMinor.
   * 3. Line discount minor = round(lineGrossMinor * (discountPercent / 100)).
   * 4. Line net total minor = lineGrossMinor - lineDiscountMinor.
   * 5. Line cost minor = quantity * unitCostMinor.
   * 6. Line margin minor = lineNetTotalMinor - lineCostMinor.
   */
  public calculateQuote(
    linesInput: QuoteLineInput[],
    productMap: Map<string, ProductDomain>
  ): FinancialSummary {
    if (!linesInput || linesInput.length === 0) {
      throw new DomainValidationError('Quote must contain at least one line item.');
    }

    let grossRevenueMinor = 0;
    let totalDiscountAmountMinor = 0;
    let totalNetRevenueMinor = 0;
    let totalEstimatedCostMinor = 0;

    const calculatedLines: CalculatedLine[] = [];

    for (const input of linesInput) {
      // Input validations
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new DomainValidationError(
          `Invalid quantity: ${input.quantity}. Quantity must be a positive integer.`
        );
      }

      if (
        typeof input.discountPercent !== 'number' ||
        Number.isNaN(input.discountPercent) ||
        input.discountPercent < 0 ||
        input.discountPercent > 100
      ) {
        throw new DomainValidationError(
          `Invalid discount percentage: ${input.discountPercent}. Must be between 0 and 100.`
        );
      }

      const product = productMap.get(input.productId);
      if (!product) {
        throw new DomainValidationError(
          `Product not found for ID: ${input.productId}`
        );
      }

      // Authoritative unit price & cost (override requested price if invalid)
      const unitPrice = input.requestedUnitPrice ?? product.sellingPrice;
      const unitCost = product.costPrice;

      if (typeof unitPrice !== 'number' || Number.isNaN(unitPrice) || unitPrice < 0) {
        throw new DomainValidationError(
          `Invalid unit price: ${unitPrice}. Must be a non-negative number.`
        );
      }

      if (typeof unitCost !== 'number' || Number.isNaN(unitCost) || unitCost < 0) {
        throw new DomainValidationError(
          `Invalid unit cost: ${unitCost}. Must be a non-negative number.`
        );
      }

      // Minor unit conversions (integer minor units)
      const unitPriceMinor = Math.round(unitPrice * 100);
      const unitCostMinor = Math.round(unitCost * 100);

      const lineGrossMinor = input.quantity * unitPriceMinor;
      const discountAmountMinor = Math.round(
        lineGrossMinor * (input.discountPercent / 100)
      );
      const netTotalMinor = lineGrossMinor - discountAmountMinor;
      const lineCostMinor = input.quantity * unitCostMinor;
      const lineMarginMinor = netTotalMinor - lineCostMinor;

      const lineMarginPercent =
        netTotalMinor > 0
          ? Math.round((lineMarginMinor / netTotalMinor) * 10000) / 100
          : 0;

      grossRevenueMinor += lineGrossMinor;
      totalDiscountAmountMinor += discountAmountMinor;
      totalNetRevenueMinor += netTotalMinor;
      totalEstimatedCostMinor += lineCostMinor;

      calculatedLines.push({
        productId: input.productId,
        quantity: input.quantity,
        unitPrice: unitPriceMinor / 100,
        unitCost: unitCostMinor / 100,
        discountPercent: input.discountPercent,
        lineGross: lineGrossMinor / 100,
        discountAmount: discountAmountMinor / 100,
        netTotal: netTotalMinor / 100,
        lineCost: lineCostMinor / 100,
        lineMargin: lineMarginMinor / 100,
        lineMarginPercent,
        billingType: input.billingType || product.billingType || 'ONE_TIME',
        billingInterval: input.billingInterval !== undefined ? input.billingInterval : (product.billingInterval || null),
      });
    }

    const totalGrossMarginMinor = totalNetRevenueMinor - totalEstimatedCostMinor;

    const marginPercentage =
      totalNetRevenueMinor > 0
        ? Math.round((totalGrossMarginMinor / totalNetRevenueMinor) * 10000) / 100
        : 0;

    return {
      lines: calculatedLines,
      grossRevenue: grossRevenueMinor / 100,
      discountAmount: totalDiscountAmountMinor / 100,
      netRevenue: totalNetRevenueMinor / 100,
      estimatedCost: totalEstimatedCostMinor / 100,
      grossMargin: totalGrossMarginMinor / 100,
      marginPercentage,
    };
  }
}

export const marginCalculator = new MarginCalculator();
