import React from 'react';
import { PlayCircle, ShieldCheck, AlertTriangle, Flame } from 'lucide-react';
import { CustomerDTO, ProductDTO, QuoteItemInputDTO } from '../types/api';

interface QuickDemoPresetBarProps {
  customers: CustomerDTO[];
  products: ProductDTO[];
  onApplyPreset: (customerId: string, items: QuoteItemInputDTO[]) => void;
  disabled?: boolean;
}

export const QuickDemoPresetBar: React.FC<QuickDemoPresetBarProps> = ({
  customers,
  products,
  onApplyPreset,
  disabled = false,
}) => {
  const acmeCustomer = customers.find((c) => c.name.toLowerCase().includes('acme')) || customers[0];
  const bluepeakCustomer = customers.find((c) => c.name.toLowerCase().includes('bluepeak')) || customers[0];

  const serverProduct = products.find((p) => p.sku.includes('HW-SRV')) || products[0];
  const serviceProduct = products.find((p) => p.sku.includes('SV-IMP')) || products[1] || products[0];

  // Preset 1: Compliant Deal (Gold Tier Acme + Server @ 10% discount, ceiling is 15%)
  const handleCompliantPreset = () => {
    if (!acmeCustomer || !serverProduct) return;
    onApplyPreset(acmeCustomer.id, [
      {
        productId: serverProduct.id,
        quantity: 1,
        discountPercent: 10,
      },
    ]);
  };

  // Preset 2: Tier Violation (Gold Tier Acme + Server @ 18% discount, ceiling is 15%)
  const handleTierViolationPreset = () => {
    if (!acmeCustomer || !serverProduct) return;
    onApplyPreset(acmeCustomer.id, [
      {
        productId: serverProduct.id,
        quantity: 1,
        discountPercent: 18,
      },
    ]);
  };

  // Preset 3: Critical Margin Erosion (Bronze BluePeak + Server @ 22% + Service @ 18%)
  const handleMarginErosionPreset = () => {
    if (!bluepeakCustomer || !serverProduct) return;
    onApplyPreset(bluepeakCustomer.id, [
      {
        productId: serverProduct.id,
        quantity: 2,
        discountPercent: 22,
      },
      {
        productId: serviceProduct.id,
        quantity: 1,
        discountPercent: 18,
      },
    ]);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="bg-blue-600/20 text-blue-400 p-1.5 rounded-lg border border-blue-500/30">
          <PlayCircle className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-white">Interactive Wow Presets</div>
          <div className="text-[11px] text-slate-400">
            One-click scenarios to demonstrate live engine governance transitions.
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCompliantPreset}
          disabled={disabled || !acmeCustomer}
          className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          1. Compliant Deal (10% Disc)
        </button>

        <button
          type="button"
          onClick={handleTierViolationPreset}
          disabled={disabled || !acmeCustomer}
          className="flex items-center gap-1.5 text-xs font-semibold bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          2. Tier Violation (18% Disc)
        </button>

        <button
          type="button"
          onClick={handleMarginErosionPreset}
          disabled={disabled || !bluepeakCustomer}
          className="flex items-center gap-1.5 text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Flame className="w-3.5 h-3.5 text-red-400" />
          3. Margin Erosion (22% Disc)
        </button>
      </div>
    </div>
  );
};
