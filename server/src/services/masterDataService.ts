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

interface CustomerRecord {
  id: string;
  name: string;
  tierId: string;
  tier: {
    id: string;
    code: string;
    name: string;
    maxOverallDiscount: number;
    minMarginThreshold: number;
  };
  currency: string;
  status: string;
}

interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: {
    id: string;
    code: string;
    name: string;
    maxCategoryDiscount: number;
  };
  sellingPrice: number;
  costPrice: number;
  isActive: boolean;
}

interface DiscountPolicyRecord {
  id: string;
  name: string;
  tierId: string | null;
  categoryId: string | null;
  maxDiscountPercent: number;
  riskSeverity: string;
  requiresApproval: boolean;
}

interface ApprovalRuleRecord {
  id: string;
  name: string;
  minRiskLevel: string;
  requiredRole: string;
  autoApproveEligible: boolean;
}

interface CrossSellRuleRecord {
  id: string;
  triggerProductId: string;
  recommendedProductId: string;
  reasonTemplate: string;
  minMarginPercent: number;
}

import {
  CreateCustomerInput,
  CreateCustomerTierInput,
  CreateProductCategoryInput,
  CreateProductInput,
  UpdateCustomerInput,
  UpdateCustomerTierInput,
  UpdateProductCategoryInput,
  UpdateProductInput,
} from '../schemas/masterDataSchema';

