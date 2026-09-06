import React from 'react';
import { Building2, PackageCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { WarehouseDTO } from '../types/api';

interface WarehouseAvailabilityCardProps {
  warehouses: WarehouseDTO[];
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

export const WarehouseAvailabilityCard: React.FC<WarehouseAvailabilityCardProps> = ({
  warehouses,
  isLoading,
  error,
  onRefresh,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg animate-pulse text-xs text-slate-400">
        Loading distribution warehouse inventory stock levels from server...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-xl flex items-center gap-3 text-red-200 text-sm">
        <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        <div>
          <div className="font-bold">Warehouse Stock Load Warning</div>
          <div className="text-xs text-red-300">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-600/20 text-emerald-400 p-2 rounded-lg border border-emerald-500/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Live Distribution Warehouses
              <span className="bg-emerald-950 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded border border-emerald-800/50">
                Authoritative Inventory
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Real-time stock on hand and reserved units across active hubs.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Stock
            </button>
          )}
          <div className="text-xs text-slate-400 font-mono">
            {warehouses.length} Active Hubs
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {warehouses.map((wh) => (
          <div
            key={wh.id}
            className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-lg p-3.5 space-y-2 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono font-bold text-xs text-blue-400 bg-blue-950/80 border border-blue-800/50 px-2 py-0.5 rounded">
                  {wh.code}
                </span>
                <div className="text-xs font-bold text-white mt-1">{wh.name}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-mono">Ship Fee</div>
                <div className="text-xs font-bold text-slate-200">₹{wh.baseShippingCost}</div>
              </div>
            </div>

            <div className="border-t border-slate-800/60 pt-2 space-y-1.5">
              {wh.stocks.map((stock) => {
                const available = Math.max(0, stock.quantityOnHand - stock.quantityReserved);
                const isOutOfStock = available === 0;

                return (
                  <div
                    key={stock.id}
                    className="flex items-center justify-between text-xs py-0.5"
                  >
                    <span className="text-slate-300 truncate max-w-[130px]" title={stock.product?.name}>
                      {stock.product?.name || stock.productId}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">
                        ({stock.quantityOnHand} total)
                      </span>
                      <span
                        className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          isOutOfStock
                            ? 'bg-red-950 text-red-400 border border-red-800/50'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                        }`}
                      >
                        {available} avail
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
