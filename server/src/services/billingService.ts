import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import {
  BillingSummaryDTO,
  CreditNoteDTO,
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
      const billingInterval = (line.billingInterval || line.product.billingInterval || 'MONTHLY') as 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

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

      // Group recurring items by interval (MONTHLY vs QUARTERLY vs YEARLY)
      const monthlyLines = recurringLines.filter((l) => l.billingInterval === 'MONTHLY');
      const quarterlyLines = recurringLines.filter((l) => l.billingInterval === 'QUARTERLY');
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

      if (quarterlyLines.length > 0) {
        const recurringAmountMinor = quarterlyLines.reduce((sum, l) => sum + l.netTotalMinor, 0);
        const subscriptionNumber = `SUB-Q-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
        const startDate = new Date();
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 3);

        await tx.subscription.create({
          data: {
            subscriptionNumber,
            quoteId: quote.id,
            customerId: quote.customerId,
            status: 'ACTIVE',
            billingInterval: 'QUARTERLY',
            recurringAmountMinor,
            currency: quote.customer.currency || 'INR',
            startDate,
            nextBillingDate,
            lines: {
              create: quarterlyLines.map((l) => ({
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
        invoice: { include: { lines: { include: { product: true } }, creditNotes: true } },
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
          creditNotes: (quote.invoice.creditNotes || []).map((cn: any) => ({
            id: cn.id,
            creditNoteNumber: cn.creditNoteNumber,
            invoiceId: cn.invoiceId,
            customerId: cn.customerId,
            amountMinor: cn.amountMinor,
            reason: cn.reason,
            status: cn.status,
            createdAt: cn.createdAt.toISOString(),
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
      billingInterval: sub.billingInterval as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
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

    const quarterlyTotalMinor = subscriptionsDTO
      .filter((s) => s.billingInterval === 'QUARTERLY')
      .reduce((sum, s) => sum + s.recurringAmountMinor, 0);

    const annualTotalMinor =
      subscriptionsDTO
        .filter((s) => s.billingInterval === 'YEARLY')
        .reduce((sum, s) => sum + s.recurringAmountMinor, 0) +
      quarterlyTotalMinor * 4 +
      monthlyTotalMinor * 12;

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
        quarterlyTotalMinor,
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
        creditNotes: true,
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
      creditNotes: (inv.creditNotes || []).map((cn: any) => ({
        id: cn.id,
        creditNoteNumber: cn.creditNoteNumber,
        invoiceId: cn.invoiceId,
        customerId: cn.customerId,
        amountMinor: cn.amountMinor,
        reason: cn.reason,
        status: cn.status,
        createdAt: cn.createdAt.toISOString(),
      })),
    }));

    const subscriptionDTOs: SubscriptionDTO[] = subscriptions.map((sub: any) => ({
      id: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      quoteId: sub.quoteId,
      customerId: sub.customerId,
      customerName: sub.customer.name,
      status: sub.status,
      billingInterval: sub.billingInterval as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
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

  /**
   * Minimal subscription cancellation workflow (ACTIVE -> CANCELLED).
   * Validates authorization, current status, customer isolation, and creates audit log.
   */
  async cancelSubscription(
    subscriptionId: string,
    actorId: string,
    actorName: string,
    userRole: string,
    userCustomerId?: string | null
  ): Promise<SubscriptionDTO> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: true,
        lines: { include: { product: true } },
      },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription', subscriptionId);
    }

    // 1. Tenant Isolation & Role Authorization Check
    if (userRole === 'CUSTOMER') {
      if (!userCustomerId || subscription.customerId !== userCustomerId) {
        throw new NotFoundError('Subscription', subscriptionId);
      }
    }

    // 2. Status Validation
    if (subscription.status === 'CANCELLED') {
      const err: any = new Error(`Subscription ${subscription.subscriptionNumber} is already cancelled.`);
      err.statusCode = 409;
      throw err;
    }

    if (subscription.status !== 'ACTIVE') {
      const err: any = new Error(`Cannot cancel subscription in status '${subscription.status}'. Only ACTIVE subscriptions can be cancelled.`);
      err.statusCode = 400;
      throw err;
    }

    // 3. Transactional cancellation & Audit Logging
    const updatedSub = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'CANCELLED' },
        include: {
          customer: true,
          lines: { include: { product: true } },
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'SUBSCRIPTION',
          entityId: subscriptionId,
          actorId,
          actorName,
          action: 'CANCEL_SUBSCRIPTION',
          newStateJson: JSON.stringify({
            subscriptionId,
            subscriptionNumber: cancelled.subscriptionNumber,
            status: 'CANCELLED',
          }),
        },
      });

      return cancelled;
    });

    return {
      id: updatedSub.id,
      subscriptionNumber: updatedSub.subscriptionNumber,
      quoteId: updatedSub.quoteId,
      customerId: updatedSub.customerId,
      customerName: updatedSub.customer.name,
      status: updatedSub.status,
      billingInterval: updatedSub.billingInterval as 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
      recurringAmountMinor: updatedSub.recurringAmountMinor,
      currency: updatedSub.currency,
      startDate: updatedSub.startDate.toISOString(),
      nextBillingDate: updatedSub.nextBillingDate.toISOString(),
      createdAt: updatedSub.createdAt.toISOString(),
      lines: updatedSub.lines.map((l: any) => ({
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
   * Minimal credit note issuance workflow.
   * Enforces positive integer minor-unit amount, invoice eligibility cap, role authorization, tenant isolation, and audit logging.
   */
  async issueCreditNote(
    invoiceId: string,
    amountMinor: number,
    reason: string,
    actorId: string,
    actorName: string,
    userRole: string,
    userCustomerId?: string | null
  ): Promise<CreditNoteDTO> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        creditNotes: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    // 1. Role Authorization Check (Operations Manager, Admin, Sales Manager)
    const allowedRoles = ['OPERATIONS_MANAGER', 'ADMIN', 'SALES_MANAGER'];
    if (!allowedRoles.includes(userRole)) {
      const err: any = new Error(`Forbidden: Role ${userRole} is not authorized to issue credit notes.`);
      err.statusCode = 403;
      throw err;
    }

    // 2. Tenant Isolation Check
    if (userRole === 'CUSTOMER') {
      if (!userCustomerId || invoice.customerId !== userCustomerId) {
        throw new NotFoundError('Invoice', invoiceId);
      }
    }

    // 3. Amount & Reason Validation (Positive Integer Minor Unit)
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      const err: any = new Error('Credit note amount must be a positive integer minor-unit (paise/cents).');
      err.statusCode = 400;
      throw err;
    }

    if (!reason || reason.trim() === '') {
      const err: any = new Error('Credit note reason is required.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Eligible Invoice Cap Check
    const existingCreditSum = invoice.creditNotes.reduce((sum, cn) => sum + cn.amountMinor, 0);
    const eligibleAmount = invoice.totalMinor - existingCreditSum;

    if (amountMinor > eligibleAmount) {
      const err: any = new Error(
        `Credit note amount (${amountMinor}) exceeds remaining eligible invoice balance (${eligibleAmount}).`
      );
      err.statusCode = 400;
      throw err;
    }

    // 5. Transactional Creation & Audit Logging
    const creditNoteNumber = `CN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const createdCN = await prisma.$transaction(async (tx) => {
      const cn = await tx.creditNote.create({
        data: {
          creditNoteNumber,
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amountMinor,
          reason: reason.trim(),
          status: 'ISSUED',
        },
        include: {
          customer: true,
          invoice: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoiceId,
          actorId,
          actorName,
          action: 'ISSUE_CREDIT_NOTE',
          newStateJson: JSON.stringify({
            creditNoteId: cn.id,
            creditNoteNumber: cn.creditNoteNumber,
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            amountMinor,
            reason: cn.reason,
            status: 'ISSUED',
          }),
        },
      });

      return cn;
    });

    return {
      id: createdCN.id,
      creditNoteNumber: createdCN.creditNoteNumber,
      invoiceId: createdCN.invoiceId,
      invoiceNumber: createdCN.invoice.invoiceNumber,
      customerId: createdCN.customerId,
      customerName: createdCN.customer.name,
      amountMinor: createdCN.amountMinor,
      reason: createdCN.reason,
      status: createdCN.status,
      createdAt: createdCN.createdAt.toISOString(),
    };
  }
}

export const billingService = new BillingService();
