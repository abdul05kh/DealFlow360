import React from 'react';
import { Package, Plus, Trash2, AlertCircle } from 'lucide-react';
import { ProductDTO, QuoteItemInputDTO } from '../types/api';

interface QuoteLineItemsProps {
  products: ProductDTO[];
  lineItems: QuoteItemInputDTO[];
  onAddLineItem: () => void;
  onUpdateLineItem: (index: number, patch: Partial<QuoteItemInputDTO>) => void;
  onRemoveLineItem: (index: number) => void;
  disabled?: boolean;
}

export const QuoteLineItems: React.FC<QuoteLineItemsProps> = ({
  products,
  lineItems,
  onAddLineItem,
  onUpdateLineItem,
  onRemoveLineItem,
  disabled = false,
}) => {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Package className="w-4 h-4 text-blue-400" />
          <span>Commercial Line Items</span>
        </div>
        <button
          type="button"
          onClick={onAddLineItem}
          disabled={disabled || products.length === 0}
          className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Item
        </button>
      </div>

      {lineItems.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
          No line items added. Click "Add Item" to add products to this quote.
        </div>
      ) : (
        <div className="space-y-3">
          {lineItems.map((item, index) => {
            const selectedProduct = products.find((p) => p.id === item.productId);
            const categoryCeiling = selectedProduct?.category.maxCategoryDiscount ?? 100;
            const isCategoryViolation = item.discountPercent > categoryCeiling;

            return (
              <div
                key={index}
                className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Product selector */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Product #{index + 1}:
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => onUpdateLineItem(index, { productId: e.target.value })}
                      disabled={disabled}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — ₹{p.sellingPrice.toLocaleString('en-IN')} [{p.category.code}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="w-24">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Qty:
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateLineItem(index, {
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      disabled={disabled}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-2.5 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Discount % */}
                  <div className="w-32">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-medium text-slate-400">
                        Discount:
                      </label>
                      <span
                        className={`text-[11px] font-bold ${
                          isCategoryViolation ? 'text-amber-400' : 'text-blue-400'
                        }`}
                      >
                        {item.discountPercent}%
                      </span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discountPercent}
                      onChange={(e) =>
                        onUpdateLineItem(index, {
                          discountPercent: Math.max(
                            0,
                            Math.min(100, parseFloat(e.target.value) || 0)
                          ),
                        })
                      }
                      disabled={disabled}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-2.5 py-1.5 text-xs text-center font-bold focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="flex items-end pb-0.5">
                    <button
                      type="button"
                      onClick={() => onRemoveLineItem(index)}
                      disabled={disabled || lineItems.length <= 1}
                      title="Remove line item"
                      className="p-1.5 text-slate-400 hover:text-red-400 rounded-md hover:bg-slate-800 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Range Slider for Quick Adjustment */}
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={item.discountPercent}
                    onChange={(e) =>
                      onUpdateLineItem(index, {
                        discountPercent: parseFloat(e.target.value),
                      })
                    }
                    disabled={disabled}
                    className="flex-1 h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Category Ceiling Warning */}
                {isCategoryViolation && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Exceeds {selectedProduct?.category.name} ceiling of {categoryCeiling}%. Evaluator will trigger risk penalty.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
