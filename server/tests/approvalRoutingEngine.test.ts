import { describe, expect, it } from 'vitest';
import { approvalRoutingEngine } from '../src/domain/approval/approvalRoutingEngine';
import { InvalidStateTransitionError, RiskEvaluationResult } from '../src/domain/types';

describe('ApprovalRoutingEngine Unit Tests', () => {
  it('1. routes LOW risk deal to AUTO_APPROVED', () => {
    const lowRisk: RiskEvaluationResult = {
      riskScore: 0,
      riskLevel: 'LOW',
      triggeredRules: [],
      reasons: [],
      requiresApproval: false,
      requiredApprovalRole: null,
    };

    const decision = approvalRoutingEngine.determineDecision(lowRisk, []);

    expect(decision.quoteStatus).toBe('AUTO_APPROVED');
    expect(decision.canAutoApprove).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });

  it('2. routes MEDIUM/HIGH risk deal to PENDING_APPROVAL with SALES_MANAGER requirement', () => {
    const highRisk: RiskEvaluationResult = {
      riskScore: 65,
      riskLevel: 'HIGH',
      triggeredRules: [],
      reasons: ['Tier ceiling exceeded'],
      requiresApproval: true,
      requiredApprovalRole: 'SALES_MANAGER',
    };

    const decision = approvalRoutingEngine.determineDecision(highRisk, []);

    expect(decision.quoteStatus).toBe('PENDING_APPROVAL');
    expect(decision.canAutoApprove).toBe(false);
    expect(decision.requiredRole).toBe('SALES_MANAGER');
  });

  it('3. permits valid approval transition by authorized manager', () => {
    expect(() =>
      approvalRoutingEngine.validateTransition('PENDING_APPROVAL', 'APPROVED', {
        actorRole: 'SALES_MANAGER',
      })
    ).not.toThrow();
  });

  it('4. rejects approval attempt by unauthorized role (e.g. SALES_REP)', () => {
    expect(() =>
      approvalRoutingEngine.validateTransition('PENDING_APPROVAL', 'APPROVED', {
        actorRole: 'SALES_REP',
      })
    ).toThrow(InvalidStateTransitionError);
  });

  it('5. rejects invalid direct transition from REJECTED to APPROVED without term modification', () => {
    expect(() =>
      approvalRoutingEngine.validateTransition('REJECTED', 'APPROVED', {
        termsModified: false,
        actorRole: 'SALES_MANAGER',
      })
    ).toThrow(InvalidStateTransitionError);
  });

  it('6. permits re-evaluation transition from APPROVED to PENDING_APPROVAL when terms are modified', () => {
    expect(() =>
      approvalRoutingEngine.validateTransition('APPROVED', 'PENDING_APPROVAL', {
        termsModified: true,
      })
    ).not.toThrow();
  });
});
