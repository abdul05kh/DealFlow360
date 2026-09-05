import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import {
  BillingSummaryDTO,
  InvoiceDTO,
  InvoiceLineDTO,
  NotFoundError,
  SubscriptionDTO,
  SubscriptionLineDTO,
} from '../domain/types';

export class BillingService {
  /**
   * Generates a hybrid billing snapshot for an approved quote within a single Prisma transaction.
   * Enforces strict state machine: ONLY 'APPROVED' or 'AUTO_APPROVED' -> 'BILLING_CREATED'.
   * All billing monetary storage and calculations use integer minor units (paise/cents).
   */
  async generateBillingForQuote(
    quoteId: string,
    actorId: string,
    actorName: string,
    userRole: string,
    userCustomerId?: string | null
  ): Promise<BillingSummaryDTO> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: true,
        lines: { include: { product: true } },
        invoice: { include: { lines: { include: { product: true } } } },
        subscriptions: { include: { lines: { include: { product: true } } } },
        negotiations: true,
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote', quoteId);
    }

    // 1. Authorize caller ownership & tenant boundary
    if (userRole === 'CUSTOMER') {
      if (!userCustomerId || quote.customerId !== userCustomerId) {
        throw new NotFoundError('Quote', quoteId);
      }
    } else if (userRole === 'SALES_REP') {
      if (quote.salesRepId !== actorId) {
        const err: any = new Error('Forbidden: Sales Rep can only generate billing for their own quotes.');
        err.statusCode = 403;
        throw err;
      }
    }

    // 2. Strict State Machine Validation: ONLY APPROVED / AUTO_APPROVED allowed
    if (quote.status === 'BILLING_CREATED' || quote.invoice || quote.subscriptions.length > 0) {
      const err: any = new Error(`Billing has already been generated for quote: ${quoteId}`);
      err.statusCode = 409;
      throw err;
    }

    const validStatuses = ['APPROVED', 'AUTO_APPROVED'];
    if (!validStatuses.includes(quote.status)) {
      const err: any = new Error(
        `Billing generation requires an approved quote. Current quote status: ${quote.status}`
      );
      err.statusCode = 400;
      throw err;
    }

    // 3. Reject if there is an unresolved customer negotiation
    const pendingNeg = quote.negotiations.find((n: { status: string }) => n.status === 'SUBMITTED');
    if (pendingNeg) {
      const err: any = new Error('Cannot generate billing while customer negotiation is pending review.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Snapshot commercial terms from approved QuoteLines (do NOT re-read Product master data)
    // Map lines to integer minor units
    const mappedLines = quote.lines.map((line: any) => {
      const unitPriceMinor = Math.round(line.unitPrice * 100);
      const discountAmountMinor = Math.round(line.discountAmount * 100);
      const subtotalMinor = Math.round(line.subtotal * 100);
      const netTotalMinor = Math.round(line.netTotal * 100);
      const billingType = (line.billingType || line.product.billingType || 'ONE_TIME') as 'ONE_TIME' | 'RECURRING';
      const billingInterval = (line.billingInterval || line.product.billingInterval || 'MONTHLY') as 'MONTHLY' | 'YEARLY';

      return {
        quoteLineId: line.id,
        productId: line.productId,
        productName: line.product.name,
        sku: line.product.sku,
        description: `${line.product.name} (${line.product.sku})`,
        quantity: line.quantity,
        unitPriceMinor,
        discountPercent: line.discountPercent,
        discountAmountMinor,
        subtotalMinor,
        netTotalMinor,
        billingType,
        billingInterval,
      };
    });

    const oneTimeLines = mappedLines.filter((l) => l.billingType === 'ONE_TIME');
    const recurringLines = mappedLines.filter((l) => l.billingType === 'RECURRING');

    // Perform transactionally
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create Invoice if one-time items exist
      if (oneTimeLines.length > 0) {
        const subtotalMinor = oneTimeLines.reduce((sum, l) => sum + l.subtotalMinor, 0);
        const discountMinor = oneTimeLines.reduce((sum, l) => sum + l.discountAmountMinor, 0);
        const totalMinor = oneTimeLines.reduce((sum, l) => sum + l.netTotalMinor, 0);
        const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        await tx.invoice.create({
          data: {
            invoiceNumber,
            quoteId: quote.id,
            customerId: quote.customerId,
            status: 'ISSUED',
            currency: quote.customer.currency || 'INR',
            subtotalMinor,
            discountMinor,
            totalMinor,
            lines: {
              create: oneTimeLines.map((l) => ({
                quoteLineId: l.quoteLineId,
                productId: l.productId,
                description: l.description,
                quantity: l.quantity,
                unitPriceMinor: l.unitPriceMinor,
                discountPercent: l.discountPercent,
                discountAmountMinor: l.discountAmountMinor,
                netTotalMinor: l.netTotalMinor,
              })),
            },
          },
        });
      }

      // Group recurring items by interval (MONTHLY vs YEARLY)
      const monthlyLines = recurringLines.filter((l) => l.billingInterval === 'MONTHLY');
      const yearlyLines = recurringLines.filter((l) => l.billingInterval === 'YEARLY');

      if (monthlyLines.length > 0) {
        const recurringAmountMinor = monthlyLines.reduce((sum, l) => sum + l.netTotalMinor, 0);
        const subscriptionNumber = `SUB-M-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const startDate = new Date();
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        await tx.subscription.create({
          data: {
            subscriptionNumber,
            quoteId: quote.id,
            customerId: quote.customerId,
            status: 'ACTIVE',
            billingInterval: 'MONTHLY',
            recurringAmountMinor,
            currency: quote.customer.currency || 'INR',
            startDate,
            nextBillingDate,
            lines: {
              create: monthlyLines.map((l) => ({
                quoteLineId: l.quoteLineId,
                productId: l.productId,
                description: l.description,
                quantity: l.quantity,
                unitPriceMinor: l.unitPriceMinor,
                discountPercent: l.discountPercent,
                discountAmountMinor: l.discountAmountMinor,
                netTotalMinor: l.netTotalMinor,
              })),
            },
          },
        });
      }

      if (yearlyLines.length > 0) {
        const recurringAmountMinor = yearlyLines.reduce((sum, l) => sum + l.netTotalMinor, 0);
        const subscriptionNumber = `SUB-Y-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const startDate = new Date();
        const nextBillingDate = new Date();
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);

        await tx.subscription.create({
          data: {
            subscriptionNumber,
            quoteId: quote.id,
            customerId: quote.customerId,
            status: 'ACTIVE',
            billingInterval: 'YEARLY',
            recurringAmountMinor,
            currency: quote.customer.currency || 'INR',
            startDate,
            nextBillingDate,
            lines: {
              create: yearlyLines.map((l) => ({
                quoteLineId: l.quoteLineId,
                productId: l.productId,
                description: l.description,
                quantity: l.quantity,
                unitPriceMinor: l.unitPriceMinor,
                discountPercent: l.discountPercent,
                discountAmountMinor: l.discountAmountMinor,
                netTotalMinor: l.netTotalMinor,
              })),
            },
          },
        });
      }

      // Update Quote Status to BILLING_CREATED
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: 'BILLING_CREATED' },
      });

      // Write Audit Event
      await tx.auditEvent.create({
        data: {
          entityType: 'BILLING',
          entityId: quote.id,
          actorId,
          actorName,
          action: 'CREATE_BILLING_PLAN',
          newStateJson: JSON.stringify({
            quoteId: quote.id,
            status: 'BILLING_CREATED',
            oneTimeLinesCount: oneTimeLines.length,
            recurringLinesCount: recurringLines.length,
          }),
        },
      });
    });

    return this.getBillingSummaryByQuoteId(quoteId, userRole, userCustomerId);
  }

  /**
   * Records payment for an issued invoice within a single Prisma transaction.
   * Validates authorization, state transition (ISSUED -> PAID), idempotency, and tenant isolation.
   */
  async payInvoice(
    invoiceId: string,
    actorId: string,
    actorName: string,
    userRole: string,
    userCustomerId?: string | null
  ): Promise<InvoiceDTO> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        lines: { include: { product: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    // 1. Role Authorization Checks
    const allowedRoles = ['OPERATIONS_MANAGER', 'ADMIN', 'SALES_MANAGER', 'CUSTOMER'];
    if (!allowedRoles.includes(userRole)) {
      const err: any = new Error(`Forbidden: Role ${userRole} is not authorized to record invoice payments.`);
      err.statusCode = 403;
      throw err;
    }

    // 2. Tenant Isolation Check
    if (userRole === 'CUSTOMER') {
      if (!userCustomerId || invoice.customerId !== userCustomerId) {
        throw new NotFoundError('Invoice', invoiceId);
      }
    }

    // 3. State Machine & Idempotency Validation
    if (invoice.status === 'PAID') {
      const err: any = new Error(`Invoice ${invoice.invoiceNumber} has already been paid.`);
      err.statusCode = 409;
      throw err;
    }

    if (invoice.status !== 'ISSUED') {
      const err: any = new Error(`Cannot process payment for invoice in status '${invoice.status}'. Only ISSUED invoices can be paid.`);
      err.statusCode = 400;
      throw err;
    }

    // 4. Transactional State Update & Audit Logging
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const paidInv = await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' },
        include: {
          customer: true,
          lines: { include: { product: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoiceId,
          actorId,
          actorName,
          action: 'RECORD_PAYMENT',
          newStateJson: JSON.stringify({
            invoiceId,
            invoiceNumber: paidInv.invoiceNumber,
            totalMinor: paidInv.totalMinor,
            status: 'PAID',
          }),
        },
      });

      return paidInv;
    });

    return {
      id: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      quoteId: updatedInvoice.quoteId,
      customerId: updatedInvoice.customerId,
      customerName: updatedInvoice.customer.name,
      status: updatedInvoice.status,
      currency: updatedInvoice.currency,
      subtotalMinor: updatedInvoice.subtotalMinor,
      discountMinor: updatedInvoice.discountMinor,
      totalMinor: updatedInvoice.totalMinor,
      createdAt: updatedInvoice.createdAt.toISOString(),
      lines: updatedInvoice.lines.map((l) => ({
        id: l.id,
        quoteLineId: l.quoteLineId,
        productId: l.productId,
        productName: l.product?.name || 'Product',
        sku: l.product?.sku || '',
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountPercent: l.discountPercent,
        discountAmountMinor: l.discountAmountMinor,
        netTotalMinor: l.netTotalMinor,
      })),
    };
  }

  /**
   * Retrieves full billing summary for a quote.
   */
  async getBillingSummaryByQuoteId(
    quoteId: string,
    userRole: string,
    userCustomerId?: string | null
  ): Promise<BillingSummaryDTO> {
    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        customer: true,
        invoice: { include: { lines: { include: { product: true } } } },
        subscriptions: { include: { lines: { include: { product: true } } } },
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote', quoteId);
    }

    if (userRole === 'CUSTOMER' && quote.customerId !== userCustomerId) {
      throw new NotFoundError('Quote', quoteId);
    }

    const invoiceDTO: InvoiceDTO | null = quote.invoice
      ? {
          id: quote.invoice.id,
          invoiceNumber: quote.invoice.invoiceNumber,
          quoteId: quote.invoice.quoteId,
          customerId: quote.invoice.customerId,
          customerName: quote.customer.name,
          status: quote.invoice.status,
          currency: quote.invoice.currency,
          subtotalMinor: quote.invoice.subtotalMinor,
          discountMinor: quote.invoice.discountMinor,
          totalMinor: quote.invoice.totalMinor,
          createdAt: quote.invoice.createdAt.toISOString(),
          lines: quote.invoice.lines.map((l: any) => ({
            id: l.id,
            quoteLineId: l.quoteLineId,
            productId: l.productId,
            productName: l.product?.name || 'Product',
            sku: l.product?.sku || '',
            description: l.description,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            discountPercent: l.discountPercent,
            discountAmountMinor: l.discountAmountMinor,
            netTotalMinor: l.netTotalMinor,
          })),
        }
      : null;

    const subscriptionsDTO: SubscriptionDTO[] = (quote.subscriptions || []).map((sub: any) => ({
      id: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      quoteId: sub.quoteId,
      customerId: sub.customerId,
      customerName: quote.customer.name,
      status: sub.status,
      billingInterval: sub.billingInterval as 'MONTHLY' | 'YEARLY',
      recurringAmountMinor: sub.recurringAmountMinor,
      currency: sub.currency,
      startDate: sub.startDate.toISOString(),
      nextBillingDate: sub.nextBillingDate.toISOString(),
      createdAt: sub.createdAt.toISOString(),
      lines: sub.lines.map((l: any) => ({
        id: l.id,
        quoteLineId: l.quoteLineId,
        productId: l.productId,
        productName: l.product?.name || 'Product',
        sku: l.product?.sku || '',
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountPercent: l.discountPercent,
        discountAmountMinor: l.discountAmountMinor,
        netTotalMinor: l.netTotalMinor,
      })),
    }));

    const dueNowSubtotal = invoiceDTO ? invoiceDTO.subtotalMinor : 0;
    const dueNowDiscount = invoiceDTO ? invoiceDTO.discountMinor : 0;
    const dueNowTotal = invoiceDTO ? invoiceDTO.totalMinor : 0;

    const monthlyTotalMinor = subscriptionsDTO
      .filter((s) => s.billingInterval === 'MONTHLY')
      .reduce((sum, s) => sum + s.recurringAmountMinor, 0);

    const annualTotalMinor = subscriptionsDTO
      .filter((s) => s.billingInterval === 'YEARLY')
      .reduce((sum, s) => sum + s.recurringAmountMinor, 0) + (monthlyTotalMinor * 12);

    return {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      customerId: quote.customerId,
      customerName: quote.customer.name,
      currency: quote.customer.currency || 'INR',
      quoteStatus: quote.status,
      dueNow: {
        subtotalMinor: dueNowSubtotal,
        discountMinor: dueNowDiscount,
        totalMinor: dueNowTotal,
      },
      recurring: {
        monthlyTotalMinor,
        annualTotalMinor,
      },
      invoice: invoiceDTO,
      subscriptions: subscriptionsDTO,
    };
  }

  /**
   * Retrieves sanitized customer billing list for a customer ID.
   */
  async getCustomerBilling(customerId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { customerId },
      include: {
        customer: true,
        lines: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const subscriptions = await prisma.subscription.findMany({
      where: { customerId },
      include: {
        customer: true,
        lines: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const invoiceDTOs: InvoiceDTO[] = invoices.map((inv: any) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      quoteId: inv.quoteId,
      customerId: inv.customerId,
      customerName: inv.customer.name,
      status: inv.status,
      currency: inv.currency,
      subtotalMinor: inv.subtotalMinor,
      discountMinor: inv.discountMinor,
      totalMinor: inv.totalMinor,
      createdAt: inv.createdAt.toISOString(),
      lines: inv.lines.map((l: any) => ({
        id: l.id,
        quoteLineId: l.quoteLineId,
        productId: l.productId,
        productName: l.product?.name || 'Product',
        sku: l.product?.sku || '',
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountPercent: l.discountPercent,
        discountAmountMinor: l.discountAmountMinor,
        netTotalMinor: l.netTotalMinor,
      })),
    }));

    const subscriptionDTOs: SubscriptionDTO[] = subscriptions.map((sub: any) => ({
      id: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      quoteId: sub.quoteId,
      customerId: sub.customerId,
      customerName: sub.customer.name,
      status: sub.status,
      billingInterval: sub.billingInterval as 'MONTHLY' | 'YEARLY',
      recurringAmountMinor: sub.recurringAmountMinor,
      currency: sub.currency,
      startDate: sub.startDate.toISOString(),
      nextBillingDate: sub.nextBillingDate.toISOString(),
      createdAt: sub.createdAt.toISOString(),
      lines: sub.lines.map((l: any) => ({
        id: l.id,
        quoteLineId: l.quoteLineId,
        productId: l.productId,
        productName: l.product?.name || 'Product',
        sku: l.product?.sku || '',
        description: l.description,
        quantity: l.quantity,
        unitPriceMinor: l.unitPriceMinor,
        discountPercent: l.discountPercent,
        discountAmountMinor: l.discountAmountMinor,
        netTotalMinor: l.netTotalMinor,
      })),
    }));

    return {
      invoices: invoiceDTOs,
      subscriptions: subscriptionDTOs,
    };
  }
}

export const billingService = new BillingService();
