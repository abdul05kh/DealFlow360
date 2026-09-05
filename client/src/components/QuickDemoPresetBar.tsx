import React from 'react';
import { PlayCircle, ShieldCheck, AlertTriangle, Flame, Truck, Layers, PackageX } from 'lucide-react';
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

  // Flow A Preset 1: Compliant Deal (Gold Tier Acme + Server @ 10% discount)
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

  // Flow A Preset 2: Tier Violation (Gold Tier Acme + Server @ 18% discount)
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

  // Flow A Preset 3: Critical Margin Erosion (Bronze BluePeak + Server @ 22% + Service @ 18%)
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

  // Flow B Preset 1: Full Fulfillment (4 Servers)
  const handleFullFulfillmentPreset = () => {
    if (!acmeCustomer || !serverProduct) return;
    onApplyPreset(acmeCustomer.id, [
      {
        productId: serverProduct.id,
        quantity: 4,
        discountPercent: 5,
      },
    ]);
  };

  // Flow B Preset 2: Split Fulfillment (7 Servers)
  const handleSplitFulfillmentPreset = () => {
    if (!acmeCustomer || !serverProduct) return;
    onApplyPreset(acmeCustomer.id, [
      {
        productId: serverProduct.id,
        quantity: 7,
        discountPercent: 5,
      },
    ]);
  };

  // Flow B Preset 3: Backorder (10 Servers)
  const handleBackorderPreset = () => {
    if (!acmeCustomer || !serverProduct) return;
    onApplyPreset(acmeCustomer.id, [
      {
        productId: serverProduct.id,
        quantity: 10,
        discountPercent: 5,
      },
    ]);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600/20 text-blue-400 p-1.5 rounded-lg border border-blue-500/30">
            <PlayCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Interactive Demo Presets</div>
            <div className="text-[11px] text-slate-400">
              One-click product/quantity configurations for Flow A Governance & Flow B Fulfillment testing.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Flow A Presets */}
          <span className="text-[10px] uppercase font-mono text-slate-500 mr-1">Flow A:</span>
          <button
            type="button"
            onClick={handleCompliantPreset}
            disabled={disabled || !acmeCustomer}
            className="flex items-center gap-1 text-xs font-semibold bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Compliant (10%)
          </button>

          <button
            type="button"
            onClick={handleTierViolationPreset}
            disabled={disabled || !acmeCustomer}
            className="flex items-center gap-1 text-xs font-semibold bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Tier Disc (18%)
          </button>

          <button
            type="button"
            onClick={handleMarginErosionPreset}
            disabled={disabled || !bluepeakCustomer}
            className="flex items-center gap-1 text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <Flame className="w-3.5 h-3.5 text-red-400" />
            Margin Erosion
          </button>

          {/* Flow B Presets */}
          <span className="text-[10px] uppercase font-mono text-slate-500 mx-1">Flow B:</span>
          <button
            type="button"
            onClick={handleFullFulfillmentPreset}
            disabled={disabled || !acmeCustomer}
            className="flex items-center gap-1 text-xs font-semibold bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 border border-blue-800/60 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <Truck className="w-3.5 h-3.5 text-blue-400" />
            Full Fill (4 Qty)
          </button>

          <button
            type="button"
            onClick={handleSplitFulfillmentPreset}
            disabled={disabled || !acmeCustomer}
            className="flex items-center gap-1 text-xs font-semibold bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            Split Fill (7 Qty)
          </button>

          <button
            type="button"
            onClick={handleBackorderPreset}
            disabled={disabled || !acmeCustomer}
            className="flex items-center gap-1 text-xs font-semibold bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            <PackageX className="w-3.5 h-3.5 text-red-400" />
            Backorder (10 Qty)
          </button>
        </div>
      </div>
    </div>
  );
};
