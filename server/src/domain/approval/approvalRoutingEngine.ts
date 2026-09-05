import {
  ApprovalDecision,
  ApprovalRuleDomain,
  InvalidStateTransitionError,
  QuoteStatus,
  RiskEvaluationResult,
} from '../types';

export class ApprovalRoutingEngine {
  /**
   * Determines the initial approval decision and status for a quote based on risk evaluation results.
   */
  public determineDecision(
    riskResult: RiskEvaluationResult,
    _approvalRules: ApprovalRuleDomain[]
  ): ApprovalDecision {
    if (!riskResult.requiresApproval) {
      return {
        quoteStatus: 'AUTO_APPROVED',
        requiresApproval: false,
        requiredRole: null,
        reasons: ['Quote complies with all commercial policies and margin thresholds. Auto-approved.'],
        canAutoApprove: true,
      };
    }

    return {
      quoteStatus: 'PENDING_APPROVAL',
      requiresApproval: true,
      requiredRole: riskResult.requiredApprovalRole ?? 'SALES_MANAGER',
      reasons: riskResult.reasons,
      canAutoApprove: false,
    };
  }

  /**
   * Validates state transitions in the DealFlow360 approval lifecycle.
   * Throws InvalidStateTransitionError if the transition is prohibited.
   */
  public validateTransition(
    currentStatus: QuoteStatus,
    targetStatus: QuoteStatus,
    options?: { termsModified?: boolean; actorRole?: string }
  ): void {
    const termsModified = options?.termsModified ?? false;
    const actorRole = options?.actorRole;

    // 1. Same state transition
    if (currentStatus === targetStatus) return;

    // 2. DRAFT / EVALUATED state transitions
    if (currentStatus === 'DRAFT' || currentStatus === 'EVALUATED') {
      if (
        targetStatus === 'EVALUATED' ||
        targetStatus === 'AUTO_APPROVED' ||
        targetStatus === 'PENDING_APPROVAL'
      ) {
        return;
      }
      throw new InvalidStateTransitionError(
        currentStatus,
        targetStatus,
        'Quotes in DRAFT/EVALUATED can only transition to AUTO_APPROVED or PENDING_APPROVAL.'
      );
    }

    // 3. PENDING_APPROVAL state transitions
    if (currentStatus === 'PENDING_APPROVAL') {
      if (targetStatus === 'APPROVED' || targetStatus === 'REJECTED') {
        if (actorRole !== 'SALES_MANAGER' && actorRole !== 'FINANCE_APPROVER') {
          throw new InvalidStateTransitionError(
            currentStatus,
            targetStatus,
            'Only authorized approvers (SALES_MANAGER or FINANCE_APPROVER) can approve or reject quotes.'
          );
        }
        return;
      }
      if (targetStatus === 'REVISION_REQUIRED' && termsModified) {
        return;
      }
      throw new InvalidStateTransitionError(
        currentStatus,
        targetStatus,
        'Pending approval quotes can only be APPROVED or REJECTED by an authorized approver.'
      );
    }

    // 4. APPROVED state transitions (Post-approval governance re-evaluation)
    if (currentStatus === 'APPROVED') {
      if (termsModified && (targetStatus === 'REVISION_REQUIRED' || targetStatus === 'PENDING_APPROVAL' || targetStatus === 'AUTO_APPROVED')) {
        return; // Valid post-approval term modification re-evaluation
      }
      throw new InvalidStateTransitionError(
        currentStatus,
        targetStatus,
        'Approved quotes can only undergo re-evaluation when commercial terms are modified.'
      );
    }

    // 5. REJECTED state transitions
    if (currentStatus === 'REJECTED') {
      if (termsModified && (targetStatus === 'DRAFT' || targetStatus === 'PENDING_APPROVAL' || targetStatus === 'AUTO_APPROVED')) {
        return; // Valid revision re-evaluation
      }
      throw new InvalidStateTransitionError(
        currentStatus,
        targetStatus,
        'Rejected quotes cannot directly transition to APPROVED without a revised term evaluation.'
      );
    }

    // Default rejection for unhandled transitions
    throw new InvalidStateTransitionError(currentStatus, targetStatus);
  }
}

export const approvalRoutingEngine = new ApprovalRoutingEngine();
