import React from 'react';
import { DollarSign, ShieldCheck, TrendingUp, TrendingDown, Layers, Target, Award } from 'lucide-react';
import { FinancialSummaryDTO, MarginRealizationDTO } from '../types/api';

interface CommercialEconomicsProps {
  financials: FinancialSummaryDTO | null;
  marginRealization?: MarginRealizationDTO | null;
  isEvaluating?: boolean;
}

export const CommercialEconomics: React.FC<CommercialEconomicsProps> = ({
  financials,
  marginRealization,
  isEvaluating = false,
}) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);

  if (!financials) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Live Deal Economics</span>
        </div>
        <div className="py-8 text-center text-xs text-slate-500">
          {isEvaluating ? 'Evaluating commercial risk...' : 'Configure deal inputs to view authoritative server economics.'}
        </div>
      </div>
    );
  }

  const isMarginHealthy = financials.marginPercentage >= 30;

  const mriVal = marginRealization?.marginRealizationPercent ?? 0;
  const isMriOptimal = mriVal >= 100;
  const isMriAcceptable = mriVal >= 80;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 relative overflow-hidden">
      {isEvaluating && (
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center z-10">
          <div className="flex items-center gap-2 bg-blue-900/90 text-blue-200 text-xs px-3 py-1.5 rounded-full border border-blue-500/40 shadow-lg animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>Evaluating commercial risk...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Live Deal Economics & MRI</span>
        </div>
        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Server Authoritative
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Gross Revenue */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Gross List Revenue</div>
          <div className="text-base font-bold text-white mt-0.5">
            {formatCurrency(financials.grossRevenue)}
          </div>
        </div>

        {/* Discount Amount */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Commercial Discount</div>
          <div className="text-base font-bold text-amber-400 mt-0.5">
            -{formatCurrency(financials.discountAmount)}
          </div>
        </div>

        {/* Net Revenue */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Net Realized Revenue</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">
            {formatCurrency(financials.netRevenue)}
          </div>
        </div>

        {/* Estimated Cost */}
        <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Estimated Delivery Cost</div>
          <div className="text-base font-bold text-slate-300 mt-0.5">
            {formatCurrency(financials.estimatedCost)}
          </div>
        </div>
      </div>

      {/* Gross Margin & Realized Margin % */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400 font-medium">Authoritative Gross Margin</div>
          <div className="text-xl font-black text-white mt-0.5">
            {formatCurrency(financials.grossMargin)}
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400 font-medium">Realized Margin</div>
          <div
            className={`text-lg font-black flex items-center justify-end gap-1 ${
              isMarginHealthy ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {isMarginHealthy ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{financials.marginPercentage}%</span>
          </div>
        </div>
      </div>

      {/* P0-3 Server-Authoritative Margin Realization Index (MRI) Card */}
      {marginRealization && (
        <div className="bg-gradient-to-br from-purple-950/40 via-slate-950 to-slate-900 p-4 rounded-xl border border-purple-800/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-200 uppercase tracking-wider">
                Margin Realization Index (MRI)
              </span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                isMriOptimal
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : isMriAcceptable
                  ? 'bg-purple-950 text-purple-300 border-purple-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}
            >
              {isMriOptimal ? 'OPTIMAL (≥100%)' : isMriAcceptable ? 'ACCEPTABLE (≥80%)' : 'BELOW TARGET (<80%)'}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="text-2xl font-black text-purple-300 font-mono">
              {marginRealization.marginRealizationPercent.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Realized ({marginRealization.realizedMarginPercent.toFixed(1)}%) vs Target ({marginRealization.requiredTargetMarginPercent.toFixed(1)}%)
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-purple-900/40">
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block">Base Tier Target</span>
              <span className="font-mono font-bold text-slate-300">
                {marginRealization.baseTargetMarginPercent.toFixed(1)}%
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block">Volume Factor</span>
              <span className="font-mono font-bold text-purple-400">
                -{marginRealization.volumeFactorPercent.toFixed(1)}%
              </span>
            </div>
            <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
              <span className="text-slate-500 block">Required Target</span>
              <span className="font-mono font-bold text-emerald-400">
                {marginRealization.requiredTargetMarginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Line item Breakdown Table */}
      {financials.lines.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-slate-900">
          <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            Line-by-Line Commercial Breakdown:
          </div>
          <div className="space-y-1.5">
            {financials.lines.map((line, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs bg-slate-900/40 px-3 py-2 rounded border border-slate-800/60"
              >
                <div className="font-mono text-slate-300">
                  Line {idx + 1}: Qty {line.quantity} × {line.discountPercent}% Disc
                </div>
                <div className="font-semibold text-white">
                  Net: {formatCurrency(line.netTotal)} ({line.lineMarginPercent}% margin)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
