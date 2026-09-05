import React, { useState } from 'react';
import { Package, Plus, Trash2, Search, ChevronDown, Check } from 'lucide-react';
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
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});

  const handleSearchChange = (index: number, term: string) => {
    setSearchTerms((prev) => ({ ...prev, [index]: term }));
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <Package className="w-4 h-4 text-blue-400" />
          <span>Commercial Line Items ({products.length} Products Available)</span>
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
            const searchTerm = (searchTerms[index] || '').toLowerCase().trim();

            const filteredProducts = products.filter(
              (p) =>
                !searchTerm ||
                p.name.toLowerCase().includes(searchTerm) ||
                p.sku.toLowerCase().includes(searchTerm)
            );

            const isDropdownOpen = openDropdownIndex === index;

            return (
              <div
                key={index}
                className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 space-y-3 relative"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Searchable Product Selector */}
                  <div className="flex-1 min-w-[240px] relative">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Product #{index + 1}:
                    </label>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setOpenDropdownIndex(isDropdownOpen ? null : index)}
                      className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-1.5 text-xs flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <span className="truncate">
                        {selectedProduct
                          ? `${selectedProduct.name} (${selectedProduct.sku}) — ₹${selectedProduct.sellingPrice.toLocaleString('en-IN')}`
                          : 'Select a product...'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
                    </button>

                    {/* Bounded Search & Result List Dropdown (Visible Height ~5 items max, scrollable) */}
                    {isDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-2xl z-50 p-2 space-y-2">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            placeholder="Search catalog by name or SKU..."
                            value={searchTerms[index] || ''}
                            onChange={(e) => handleSearchChange(index, e.target.value)}
                            autoFocus
                            className="w-full bg-slate-900 border border-slate-700 text-white rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                        {/* Visible rows max 5 (~180px height limit with overflow-y-auto) */}
                        <div className="max-h-44 overflow-y-auto space-y-1 divide-y divide-slate-800/50 pr-1">
                          {filteredProducts.length === 0 ? (
                            <div className="py-4 text-center text-xs text-slate-500">
                              No products found
                            </div>
                          ) : (
                            filteredProducts.map((p) => {
                              const isSelected = p.id === item.productId;
                              return (
                                <button
                                  type="button"
                                  key={p.id}
                                  onClick={() => {
                                    onUpdateLineItem(index, { productId: p.id });
                                    setOpenDropdownIndex(null);
                                  }}
                                  className={`w-full text-left p-2 rounded text-xs flex items-center justify-between transition-colors ${
                                    isSelected
                                      ? 'bg-blue-600/20 text-blue-300 font-semibold'
                                      : 'hover:bg-slate-900 text-slate-200'
                                  }`}
                                >
                                  <div>
                                    <div className="font-medium text-slate-100">{p.name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {p.sku} | {p.category.code} | {p.billingType}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 ml-2">
                                    <div className="font-mono text-emerald-400 font-bold">
                                      ₹{p.sellingPrice.toLocaleString('en-IN')}
                                    </div>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 ml-auto mt-0.5" />}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
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
                      disabled={disabled}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Remove line item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Category discount violation warning pill */}
                {isCategoryViolation && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-1 flex items-center justify-between text-[11px] text-amber-300">
                    <span>
                      Exceeds {selectedProduct?.category.name} category ceiling (
                      {categoryCeiling}%)
                    </span>
                    <span className="font-semibold text-amber-400">Requires Approval</span>
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
