import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileText,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  MessageSquare,
  DollarSign,
  Tag,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { CustomerQuoteDTO, CustomerQuoteLineDTO, CustomerNegotiationDTO } from '../../types/api';
import { HybridBillingCard } from '../HybridBillingCard';

interface CustomerPortalViewProps {
  apiConnected: boolean;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({ apiConnected }) => {
  const [quotes, setQuotes] = useState<CustomerQuoteDTO[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<CustomerQuoteDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Counter-offer state
  const [counterDiscounts, setCounterDiscounts] = useState<Record<string, number>>({});
  const [customerNote, setCustomerNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    fetchQuotes();
  }, [apiConnected]);

  // REST polling for Customer Portal lifecycle status synchronization
  useEffect(() => {
    let isCancelled = false;
    let isRequestInFlight = false;

    const intervalId = setInterval(async () => {
      if (isCancelled || isRequestInFlight) return;
      isRequestInFlight = true;
      try {
        const data = await apiClient.getCustomerQuotes();
        if (!isCancelled && data) {
          setQuotes(data);
          if (selectedQuote) {
            const updated = data.find((q) => q.id === selectedQuote.id);
            if (updated && (updated.status !== selectedQuote.status || updated.lines.length !== selectedQuote.lines.length)) {
              setSelectedQuote(updated);
            }
          }
        }
      } catch (err) {
        // Silent catch during background polling
      } finally {
        isRequestInFlight = false;
      }
    }, 4000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [selectedQuote?.id, selectedQuote?.status]);

  const fetchQuotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getCustomerQuotes();
      setQuotes(data);
      if (data.length > 0 && !selectedQuote) {
        setSelectedQuote(data[0]);
        initializeCounterOffer(data[0]);
      } else if (selectedQuote) {
        const updated = data.find((q) => q.id === selectedQuote.id);
        if (updated) {
          setSelectedQuote(updated);
          initializeCounterOffer(updated);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load customer quotes');
    } finally {
      setLoading(false);
    }
  };

  const initializeCounterOffer = (quote: CustomerQuoteDTO) => {
    const initialDiscounts: Record<string, number> = {};
    quote.lines.forEach((line) => {
      initialDiscounts[line.id] = line.offeredDiscountPercent;
    });
    setCounterDiscounts(initialDiscounts);
    setCustomerNote('');
  };

  const handleSelectQuote = (quote: CustomerQuoteDTO) => {
    setSelectedQuote(quote);
    initializeCounterOffer(quote);
    setSuccessMessage(null);
    setError(null);
  };

  const handleDiscountChange = (lineId: string, value: number) => {
    setCounterDiscounts((prev) => ({
      ...prev,
      [lineId]: Math.min(100, Math.max(0, value)),
    }));
  };

  const handleSubmitCounterOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Build counter offer lines for lines where requested discount differs
      const lines = selectedQuote.lines.map((line) => ({
        quoteLineId: line.id,
        requestedDiscount: counterDiscounts[line.id] ?? line.offeredDiscountPercent,
      }));

      const updatedQuote = await apiClient.submitNegotiation(selectedQuote.id, {
        customerNote: customerNote.trim() || undefined,
        lines,
      });

      setSelectedQuote(updatedQuote);
      initializeCounterOffer(updatedQuote);
      setSuccessMessage('Counter-offer submitted successfully! Terms re-evaluated by server governance.');
      fetchQuotes();
    } catch (err: any) {
      setError(err.message || 'Failed to submit counter-offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'AUTO_APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Approved
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-950/80 border border-amber-700/60 text-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Under Manager Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-950/80 border border-rose-700/60 text-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-950/80 border border-blue-700/60 text-blue-300">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            {status}
          </span>
        );
    }
  };

  const formatCurrency = (val: number, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency === 'INR' ? 'INR' : 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  if (loading && quotes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-slate-400 font-medium">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Loading Customer Portal Quotes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-indigo-950/80 border border-cyan-800/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-48 h-48 bg-cyan-600/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-cyan-900/60 text-cyan-300 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-cyan-700/50">
                P0-4 Customer Portal
              </span>
              <span className="text-xs text-slate-400 font-mono">Sanitized DTO Mode</span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">Customer Quote & Counter-Offer Hub</h2>
            <p className="text-sm text-slate-300 mt-1">
              Review authoritative quotations, inspect offer details, and negotiate line-item discounts directly.
            </p>
          </div>
          <button
            onClick={fetchQuotes}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Quotes
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Grid: Sidebar + Details/Counter-Offer Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Quote List Sidebar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              Your Quotes ({quotes.length})
            </h3>
          </div>

          {quotes.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">No quotes available for your organization.</div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {quotes.map((q) => {
                const isSelected = selectedQuote?.id === q.id;
                return (
                  <div
                    key={q.id}
                    onClick={() => handleSelectQuote(q)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-950/60 to-slate-900 border-cyan-500/50 shadow-md shadow-cyan-950/20'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono font-bold text-cyan-300 text-sm">{q.quoteNumber}</span>
                      {getStatusBadge(q.status)}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{q.lines.length} Item(s)</span>
                      <span className="font-bold text-white">{formatCurrency(q.totalNetRevenue, q.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Selected Quote Detail + Counter Offer Workspace */}
        {selectedQuote ? (
          <div className="lg:col-span-2 space-y-6">
            {/* Quote Header Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-white tracking-tight">{selectedQuote.quoteNumber}</h3>
                    {getStatusBadge(selectedQuote.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Issued: {new Date(selectedQuote.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 uppercase font-semibold">Total Offered Amount</div>
                  <div className="text-2xl font-black text-emerald-400">
                    {formatCurrency(selectedQuote.totalNetRevenue, selectedQuote.currency)}
                  </div>
                </div>
              </div>

              {/* Financial Summary Pill Bar */}
              <div className="grid grid-cols-3 gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">Gross List Price</div>
                  <div className="text-base font-bold text-slate-200">
                    {formatCurrency(selectedQuote.totalOfferedGross, selectedQuote.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Offered Savings</div>
                  <div className="text-base font-bold text-cyan-400">
                    {formatCurrency(selectedQuote.totalOfferedDiscount, selectedQuote.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Net Payable</div>
                  <div className="text-base font-bold text-emerald-400">
                    {formatCurrency(selectedQuote.totalNetRevenue, selectedQuote.currency)}
                  </div>
                </div>
              </div>

              {/* Hybrid Billing Overview */}
              <HybridBillingCard
                quoteId={selectedQuote.id}
                quoteStatus={selectedQuote.status}
                onBillingGenerated={fetchQuotes}
              />

              {/* Offered Lines Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Offered Line Items ({selectedQuote.lines.length})
                </h4>
                <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Product</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Unit Price</th>
                        <th className="p-3 text-right">Discount</th>
                        <th className="p-3 text-right">Net Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedQuote.lines.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-900/40">
                          <td className="p-3 font-semibold text-white">
                            <div>{line.productName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{line.sku}</div>
                          </td>
                          <td className="p-3 text-right text-slate-300 font-mono">{line.quantity}</td>
                          <td className="p-3 text-right text-slate-300 font-mono">
                            {formatCurrency(line.offeredUnitPrice, selectedQuote.currency)}
                          </td>
                          <td className="p-3 text-right">
                            <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-400 font-mono font-bold border border-blue-800/40">
                              {line.offeredDiscountPercent}%
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(line.offeredLineTotal, selectedQuote.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Counter-Offer Negotiation Workspace */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Send className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Submit Line-Item Counter-Offer</h3>
              </div>

              <form onSubmit={handleSubmitCounterOffer} className="space-y-4">
                <p className="text-xs text-slate-400">
                  Specify requested discount percentage per line item. Unchanged lines retain existing terms.
                </p>

                <div className="space-y-3">
                  {selectedQuote.lines.map((line) => {
                    const currentRequested = counterDiscounts[line.id] ?? line.offeredDiscountPercent;
                    return (
                      <div
                        key={line.id}
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{line.productName}</div>
                          <div className="text-xs text-slate-400">
                            Qty: {line.quantity} | Current Offered Discount: {line.offeredDiscountPercent}%
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-300 font-semibold">Requested Discount (%):</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={currentRequested}
                            onChange={(e) => handleDiscountChange(line.id, parseFloat(e.target.value) || 0)}
                            className="w-24 px-3 py-1.5 bg-slate-900 border border-cyan-800/60 rounded-lg text-white font-mono font-bold text-sm focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Customer Note / Context (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="E.g., Budget ceiling constraint for Q4 software rollout..."
                    className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/50 border border-cyan-400/30 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>{isSubmitting ? 'Evaluating Offer...' : 'Submit Counter-Offer'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Negotiation History Rounds */}
            {selectedQuote.negotiationHistory && selectedQuote.negotiationHistory.length > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <MessageSquare className="w-5 h-5 text-indigo-400" />
                  Negotiation History ({selectedQuote.negotiationHistory.length} Round(s))
                </h3>

                <div className="space-y-4">
                  {selectedQuote.negotiationHistory.map((round) => (
                    <div
                      key={round.id}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-300">Round {round.round}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(round.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {getStatusBadge(round.status)}
                      </div>

                      {round.customerNote && (
                        <div className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                          <span className="font-semibold text-cyan-400">Customer Note:</span> "{round.customerNote}"
                        </div>
                      )}

                      {round.customerResponseNote && (
                        <div className="text-xs text-slate-300 bg-indigo-950/50 p-2.5 rounded-lg border border-indigo-800/50">
                          <span className="font-semibold text-indigo-400">Sales Response:</span> "{round.customerResponseNote}"
                        </div>
                      )}

                      <div className="text-xs">
                        <span className="text-slate-400 font-medium">Requested Line Item Discounts:</span>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {round.lines.map((l, idx) => {
                            const matchedLine = selectedQuote.lines.find((ql) => ql.id === l.quoteLineId);
                            return (
                              <span
                                key={idx}
                                className="px-2 py-1 rounded bg-slate-900 text-slate-300 text-[11px] font-mono border border-slate-800"
                              >
                                {matchedLine?.productName || 'Line'}:{' '}
                                <strong className="text-cyan-400">{l.requestedDiscountPercent}%</strong>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 flex items-center justify-center p-12 bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-500 text-sm">
            Select a quote from the left list to view details and submit counter-offers.
          </div>
        )}
      </div>
    </div>
  );
};
