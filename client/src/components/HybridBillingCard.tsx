import React, { useEffect, useState } from 'react';
import { CreditCard, Calendar, FileText, CheckCircle2, AlertCircle, RefreshCw, Ban, DollarSign, XCircle, ArrowRight } from 'lucide-react';
import { BillingSummaryDTO, CreditNoteDTO, InvoiceDTO, SubscriptionDTO } from '../types/api';
import { apiClient } from '../services/api';

interface HybridBillingCardProps {
  quoteId?: string;
  quoteStatus?: string;
  onBillingGenerated?: () => void;
  className?: string;
}

export const HybridBillingCard: React.FC<HybridBillingCardProps> = ({
  quoteId,
  quoteStatus,
  onBillingGenerated,
  className = '',
}) => {
  const [summary, setSummary] = useState<BillingSummaryDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [paying, setPaying] = useState<boolean>(false);
  const [cancellingSubId, setCancellingSubId] = useState<string | null>(null);
  const [showCNForm, setShowCNForm] = useState<boolean>(false);
  const [cnAmountMajor, setCnAmountMajor] = useState<string>('');
  const [cnReason, setCnReason] = useState<string>('');
  const [issuingCN, setIssuingCN] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBillingSummary = async () => {
    if (!quoteId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getBillingSummaryForQuote(quoteId);
      setSummary(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load billing summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quoteId) {
      fetchBillingSummary();
    }
  }, [quoteId]);

  const handleGenerateBilling = async () => {
    if (!quoteId) return;
    try {
      setGenerating(true);
      setError(null);
      const updated = await apiClient.generateBillingForQuote(quoteId);
      setSummary(updated);
      if (onBillingGenerated) {
        onBillingGenerated();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate billing');
    } finally {
      setGenerating(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!summary?.invoice?.id) return;
    try {
      setPaying(true);
      setError(null);
      const updatedInvoice = await apiClient.payInvoice(summary.invoice.id);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              invoice: updatedInvoice,
            }
          : null
      );
      if (onBillingGenerated) {
        onBillingGenerated();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to record payment');
    } finally {
      setPaying(false);
    }
  };

  const handleCancelSubscription = async (subId: string) => {
    try {
      setCancellingSubId(subId);
      setError(null);
      await apiClient.cancelSubscription(subId);
      await fetchBillingSummary();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel subscription');
    } finally {
      setCancellingSubId(null);
    }
  };

  const handleIssueCreditNote = async () => {
    if (!summary?.invoice?.id) return;
    const amountVal = parseFloat(cnAmountMajor);
    if (isNaN(amountVal) || amountVal <= 0) {
      setError('Please enter a valid positive credit note amount.');
      return;
    }
    if (!cnReason.trim()) {
      setError('Please enter a reason for issuing the credit note.');
      return;
    }

    try {
      setIssuingCN(true);
      setError(null);
      const amountMinor = Math.round(amountVal * 100);
      await apiClient.issueCreditNote(summary.invoice.id, amountMinor, cnReason.trim());
      setShowCNForm(false);
      setCnAmountMajor('');
      setCnReason('');
      await fetchBillingSummary();
    } catch (err: any) {
      setError(err?.message || 'Failed to issue credit note');
    } finally {
      setIssuingCN(false);
    }
  };

  const formatMinorCurrency = (minorVal: number, currency = 'INR') => {
    const units = minorVal / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(units);
  };

  if (!quoteId) {
    return (
      <div className={`bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3 ${className}`}>
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>Hybrid Billing & Subscriptions</span>
        </div>
        <div className="py-6 text-center text-xs text-slate-500">
          Save and approve a quote to inspect or generate commercial billing breakdown.
        </div>
      </div>
    );
  }

  const isApproved = quoteStatus === 'APPROVED' || quoteStatus === 'AUTO_APPROVED';
  const isBillingCreated = quoteStatus === 'BILLING_CREATED' || !!summary?.invoice || (summary?.subscriptions && summary.subscriptions.length > 0);

  return (
    <div className={`bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4 relative overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <span>Hybrid Billing Architecture</span>
        </div>
        {isBillingCreated ? (
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Billing Executed
          </span>
        ) : isApproved ? (
          <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-400" />
            Ready for Billing
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
            Pending Approval
          </span>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3 bg-red-950/50 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-white">
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-400">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Loading commercial billing breakdown...</span>
        </div>
      ) : summary ? (
        <div className="space-y-4">
          {/* Hybrid Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Due Now Box */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  Due Now (One-Time)
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Invoice</span>
              </div>
              <div className="text-lg font-bold text-slate-100 font-mono">
                {formatMinorCurrency(summary.dueNow.totalMinor, summary.currency)}
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1 border-t border-slate-800/80">
                <span>Sub: {formatMinorCurrency(summary.dueNow.subtotalMinor, summary.currency)}</span>
                <span>Disc: -{formatMinorCurrency(summary.dueNow.discountMinor, summary.currency)}</span>
              </div>
            </div>

            {/* Recurring Run Rate Box */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  Recurring Run Rate
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Subscription</span>
              </div>
              <div className="text-sm font-bold text-emerald-400 font-mono flex flex-wrap items-center gap-x-2">
                {summary.recurring.monthlyTotalMinor > 0 && (
                  <span>{formatMinorCurrency(summary.recurring.monthlyTotalMinor, summary.currency)}/mo</span>
                )}
                {summary.recurring.quarterlyTotalMinor > 0 && (
                  <span>{formatMinorCurrency(summary.recurring.quarterlyTotalMinor, summary.currency)}/qtr</span>
                )}
                {summary.recurring.annualTotalMinor > 0 && (
                  <span>{formatMinorCurrency(summary.recurring.annualTotalMinor, summary.currency)}/yr</span>
                )}
                {summary.recurring.monthlyTotalMinor === 0 &&
                  summary.recurring.quarterlyTotalMinor === 0 &&
                  summary.recurring.annualTotalMinor === 0 && (
                    <span>{formatMinorCurrency(0, summary.currency)}</span>
                  )}
              </div>
              <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1 border-t border-slate-800/80">
                <span>Mo: {formatMinorCurrency(summary.recurring.monthlyTotalMinor, summary.currency)}</span>
                <span>Qtr: {formatMinorCurrency(summary.recurring.quarterlyTotalMinor, summary.currency)}</span>
                <span>Yr: {formatMinorCurrency(summary.recurring.annualTotalMinor, summary.currency)}</span>
              </div>
            </div>
          </div>

          {/* Generated Artifacts Detail Section */}
          {summary.invoice && (
            <div className="bg-slate-900/40 border border-blue-900/30 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300">
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Invoice: {summary.invoice.invoiceNumber}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      summary.invoice.status === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}
                  >
                    {summary.invoice.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCNForm((prev) => !prev)}
                    className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 transition-all"
                  >
                    Credit Note
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                {summary.invoice.lines.map((line) => (
                  <div key={line.id} className="text-[11px] text-slate-300 flex justify-between items-center py-0.5">
                    <span className="truncate max-w-[200px]">{line.productName} (x{line.quantity})</span>
                    <span className="font-mono text-slate-200">{formatMinorCurrency(line.netTotalMinor, summary.currency)}</span>
                  </div>
                ))}
              </div>

              {/* Credit Notes List */}
              {summary.invoice.creditNotes && summary.invoice.creditNotes.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <div className="text-[10px] font-semibold text-purple-300 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-purple-400" />
                    <span>Issued Credit Notes</span>
                  </div>
                  {summary.invoice.creditNotes.map((cn) => (
                    <div key={cn.id} className="bg-purple-950/30 border border-purple-800/40 rounded p-2 text-[10px] flex justify-between items-center">
                      <div>
                        <span className="font-mono font-bold text-purple-300">{cn.creditNoteNumber}</span>
                        <p className="text-slate-400 text-[9px]">{cn.reason}</p>
                      </div>
                      <span className="font-mono font-bold text-amber-400">
                        -{formatMinorCurrency(cn.amountMinor, summary.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Credit Note Form */}
              {showCNForm && (
                <div className="p-2.5 bg-purple-950/40 border border-purple-800/50 rounded-lg space-y-2 text-xs">
                  <div className="font-semibold text-purple-300 flex items-center justify-between">
                    <span>Issue Internal Credit Note</span>
                    <button type="button" onClick={() => setShowCNForm(false)} className="text-slate-400 hover:text-white">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Amount ({summary.currency})</label>
                      <input
                        type="number"
                        placeholder="e.g. 500"
                        value={cnAmountMajor}
                        onChange={(e) => setCnAmountMajor(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Reason</label>
                      <input
                        type="text"
                        placeholder="e.g. Goodwill discount"
                        value={cnReason}
                        onChange={(e) => setCnReason(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleIssueCreditNote}
                    disabled={issuingCN}
                    className="w-full py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-semibold text-xs transition-all"
                  >
                    {issuingCN ? 'Issuing Credit Note...' : 'Confirm Credit Note'}
                  </button>
                </div>
              )}

              {summary.invoice.status === 'ISSUED' && (
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleRecordPayment}
                    disabled={paying}
                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.99]"
                  >
                    {paying ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin text-white" />
                        <span>Recording Payment...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Record Payment</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {summary.subscriptions.length > 0 && (
            <div className="space-y-2">
              {summary.subscriptions.map((sub) => (
                <div key={sub.id} className="bg-slate-900/40 border border-emerald-900/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sub: {sub.subscriptionNumber} ({sub.billingInterval})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          sub.status === 'CANCELLED'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {sub.status}
                      </span>
                      {sub.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => handleCancelSubscription(sub.id)}
                          disabled={cancellingSubId === sub.id}
                          className="text-[10px] font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30 flex items-center gap-1 transition-all"
                        >
                          {cancellingSubId === sub.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Ban className="w-3 h-3 text-red-400" />
                          )}
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {sub.lines.map((line) => (
                      <div key={line.id} className="text-[11px] text-slate-300 flex justify-between items-center py-0.5">
                        <span className="truncate max-w-[200px]">{line.productName} (x{line.quantity})</span>
                        <span className="font-mono text-emerald-400">{formatMinorCurrency(line.netTotalMinor, summary.currency)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 flex justify-between pt-1 border-t border-slate-800">
                    <span>Start: {new Date(sub.startDate).toLocaleDateString()}</span>
                    <span>Next Bill: {new Date(sub.nextBillingDate).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Billing Action Button */}
          {!isBillingCreated && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleGenerateBilling}
                disabled={!isApproved || generating}
                className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  isApproved && !generating
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 active:scale-[0.99]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                }`}
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Executing Commercial Billing Transaction...</span>
                  </>
                ) : (
                  <>
                    <span>Generate Hybrid Billing & Subscriptions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              {!isApproved && (
                <p className="text-[10px] text-amber-400/90 text-center mt-1.5">
                  Billing generation is restricted until the quote is in APPROVED status.
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
