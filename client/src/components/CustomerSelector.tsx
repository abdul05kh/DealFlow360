import React from 'react';
import { Building2, ShieldCheck, Percent, Scale } from 'lucide-react';
import { CustomerDTO } from '../types/api';

interface CustomerSelectorProps {
  customers: CustomerDTO[];
  selectedCustomerId: string;
  onSelectCustomer: (id: string) => void;
  disabled?: boolean;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  disabled = false,
}) => {
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const getTierBadgeStyle = (code: string) => {
    switch (code) {
      case 'GOLD':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'SILVER':
        return 'bg-slate-400/15 text-slate-300 border-slate-400/30';
      case 'BRONZE':
        return 'bg-orange-600/15 text-orange-300 border-orange-500/30';
      default:
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Building2 className="w-4 h-4 text-blue-400" />
          <span>Customer & Account Context</span>
        </div>
        {selectedCustomer && (
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getTierBadgeStyle(
              selectedCustomer.tier.code
            )}`}
          >
            {selectedCustomer.tier.name}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="customer-select" className="block text-xs font-medium text-slate-400 mb-1.5">
          Select Customer Account:
        </label>
        <select
          id="customer-select"
          value={selectedCustomerId}
          onChange={(e) => onSelectCustomer(e.target.value)}
          disabled={disabled}
          className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 cursor-pointer"
        >
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.tier.code} Tier — Ceiling: {c.tier.maxOverallDiscount}%)
            </option>
          ))}
        </select>
      </div>

      {selectedCustomer && (
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <Percent className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Tier Overall Ceiling</div>
              <div className="text-sm font-bold text-white">
                {selectedCustomer.tier.maxOverallDiscount}% Max
              </div>
            </div>
          </div>
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Min Margin Floor</div>
              <div className="text-sm font-bold text-white">
                {selectedCustomer.tier.minMarginThreshold}% Floor
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
