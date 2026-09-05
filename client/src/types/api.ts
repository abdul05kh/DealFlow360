/**
 * DealFlow360 — Authoritative API Contract DTOs
 * Matches server domain types and API response payloads.
 */

export type RealUserRole = 'SALES_REP' | 'SALES_MANAGER' | 'OPERATIONS_MANAGER' | 'ADMIN' | 'CUSTOMER';
export type DemoRole = RealUserRole;

export interface AuthUserDTO {
  id: string;
  name: string;
  email: string;
  role: RealUserRole;
  customerId?: string | null;
}

export interface AuthResponseDTO {
  user: AuthUserDTO;
  token: string;
}

export interface LoginPayloadDTO {
  email: string;
  password: string;
}

export interface SignupPayloadDTO {
  name: string;
  email: string;
  password: string;
  role?: RealUserRole;
  customerId?: string;
}

export interface CustomerTierDTO {
  id: string;
  code: string;
  name: string;
  maxOverallDiscount: number;
  minMarginThreshold: number;
}

export interface CustomerDTO {
  id: string;
  name: string;
  tierId: string;
  tier: CustomerTierDTO;
  currency: string;
  status: string;
}

export interface ProductCategoryDTO {
  id: string;
  code: string;
  name: string;
  maxCategoryDiscount: number;
}

export interface ProductDTO {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  category: ProductCategoryDTO;
  sellingPrice: number;
  costPrice: number;
  isActive: boolean;
}

export interface QuoteItemInputDTO {
  productId: string;
  quantity: number;
  discountPercent: number;
}

export interface EvaluateQuotePayloadDTO {
  customerId: string;
  items: QuoteItemInputDTO[];
}

export interface CalculatedLineDTO {
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discountPercent: number;
  lineGross: number;
  discountAmount: number;
  netTotal: number;
  lineCost: number;
  lineMargin: number;
  lineMarginPercent: number;
}

export interface FinancialSummaryDTO {
  lines: CalculatedLineDTO[];
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  estimatedCost: number;
  grossMargin: number;
  marginPercentage: number;
}

export interface TriggeredRuleDTO {
  ruleCode: string;
  ruleName: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  penaltyPoints: number;
  actualValue: number;
  threshold: number;
  reason: string;
}

export interface DiscountGovernanceResultDTO {
  allowed: boolean;
  requiresApproval: boolean;
  triggeredRules: TriggeredRuleDTO[];
  reasons: string[];
  highestSeverity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface RiskEvaluationResultDTO {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  triggeredRules: TriggeredRuleDTO[];
  reasons: string[];
  requiresApproval: boolean;
  requiredApprovalRole: 'SALES_MANAGER' | 'FINANCE_APPROVER' | null;
}

export type QuoteStatus =
  | 'DRAFT'
  | 'EVALUATED'
  | 'AUTO_APPROVED'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUIRED';

export interface ApprovalDecisionDTO {
  quoteStatus: QuoteStatus;
  requiresApproval: boolean;
  requiredRole: 'SALES_MANAGER' | 'FINANCE_APPROVER' | null;
  reasons: string[];
  canAutoApprove: boolean;
}

export interface RecommendationResultDTO {
  ruleId: string;
  triggerProductId: string;
  recommendedProduct: ProductDTO;
  reason: string;
  projectedNetRevenue: number;
  projectedMarginPercent: number;
}

export interface FullQuoteEvaluationDTO {
  customer: {
    id: string;
    name: string;
    tier: string;
  };
  financials: FinancialSummaryDTO;
  governance: DiscountGovernanceResultDTO;
  risk: RiskEvaluationResultDTO;
  decision: ApprovalDecisionDTO;
  recommendations: RecommendationResultDTO[];
}

export interface AuditEventDTO {
  id: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string;
  action: string;
  previousStateJson: string | null;
  newStateJson: string | null;
  contextJson: string | null;
  createdAt: string;
}

export interface ApprovalRequestDTO {
  id: string;
  status: string;
  requiredRole: string;
  actionReason: string | null;
  actionedAt: string | null;
  actionedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface SavedQuoteLineDTO {
  id: string;
  quoteId: string;
  productId: string;
  product: ProductDTO;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  netTotal: number;
  lineCost: number;
  lineMargin: number;
}

export interface SavedQuoteDTO {
  id: string;
  quoteNumber: string;
  customerId: string;
  customer: CustomerDTO;
  salesRepId: string;
  salesRep?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  status: QuoteStatus;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  estimatedCost: number;
  grossMargin: number;
  marginPercentage: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  riskReasonsJson: string;
  requiredApproverRole: string | null;
  createdAt: string;
  updatedAt: string;
  lines: SavedQuoteLineDTO[];
  approvalRequests?: ApprovalRequestDTO[];
  auditHistory?: AuditEventDTO[];
}

export interface APIErrorResponse {
  error: string;
  message: string;
}

/** Flow B Fulfillment Domain DTO Types */

export interface InventoryStockDTO {
  id: string;
  warehouseId: string;
  productId: string;
  quantityOnHand: number;
  quantityReserved: number;
  product?: ProductDTO;
}

export interface WarehouseDTO {
  id: string;
  code: string;
  name: string;
  location: string;
  baseShippingCost: number;
  priority: number;
  stocks: InventoryStockDTO[];
}

export interface FulfillmentItemDTO {
  id?: string;
  quoteLineId: string;
  productId: string;
  warehouseId?: string | null;
  warehouseCode?: string | null;
  warehouse?: WarehouseDTO | null;
  product?: ProductDTO | null;
  allocatedQuantity: number;
  status: 'FULFILLED' | 'BACKORDERED';
  shippingCost: number;
}

export interface FulfillmentEvaluationResultDTO {
  items: FulfillmentItemDTO[];
  totalShipments: number;
  totalFulfillmentCost: number;
  backorderCount: number;
  status: 'ALLOCATED' | 'PARTIALLY_FULFILLED_BACKORDER';
}

export interface FulfillmentEvaluationResponseDTO {
  quoteId: string;
  quoteNumber: string;
  customerName: string;
  evaluation: FulfillmentEvaluationResultDTO;
}

export type FulfillmentPlanStatus = 'ALLOCATED' | 'PARTIALLY_FULFILLED_BACKORDER' | 'OVERRIDDEN';

export interface FulfillmentPlanDTO {
  id: string;
  quoteId: string;
  quote?: SavedQuoteDTO;
  status: FulfillmentPlanStatus;
  totalShipments: number;
  totalFulfillmentCost: number;
  backorderCount: number;
  createdAt: string;
  items: FulfillmentItemDTO[];
  auditHistory?: AuditEventDTO[];
}

export interface ManualOverrideItemDTO {
  quoteLineId: string;
  warehouseId: string;
}
