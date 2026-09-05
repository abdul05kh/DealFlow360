import React from 'react';
import { Lightbulb, ArrowUpRight, PlusCircle } from 'lucide-react';
import { RecommendationResultDTO } from '../types/api';

interface RecommendationsCardProps {
  recommendations: RecommendationResultDTO[];
  onAddRecommendation?: (productId: string) => void;
  disabled?: boolean;
}

export const RecommendationsCard: React.FC<RecommendationsCardProps> = ({
  recommendations,
  onAddRecommendation,
  disabled = false,
}) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <span>Cross-Sell & Commercial Recommendations</span>
        </div>
        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 font-semibold">
          Engine Intelligence
        </span>
      </div>

      {recommendations.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
          No cross-sell recommendations triggered for current product selection.
        </div>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => (
            <div
              key={rec.ruleId}
              className="bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{rec.recommendedProduct.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({rec.recommendedProduct.sku})
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">{rec.reason}</p>
                </div>
                {onAddRecommendation && (
                  <button
                    type="button"
                    onClick={() => onAddRecommendation(rec.recommendedProduct.id)}
                    disabled={disabled}
                    className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-lg transition-colors shrink-0 disabled:opacity-50"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add Deal
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
                <div className="text-slate-400 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Projected Revenue:</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(rec.projectedNetRevenue)}
                  </span>
                </div>
                <div className="text-slate-400 flex items-center gap-1">
                  <span>Projected Margin:</span>
                  <span className="font-bold text-emerald-400">
                    {rec.projectedMarginPercent}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
