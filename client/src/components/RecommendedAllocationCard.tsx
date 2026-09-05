import React from 'react';
import { Truck, CheckCircle2, AlertTriangle, ArrowRight, Settings2 } from 'lucide-react';
import {
  FulfillmentEvaluationResponseDTO,
  FulfillmentItemDTO,
  FulfillmentPlanDTO,
  ManualOverrideItemDTO,
  SavedQuoteDTO,
  WarehouseDTO,
} from '../types/api';

interface RecommendedAllocationCardProps {
  evaluation: FulfillmentEvaluationResponseDTO | null;
  persistedPlan: FulfillmentPlanDTO | null;
  quote: SavedQuoteDTO | null;
  warehouses: WarehouseDTO[];
  manualOverrides: ManualOverrideItemDTO[];
  onSetOverride: (quoteLineId: string, warehouseId: string) => void;
  onClearOverrides: () => void;
  isEvaluating: boolean;
  isOperationsOrManager: boolean;
}

export const RecommendedAllocationCard: React.FC<RecommendedAllocationCardProps> = ({
  evaluation,
  persistedPlan,
  quote,
  warehouses,
  manualOverrides,
  onSetOverride,
  onClearOverrides,
  isEvaluating,
  isOperationsOrManager,
}) => {
  const itemsToDisplay: FulfillmentItemDTO[] = persistedPlan
    ? persistedPlan.items
    : evaluation
    ? evaluation.evaluation.items
    : [];

  const isAlreadyAllocated = Boolean(persistedPlan);

  if (isEvaluating) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg animate-pulse text-xs text-slate-400">
        Simulating multi-warehouse fulfillment allocation engine...
      </div>
    );
  }

  if (!evaluation && !persistedPlan) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg text-center py-8 text-xs text-slate-400">
        Select an APPROVED or AUTO_APPROVED quote to evaluate multi-warehouse fulfillment allocation.
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg border border-blue-500/30">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {isAlreadyAllocated
                ? 'Persisted Fulfillment Plan'
                : 'Server-Recommended Allocation'}
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                  isAlreadyAllocated
                    ? 'bg-purple-950 text-purple-300 border-purple-800/50'
                    : 'bg-blue-950 text-blue-300 border-blue-800/50'
                }`}
              >
                {isAlreadyAllocated ? 'COMMITTED TO DB' : 'SIMULATION ONLY'}
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic single or multi-warehouse shipment splits based on warehouse priority & stock.
            </p>
          </div>
        </div>

        {/* Override reset button if overrides active */}
        {!isAlreadyAllocated && manualOverrides.length > 0 && (
          <button
            type="button"
            onClick={onClearOverrides}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 underline underline-offset-2"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Clear Manual Overrides ({manualOverrides.length})
          </button>
        )}
      </div>

      {/* Item Allocation Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Line Item</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Assigned Warehouse</th>
              <th className="py-2.5 px-3 text-right">Allocated Qty</th>
              <th className="py-2.5 px-3 text-right">Ship Fee</th>
              {isOperationsOrManager && !isAlreadyAllocated && (
                <th className="py-2.5 px-3 text-center">Manual Override</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {itemsToDisplay.map((item, idx) => {
              const quoteLine = quote?.lines.find((l) => l.id === item.quoteLineId);
              const productName = quoteLine?.product.name || item.productId;
              const isBackordered = item.status === 'BACKORDERED';

              // Find current active override if any
              const activeOverride = manualOverrides.find((o) => o.quoteLineId === item.quoteLineId);

              return (
                <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-bold text-white">{productName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Requested: {quoteLine?.quantity || item.allocatedQuantity} units
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    {isBackordered ? (
                      <span className="inline-flex items-center gap-1 bg-red-950/80 text-red-300 border border-red-800/60 font-bold px-2 py-0.5 rounded text-[10px]">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        BACKORDERED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 font-bold px-2 py-0.5 rounded text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        FULFILLED
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-3 font-semibold text-slate-200">
                    {item.warehouseCode ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-blue-300 text-xs font-bold">
                          {item.warehouseCode}
                        </span>
                        <span className="text-[11px] text-slate-400 truncate">
                          {item.warehouse?.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-red-400 font-mono text-xs">Unassigned (Backorder)</span>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-white text-sm">
                    {item.allocatedQuantity}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-semibold text-slate-200">
                    ₹{item.shippingCost}
                  </td>

                  {isOperationsOrManager && !isAlreadyAllocated && (
                    <td className="py-3 px-3 text-center">
                      <select
                        value={activeOverride?.warehouseId || ''}
                        onChange={(e) => onSetOverride(item.quoteLineId, e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">(Server Recommended)</option>
                        {warehouses.map((wh) => (
                          <option key={wh.id} value={wh.id}>
                            {wh.code} — {wh.name} (Ship: ₹{wh.baseShippingCost})
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
