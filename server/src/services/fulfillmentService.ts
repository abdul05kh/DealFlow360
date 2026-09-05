import { prisma } from '../db/client';
import { fulfillmentEngine } from '../domain/fulfillment/fulfillmentEngine';
import {
  DomainValidationError,
  FulfillmentCandidateWarehouse,
  FulfillmentEvaluationResult,
  FulfillmentLineInput,
  InvalidStateTransitionError,
  NotFoundError,
} from '../domain/types';
import { ManualOverrideItemDTO } from '../schemas/fulfillmentSchema';

export class FulfillmentService {
  /**
   * Retrieves all warehouses with current inventory stock per product.
   */
  async getAllWarehouses() {
    return prisma.warehouse.findMany({
      include: {
        stocks: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
      },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * Simulation-only evaluation of fulfillment allocation for an approved quote.
   * MUST NOT mutate inventory, create fulfillment plans, or write audit events.
   */
  async evaluateFulfillment(quoteId: string): Promise<{
    quoteId: string;
    quoteNumber: string;
    customerName: string;
    evaluation: FulfillmentEvaluationResult;
  }> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: true,
        lines: { include: { product: true } },
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote', quoteId);
    }

    const productIds = Array.from(new Set(quote.lines.map((l: { productId: string }) => l.productId)));

    const stocks = await prisma.inventoryStock.findMany({
      where: { productId: { in: productIds } },
      include: { warehouse: true },
    });

    const candidateInventory: FulfillmentCandidateWarehouse[] = stocks.map((s: {
      warehouseId: string;
      productId: string;
      warehouse: { code: string; name: string; baseShippingCost: number; priority: number };
      quantityOnHand: number;
      quantityReserved: number;
    }) => ({
      warehouseId: s.warehouseId,
      warehouseCode: s.warehouse.code,
      warehouseName: s.warehouse.name,
      productId: s.productId,
      availableQuantity: Math.max(0, s.quantityOnHand - s.quantityReserved),
      baseShippingCost: s.warehouse.baseShippingCost,
      priority: s.warehouse.priority,
    }));

    const fulfillmentLines: FulfillmentLineInput[] = quote.lines.map((l: {
      id: string;
      productId: string;
      quantity: number;
    }) => ({
      quoteLineId: l.id,
      productId: l.productId,
      requestedQuantity: l.quantity,
    }));

    const evaluation = fulfillmentEngine.evaluateFulfillment(fulfillmentLines, candidateInventory);

    return {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerName: quote.customer.name,
      evaluation,
    };
  }

  /**
   * Finalizes and persists the fulfillment allocation plan for an approved quote.
   * Enforces quote state preconditions, duplicate plan prevention, manual override checks,
   * atomic inventory reservation updates, and persistent audit logging within a transaction.
   */
  async allocateFulfillment(
    quoteId: string,
    manualOverrides?: ManualOverrideItemDTO[],
    actorId: string = 'ops_1',
    actorName: string = 'Operations Lead'
  ) {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: true,
        lines: { include: { product: true } },
        fulfillmentPlan: true,
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote', quoteId);
    }

    // 1. Quote Status Precondition: Must be APPROVED or AUTO_APPROVED
    if (quote.status !== 'APPROVED' && quote.status !== 'AUTO_APPROVED') {
      throw new InvalidStateTransitionError(
        quote.status,
        'ALLOCATED',
        `Quote must be in APPROVED or AUTO_APPROVED status to allocate fulfillment. Current status: ${quote.status}`
      );
    }

    // 2. Duplicate Fulfillment Plan Prevention
    if (quote.fulfillmentPlan) {
      throw new InvalidStateTransitionError(
        'FULFILLED',
        'ALLOCATED',
        `Fulfillment plan has already been allocated for quote: ${quote.quoteNumber}`
      );
    }

    // 3. Execute Transactional Allocation & Reservation
    return prisma.$transaction(async (tx: any) => {
      const productIds = Array.from(new Set(quote.lines.map((l: { productId: string }) => l.productId)));

      const stocks = await tx.inventoryStock.findMany({
        where: { productId: { in: productIds } },
        include: { warehouse: true },
      });

      const candidateInventory: FulfillmentCandidateWarehouse[] = stocks.map((s: {
        warehouseId: string;
        productId: string;
        warehouse: { code: string; name: string; baseShippingCost: number; priority: number };
        quantityOnHand: number;
        quantityReserved: number;
      }) => ({
        warehouseId: s.warehouseId,
        warehouseCode: s.warehouse.code,
        warehouseName: s.warehouse.name,
        productId: s.productId,
        availableQuantity: Math.max(0, s.quantityOnHand - s.quantityReserved),
        baseShippingCost: s.warehouse.baseShippingCost,
        priority: s.warehouse.priority,
      }));

      const fulfillmentLines: FulfillmentLineInput[] = quote.lines.map((l: {
        id: string;
        productId: string;
        quantity: number;
      }) => ({
        quoteLineId: l.id,
        productId: l.productId,
        requestedQuantity: l.quantity,
      }));

      const evaluation = fulfillmentEngine.evaluateFulfillment(fulfillmentLines, candidateInventory);
      const items = [...evaluation.items];

      // Handle Manual Overrides if provided
      if (manualOverrides && manualOverrides.length > 0) {
        for (const override of manualOverrides) {
          const targetLine = quote.lines.find((l: { id: string; productId: string; quantity: number; product: { name: string } }) => l.id === override.quoteLineId);
          if (!targetLine) {
            throw new DomainValidationError(`Invalid quoteLineId ${override.quoteLineId} in manual override.`);
          }

          const targetWarehouse = await tx.warehouse.findUnique({
            where: { id: override.warehouseId },
          });

          if (!targetWarehouse) {
            throw new NotFoundError('Warehouse', override.warehouseId);
          }

          const targetStock = await tx.inventoryStock.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: override.warehouseId,
                productId: targetLine.productId,
              },
            },
          });

          const avail = targetStock ? targetStock.quantityOnHand - targetStock.quantityReserved : 0;
          if (avail < targetLine.quantity) {
            throw new DomainValidationError(
              `Impossible manual override: Warehouse ${targetWarehouse.code} has insufficient available stock (${avail}) for requested quantity (${targetLine.quantity}) of product ${targetLine.product.name}.`
            );
          }

          // Apply manual override to item decision
          const itemIndex = items.findIndex((i) => i.quoteLineId === override.quoteLineId);
          if (itemIndex >= 0) {
            items[itemIndex] = {
              quoteLineId: override.quoteLineId,
              productId: targetLine.productId,
              warehouseId: targetWarehouse.id,
              warehouseCode: targetWarehouse.code,
              allocatedQuantity: targetLine.quantity,
              status: 'FULFILLED',
              shippingCost: targetWarehouse.baseShippingCost,
            };
          }
        }
      }

      // Re-calculate totals after optional override
      const usedWhMap = new Map<string, number>();
      let backorders = 0;
      for (const item of items) {
        if (item.status === 'BACKORDERED') {
          backorders += item.allocatedQuantity;
        } else if (item.warehouseId) {
          if (!usedWhMap.has(item.warehouseId)) {
            const wh = stocks.find((s: { warehouseId: string; warehouse: any }) => s.warehouseId === item.warehouseId)?.warehouse;
            usedWhMap.set(item.warehouseId, wh ? wh.baseShippingCost : item.shippingCost);
          }
        }
      }

      const totalShipments = usedWhMap.size;
      let totalFulfillmentCost = 0;
      usedWhMap.forEach((cost) => {
        totalFulfillmentCost += cost;
      });

      // 4. Database Update Boundary Inventory Reservation Invariant Verification
      for (const item of items) {
        if (item.status === 'FULFILLED' && item.warehouseId) {
          const currentStock = await tx.inventoryStock.findUnique({
            where: {
              warehouseId_productId: {
                warehouseId: item.warehouseId,
                productId: item.productId,
              },
            },
          });

          if (
            !currentStock ||
            currentStock.quantityOnHand - currentStock.quantityReserved < item.allocatedQuantity
          ) {
            throw new DomainValidationError(
              `Transaction Rollback: Insufficient available inventory in warehouse ${item.warehouseCode || item.warehouseId} for product ${item.productId}. Available: ${
                currentStock ? currentStock.quantityOnHand - currentStock.quantityReserved : 0
              }, Required: ${item.allocatedQuantity}`
            );
          }

          // Increment reserved quantity atomically
          await tx.inventoryStock.update({
            where: { id: currentStock.id },
            data: {
              quantityReserved: { increment: item.allocatedQuantity },
            },
          });
        }
      }

      const planStatus =
        manualOverrides && manualOverrides.length > 0
          ? 'OVERRIDDEN'
          : backorders > 0
          ? 'PARTIALLY_FULFILLED_BACKORDER'
          : 'ALLOCATED';

      // 5. Create FulfillmentPlan and FulfillmentItems
      const plan = await tx.fulfillmentPlan.create({
        data: {
          quoteId: quote.id,
          status: planStatus,
          totalShipments,
          totalFulfillmentCost,
          backorderCount: backorders,
          items: {
            create: items.map((i) => ({
              quoteLineId: i.quoteLineId,
              productId: i.productId,
              warehouseId: i.warehouseId,
              allocatedQuantity: i.allocatedQuantity,
              status: i.status,
              shippingCost: i.shippingCost,
            })),
          },
        },
        include: {
          items: {
            include: {
              warehouse: true,
              product: { include: { category: true } },
            },
          },
        },
      });

      // 6. Write Persistent Audit Log Event
      const auditAction =
        manualOverrides && manualOverrides.length > 0
          ? 'FULFILLMENT_OVERRIDDEN'
          : backorders > 0
          ? 'BACKORDER_CREATED'
          : 'FULFILLMENT_ALLOCATED';

      await tx.auditEvent.create({
        data: {
          entityType: 'QUOTE',
          entityId: quote.id,
          actorId,
          actorName,
          action: auditAction,
          previousStateJson: JSON.stringify({ fulfillmentStatus: 'UNALLOCATED' }),
          newStateJson: JSON.stringify({
            planId: plan.id,
            status: plan.status,
            totalShipments: plan.totalShipments,
            backorderCount: plan.backorderCount,
          }),
          contextJson: JSON.stringify({
            totalFulfillmentCost: plan.totalFulfillmentCost,
            manualOverrides: manualOverrides || null,
          }),
        },
      });

      return plan;
    });
  }

  /**
   * Retrieves persisted fulfillment plan details along with audit history for a quote.
   */
  async getFulfillmentByQuoteId(quoteId: string) {
    const plan = await prisma.fulfillmentPlan.findUnique({
      where: { quoteId },
      include: {
        quote: {
          include: {
            customer: { include: { tier: true } },
            salesRep: true,
          },
        },
        items: {
          include: {
            warehouse: true,
            product: { include: { category: true } },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundError('FulfillmentPlan for Quote', quoteId);
    }

    const auditHistory = await prisma.auditEvent.findMany({
      where: { entityType: 'QUOTE', entityId: quoteId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ...plan,
      auditHistory,
    };
  }
}

export const fulfillmentService = new FulfillmentService();
