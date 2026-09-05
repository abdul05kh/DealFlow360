import React from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Scale, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { FullQuoteEvaluationDTO, QuoteStatus } from '../types/api';

interface GovernanceRiskRadarProps {
  evaluation: FullQuoteEvaluationDTO | null;
  savedQuoteStatus?: QuoteStatus;
  isEvaluating?: boolean;
}

export const GovernanceRiskRadar: React.FC<GovernanceRiskRadarProps> = ({
  evaluation,
  savedQuoteStatus,
  isEvaluating = false,
}) => {
  if (!evaluation) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          <span>Discount Governance & Risk Assessment</span>
        </div>
        <div className="py-8 text-center text-xs text-slate-500">
          {isEvaluating ? 'Evaluating governance rules...' : 'Configure deal inputs to execute live risk assessment.'}
        </div>
      </div>
    );
  }

  const { risk, governance, decision } = evaluation;
  const currentStatus = savedQuoteStatus || decision.quoteStatus;

  const getRiskLevelBadge = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    switch (level) {
      case 'LOW':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'HIGH':
        return 'bg-red-500/15 text-red-300 border-red-500/30';
    }
  };

  const getStatusDisplay = (status: QuoteStatus) => {
    switch (status) {
      case 'AUTO_APPROVED':
        return {
          label: 'Auto Approved',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          style: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        };
      case 'PENDING_APPROVAL':
        return {
          label: 'Manager Approval Required',
          icon: <Clock className="w-4 h-4 text-amber-400" />,
          style: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        };
      case 'APPROVED':
        return {
          label: 'Approved by Manager',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
          style: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50',
        };
      case 'REJECTED':
        return {
          label: 'Rejected by Manager',
          icon: <XCircle className="w-4 h-4 text-red-400" />,
          style: 'bg-red-500/20 text-red-200 border-red-400/50',
        };
      default:
        return {
          label: status,
          icon: <CheckCircle2 className="w-4 h-4 text-blue-400" />,
          style: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
        };
    }
  };

  const statusInfo = getStatusDisplay(currentStatus);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <ShieldAlert className="w-4 h-4 text-purple-400" />
          <span>Discount Governance & Risk Radar</span>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1 rounded-full border flex items-center gap-1.5 ${statusInfo.style}`}
        >
          {statusInfo.icon}
          {statusInfo.label}
        </span>
      </div>

      {/* Risk Score & Bounding Bar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1">
            <Scale className="w-3.5 h-3.5 text-blue-400" />
            Composite Risk Score:
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`font-bold px-2 py-0.5 rounded text-xs border ${getRiskLevelBadge(
                risk.riskLevel
              )}`}
            >
              {risk.riskLevel} RISK ({risk.riskScore} / 100)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
          <div
            className={`h-full transition-all duration-300 ${
              risk.riskScore < 30
                ? 'bg-emerald-500'
                : risk.riskScore < 60
                ? 'bg-amber-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, risk.riskScore))}%` }}
          />
        </div>
      </div>

      {/* Triggered Governance Rules */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400 flex items-center justify-between">
          <span>Triggered Governance Violations / Policy Events:</span>
          <span className="text-slate-500 font-mono text-[11px]">
            {risk.triggeredRules.length} Rule(s) Triggered
          </span>
        </div>

        {risk.triggeredRules.length === 0 ? (
          <div className="bg-emerald-950/20 border border-emerald-900/40 p-3 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Compliant Deal — All discounts and margins satisfy customer tier guidelines.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {risk.triggeredRules.map((rule, index) => (
              <div
                key={index}
                className="bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${
                        rule.severity === 'HIGH'
                          ? 'text-red-400'
                          : rule.severity === 'MEDIUM'
                          ? 'text-amber-400'
                          : 'text-blue-400'
                      }`}
                    />
                    {rule.ruleName}
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      rule.severity === 'HIGH'
                        ? 'bg-red-500/10 text-red-300 border-red-500/20'
                        : rule.severity === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                    }`}
                  >
                    +{rule.penaltyPoints} Risk Pts
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">{rule.reason}</p>
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-3 pt-1">
                  <span>Actual: {rule.actualValue}%</span>
                  <span>Threshold Limit: {rule.threshold}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Reasons */}
      {decision.reasons.length > 0 && (
        <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
          <div className="font-medium text-slate-300">Engine Decision Basis:</div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[11px]">
            {decision.reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