export class MasterDataService {
  /**
   * Retrieves all customers with tier information (optionally including inactive).
   */
  async getAllCustomers(includeInactive = false): Promise<CustomerDomain[]> {
    const whereCondition = includeInactive ? {} : { status: 'ACTIVE' };
    const customers = await prisma.customer.findMany({
      where: whereCondition,
      include: { tier: true },
    });

    return customers.map((c: CustomerRecord) => ({
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
   * Retrieves all products with category information (optionally including inactive).
   */
  async getAllProducts(includeInactive = false): Promise<ProductDomain[]> {
    const whereCondition = includeInactive ? {} : { isActive: true };
    const products = await prisma.product.findMany({
      where: whereCondition,
      include: { category: true },
    });

    return products.map((p: ProductRecord) => ({
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
    const customer = await prisma.customer.findUnique({
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
    const product = await prisma.product.findUnique({
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
    const products = await prisma.product.findMany({
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
    const policies = await prisma.discountPolicy.findMany();
    return policies.map((p: DiscountPolicyRecord) => ({
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
    const rules = await prisma.approvalRule.findMany();
    return rules.map((r: ApprovalRuleRecord) => ({
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
    const rules = await prisma.crossSellRule.findMany();
    return rules.map((r: CrossSellRuleRecord) => ({
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

  // --- ADMIN MUTATION METHODS ---

  async createProduct(input: CreateProductInput): Promise<ProductDomain> {
    const existing = await prisma.product.findUnique({ where: { sku: input.sku } });
    if (existing) {
      const err: any = new Error(`Product with SKU '${input.sku}' already exists`);
      err.statusCode = 400;
      throw err;
    }

    const category = await prisma.productCategory.findUnique({ where: { id: input.categoryId } });
    if (!category) {
      const err: any = new Error(`Product category with ID '${input.categoryId}' does not exist`);
      err.statusCode = 400;
      throw err;
    }

    const created = await prisma.product.create({
      data: {
        sku: input.sku,
        name: input.name,
        categoryId: input.categoryId,
        sellingPrice: input.sellingPrice,
        costPrice: input.costPrice,
        isActive: input.isActive ?? true,
      },
      include: { category: true },
    });

    return {
      id: created.id,
      sku: created.sku,
      name: created.name,
      categoryId: created.categoryId,
      category: {
        id: created.category.id,
        code: created.category.code,
        name: created.category.name,
        maxCategoryDiscount: created.category.maxCategoryDiscount,
      },
      sellingPrice: created.sellingPrice,
      costPrice: created.costPrice,
      isActive: created.isActive,
    };
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductDomain> {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      const err: any = new Error(`Product with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (input.sku && input.sku !== existing.sku) {
      const skuCheck = await prisma.product.findUnique({ where: { sku: input.sku } });
      if (skuCheck) {
        const err: any = new Error(`Product with SKU '${input.sku}' already exists`);
        err.statusCode = 400;
        throw err;
      }
    }

    if (input.categoryId) {
      const category = await prisma.productCategory.findUnique({ where: { id: input.categoryId } });
      if (!category) {
        const err: any = new Error(`Product category with ID '${input.categoryId}' does not exist`);
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: input,
      include: { category: true },
    });

    return {
      id: updated.id,
      sku: updated.sku,
      name: updated.name,
      categoryId: updated.categoryId,
      category: {
        id: updated.category.id,
        code: updated.category.code,
        name: updated.category.name,
        maxCategoryDiscount: updated.category.maxCategoryDiscount,
      },
      sellingPrice: updated.sellingPrice,
      costPrice: updated.costPrice,
      isActive: updated.isActive,
    };
  }

  async getAllCustomerTiers(): Promise<CustomerTierDomain[]> {
    const tiers = await prisma.customerTier.findMany();
    return tiers.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      maxOverallDiscount: t.maxOverallDiscount,
      minMarginThreshold: t.minMarginThreshold,
    }));
  }

  async createCustomerTier(input: CreateCustomerTierInput): Promise<CustomerTierDomain> {
    const existing = await prisma.customerTier.findUnique({ where: { code: input.code } });
    if (existing) {
      const err: any = new Error(`Customer Tier with code '${input.code}' already exists`);
      err.statusCode = 400;
      throw err;
    }

    const created = await prisma.customerTier.create({ data: input });
    return {
      id: created.id,
      code: created.code,
      name: created.name,
      maxOverallDiscount: created.maxOverallDiscount,
      minMarginThreshold: created.minMarginThreshold,
    };
  }

  async updateCustomerTier(id: string, input: UpdateCustomerTierInput): Promise<CustomerTierDomain> {
    const existing = await prisma.customerTier.findUnique({ where: { id } });
    if (!existing) {
      const err: any = new Error(`Customer Tier with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (input.code && input.code !== existing.code) {
      const codeCheck = await prisma.customerTier.findUnique({ where: { code: input.code } });
      if (codeCheck) {
        const err: any = new Error(`Customer Tier with code '${input.code}' already exists`);
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await prisma.customerTier.update({
      where: { id },
      data: input,
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      maxOverallDiscount: updated.maxOverallDiscount,
      minMarginThreshold: updated.minMarginThreshold,
    };
  }

  async createCustomer(input: CreateCustomerInput): Promise<CustomerDomain> {
    const tier = await prisma.customerTier.findUnique({ where: { id: input.tierId } });
    if (!tier) {
      const err: any = new Error(`Customer Tier with ID '${input.tierId}' does not exist`);
      err.statusCode = 400;
      throw err;
    }

    const created = await prisma.customer.create({
      data: {
        name: input.name,
        tierId: input.tierId,
        currency: input.currency || 'INR',
        status: input.status || 'ACTIVE',
      },
      include: { tier: true },
    });

    return {
      id: created.id,
      name: created.name,
      tierId: created.tierId,
      tier: {
        id: created.tier.id,
        code: created.tier.code,
        name: created.tier.name,
        maxOverallDiscount: created.tier.maxOverallDiscount,
        minMarginThreshold: created.tier.minMarginThreshold,
      },
      currency: created.currency,
      status: created.status,
    };
  }

  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerDomain> {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      const err: any = new Error(`Customer with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (input.tierId) {
      const tier = await prisma.customerTier.findUnique({ where: { id: input.tierId } });
      if (!tier) {
        const err: any = new Error(`Customer Tier with ID '${input.tierId}' does not exist`);
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: input,
      include: { tier: true },
    });

    return {
      id: updated.id,
      name: updated.name,
      tierId: updated.tierId,
      tier: {
        id: updated.tier.id,
        code: updated.tier.code,
        name: updated.tier.name,
        maxOverallDiscount: updated.tier.maxOverallDiscount,
        minMarginThreshold: updated.tier.minMarginThreshold,
      },
      currency: updated.currency,
      status: updated.status,
    };
  }

  async getAllProductCategories(): Promise<ProductCategoryDomain[]> {
    const categories = await prisma.productCategory.findMany();
    return categories.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      maxCategoryDiscount: c.maxCategoryDiscount,
    }));
  }

  async createProductCategory(input: CreateProductCategoryInput): Promise<ProductCategoryDomain> {
    const existing = await prisma.productCategory.findUnique({ where: { code: input.code } });
    if (existing) {
      const err: any = new Error(`Product category with code '${input.code}' already exists`);
      err.statusCode = 400;
      throw err;
    }

    const created = await prisma.productCategory.create({ data: input });
    return {
      id: created.id,
      code: created.code,
      name: created.name,
      maxCategoryDiscount: created.maxCategoryDiscount,
    };
  }

  async updateProductCategory(id: string, input: UpdateProductCategoryInput): Promise<ProductCategoryDomain> {
    const existing = await prisma.productCategory.findUnique({ where: { id } });
    if (!existing) {
      const err: any = new Error(`Product category with ID '${id}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (input.code && input.code !== existing.code) {
      const codeCheck = await prisma.productCategory.findUnique({ where: { code: input.code } });
      if (codeCheck) {
        const err: any = new Error(`Product category with code '${input.code}' already exists`);
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: input,
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      maxCategoryDiscount: updated.maxCategoryDiscount,
    };
  }
}

export const masterDataService = new MasterDataService();
