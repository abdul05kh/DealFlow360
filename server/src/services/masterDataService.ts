import type { ApprovalRule, CrossSellRule, DiscountPolicy, Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import {
  ApprovalRuleDomain,
  CrossSellRuleDomain,
  CustomerDomain,
  CustomerTierDomain,
  DiscountPolicyDomain,
  ProductCategoryDomain,
  ProductDomain,
  UserDomain,
} from '../domain/types';

type CustomerWithTier = Prisma.CustomerGetPayload<{
  include: { tier: true };
}>;

type ProductWithCategory = Prisma.ProductGetPayload<{
  include: { category: true };
}>;

export class MasterDataService {
  /**
   * Retrieves all active customers with tier information.
   */
  async getAllCustomers(): Promise<CustomerDomain[]> {
    const customers: CustomerWithTier[] = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      include: { tier: true },
    });

    return customers.map((c: CustomerWithTier): CustomerDomain => ({
      id: c.id,
      name: c.name,
      tierId: c.tierId,
      tier: {
        id: c.tier.id,
        code: c.tier.code,
        name: c.tier.name,
        maxOverallDiscount: c.tier.maxOverallDiscount,
        minMarginThreshold: c.tier.minMarginThreshold,
      },
      currency: c.currency,
      status: c.status,
    }));
  }

  /**
   * Retrieves all active products with category information.
   */
  async getAllProducts(): Promise<ProductDomain[]> {
    const products: ProductWithCategory[] = await prisma.product.findMany({
      where: { isActive: true },
      include: { category: true },
    });

    return products.map((p: ProductWithCategory): ProductDomain => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      categoryId: p.categoryId,
      category: {
        id: p.category.id,
        code: p.category.code,
        name: p.category.name,
        maxCategoryDiscount: p.category.maxCategoryDiscount,
      },
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
      isActive: p.isActive,
    }));
  }

  /**
   * Retrieves customer with tier information mapped to domain model.
   */
  async getCustomerWithTier(customerId: string): Promise<CustomerDomain | null> {
    const customer: CustomerWithTier | null = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { tier: true },
    });

    if (!customer) return null;

    const tierDomain: CustomerTierDomain = {
      id: customer.tier.id,
      code: customer.tier.code,
      name: customer.tier.name,
      maxOverallDiscount: customer.tier.maxOverallDiscount,
      minMarginThreshold: customer.tier.minMarginThreshold,
    };

    return {
      id: customer.id,
      name: customer.name,
      tierId: customer.tierId,
      tier: tierDomain,
      currency: customer.currency,
      status: customer.status,
    };
  }

  /**
   * Retrieves product with category information mapped to domain model.
   */
  async getProductWithCategory(productId: string): Promise<ProductDomain | null> {
    const product: ProductWithCategory | null = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });

    if (!product) return null;

    const categoryDomain: ProductCategoryDomain = {
      id: product.category.id,
      code: product.category.code,
      name: product.category.name,
      maxCategoryDiscount: product.category.maxCategoryDiscount,
    };

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      categoryId: product.categoryId,
      category: categoryDomain,
      sellingPrice: product.sellingPrice,
      costPrice: product.costPrice,
      isActive: product.isActive,
    };
  }

  /**
   * Batch retrieves products by IDs mapped to domain models.
   */
  async getProductsByIds(productIds: string[]): Promise<Map<string, ProductDomain>> {
    const products: ProductWithCategory[] = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });

    const map = new Map<string, ProductDomain>();
    for (const p of products) {
      const categoryDomain: ProductCategoryDomain = {
        id: p.category.id,
        code: p.category.code,
        name: p.category.name,
        maxCategoryDiscount: p.category.maxCategoryDiscount,
      };
      map.set(p.id, {
        id: p.id,
        sku: p.sku,
        name: p.name,
        categoryId: p.categoryId,
        category: categoryDomain,
        sellingPrice: p.sellingPrice,
        costPrice: p.costPrice,
        isActive: p.isActive,
      });
    }
    return map;
  }

  /**
   * Retrieves all discount policies mapped to domain models.
   */
  async getAllDiscountPolicies(): Promise<DiscountPolicyDomain[]> {
    const policies: DiscountPolicy[] = await prisma.discountPolicy.findMany();
    return policies.map((p: DiscountPolicy): DiscountPolicyDomain => ({
      id: p.id,
      name: p.name,
      tierId: p.tierId,
      categoryId: p.categoryId,
      maxDiscountPercent: p.maxDiscountPercent,
      riskSeverity: p.riskSeverity as 'LOW' | 'MEDIUM' | 'HIGH',
      requiresApproval: p.requiresApproval,
    }));
  }

  /**
   * Retrieves all approval rules mapped to domain models.
   */
  async getAllApprovalRules(): Promise<ApprovalRuleDomain[]> {
    const rules: ApprovalRule[] = await prisma.approvalRule.findMany();
    return rules.map((r: ApprovalRule): ApprovalRuleDomain => ({
      id: r.id,
      name: r.name,
      minRiskLevel: r.minRiskLevel as 'LOW' | 'MEDIUM' | 'HIGH',
      requiredRole: r.requiredRole as 'SALES_MANAGER' | 'FINANCE_APPROVER',
      autoApproveEligible: r.autoApproveEligible,
    }));
  }

  /**
   * Retrieves all cross-sell rules mapped to domain models.
   */
  async getCrossSellRules(): Promise<CrossSellRuleDomain[]> {
    const rules: CrossSellRule[] = await prisma.crossSellRule.findMany();
    return rules.map((r: CrossSellRule): CrossSellRuleDomain => ({
      id: r.id,
      triggerProductId: r.triggerProductId,
      recommendedProductId: r.recommendedProductId,
      reasonTemplate: r.reasonTemplate,
      minMarginPercent: r.minMarginPercent,
    }));
  }

  /**
   * Retrieves a user by ID.
   */
  async getUserById(userId: string): Promise<UserDomain | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as 'SALES_REP' | 'SALES_MANAGER' | 'FINANCE_APPROVER',
    };
  }
}

export const masterDataService = new MasterDataService();
