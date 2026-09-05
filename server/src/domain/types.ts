/**
 * DealFlow360 - Pure Domain Contracts
 * Fully decoupled from Prisma, Express, and UI state.
 */

// 1. Master Data Domain Types
export interface CustomerTierDomain {
  id: string;
  code: string;
  name: string;
  maxOverallDiscount: number; // e.g. 15.0 for 15%
  minMarginThreshold: number; // e.g. 30.0 for 30%
}

export interface CustomerDomain {
  id: string;
  name: string;
  tierId: string;
  tier: CustomerTierDomain;
  currency: string;
  status: string;
}

export interface ProductCategoryDomain {
  id: string;
  code: string;
  name: string;
  maxCategoryDiscount: number; // e.g. 10.0 for 10%
}

export interface ProductDomain {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: ProductCategoryDomain;
  sellingPrice: number; // Major unit (e.g. 150000.00)
  costPrice: number;    // Major unit (e.g. 90000.00)
  isActive: boolean;
}

export interface DiscountPolicyDomain {
  id: string;
  name: string;
  tierId?: string | null;
  categoryId?: string | null;
  maxDiscountPercent: number;
  riskSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
  requiresApproval: boolean;
}

export interface ApprovalRuleDomain {
  id: string;
  name: string;
  minRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  requiredRole: 'SALES_MANAGER' | 'FINANCE_APPROVER';
  autoApproveEligible: boolean;
}

export interface CrossSellRuleDomain {
  id: string;
  triggerProductId: string;
  recommendedProductId: string;
  reasonTemplate: string;
  minMarginPercent: number; // Configuration-driven per rule
}

export interface UserDomain {
  id: string;
  name: string;
  email: string;
  role: 'SALES_REP' | 'SALES_MANAGER' | 'FINANCE_APPROVER';
}

// 2. Input DTOs for Quote Governance Evaluation
export interface QuoteLineInput {
  productId: string;
  quantity: number;
  requestedUnitPrice?: number; // Optional custom price requested by client
  discountPercent: number;
}

export interface QuoteEvaluationInput {
  customerId: string;
  salesRepId: string;
  lines: QuoteLineInput[];
}

// 3. Financial Calculation Output DTOs
export interface CalculatedLine {
  productId: string;
  quantity: number;
  unitPrice: number;       // Major units
  unitCost: number;        // Major units
  discountPercent: number;
  lineGross: number;       // Major units
  discountAmount: number;  // Major units
  netTotal: number;        // Major units
  lineCost: number;        // Major units
  lineMargin: number;      // Major units
  lineMarginPercent: number;
}

export interface FinancialSummary {
  lines: CalculatedLine[];
  grossRevenue: number;     // Major units
  discountAmount: number;   // Major units
  netRevenue: number;       // Major units
  estimatedCost: number;    // Major units
  grossMargin: number;      // Major units
  marginPercentage: number; // Round to 2 decimal places
}

// 4. Governance & Risk Evaluation Output DTOs
export interface TriggeredRule {
  ruleCode: string;
  ruleName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  penaltyPoints: number;
  actualValue: number;
  threshold: number;
  reason: string;
}

export interface DiscountGovernanceResult {
  allowed: boolean;
  requiresApproval: boolean;
  triggeredRules: TriggeredRule[];
  reasons: string[];
  highestSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RiskEvaluationResult {
  riskScore: number; // Bounded [0, 100]
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  triggeredRules: TriggeredRule[];
  reasons: string[];
  requiresApproval: boolean;
  requiredApprovalRole: 'SALES_MANAGER' | 'FINANCE_APPROVER' | null;
}

// 5. Approval State & Decision DTOs
export type QuoteStatus =
  | 'DRAFT'
  | 'EVALUATED'
  | 'AUTO_APPROVED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUIRED';

export interface ApprovalDecision {
  quoteStatus: QuoteStatus;
  requiresApproval: boolean;
  requiredRole: 'SALES_MANAGER' | 'FINANCE_APPROVER' | null;
  reasons: string[];
  canAutoApprove: boolean;
}

// 6. Recommendation Output DTOs
export interface RecommendationResult {
  ruleId: string;
  triggerProductId: string;
  recommendedProduct: ProductDomain;
  reason: string;
  projectedNetRevenue: number;
  projectedMarginPercent: number;
}

// 7. Fulfillment Domain Types
export interface WarehouseDomain {
  id: string;
  code: string;
  name: string;
  location: string;
  baseShippingCost: number;
  priority: number;
}

export interface InventoryStockDomain {
  id: string;
  warehouseId: string;
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
}

export interface FulfillmentCandidateWarehouse {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  productId: string;
  availableQuantity: number;
  baseShippingCost: number;
  priority: number;
}

export interface FulfillmentLineInput {
  quoteLineId: string;
  productId: string;
  requestedQuantity: number;
}

export interface FulfillmentItemDecision {
  quoteLineId: string;
  productId: string;
  warehouseId: string | null;
  warehouseCode: string | null;
  allocatedQuantity: number;
  status: 'FULFILLED' | 'BACKORDERED';
  shippingCost: number;
}

export type FulfillmentPlanStatus = 'ALLOCATED' | 'PARTIALLY_FULFILLED_BACKORDER';

export interface FulfillmentEvaluationResult {
  items: FulfillmentItemDecision[];
  totalShipments: number;
  totalFulfillmentCost: number;
  backorderCount: number;
  status: FulfillmentPlanStatus;
}

// Custom Domain Validation Error
export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(fromState: string, toState: string, reason?: string) {
    super(`Invalid state transition from ${fromState} to ${toState}${reason ? `: ${reason}` : ''}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class NotFoundError extends Error {
  constructor(entityName: string, id: string) {
    super(`${entityName} not found with ID: ${id}`);
    this.name = 'NotFoundError';
  }
}

