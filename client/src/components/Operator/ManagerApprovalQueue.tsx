import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  UserCheck,
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { ManagerApprovalRequestDTO, RealUserRole } from '../../types/api';

interface ManagerApprovalQueueProps {
  currentRole: RealUserRole;
}

export const ManagerApprovalQueue: React.FC<ManagerApprovalQueueProps> = ({ currentRole }) => {
  const [requests, setRequests] = useState<ManagerApprovalRequestDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Action state
  const [selectedReq, setSelectedReq] = useState<ManagerApprovalRequestDTO | null>(null);
  const [approvalReason, setApprovalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getManagerApprovalRequests();
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load manager approval requests queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentRole]);

  const handleApprove = async () => {
    if (!selectedReq || isSubmitting) return;
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await apiClient.approveQuote(selectedReq.quoteId, approvalReason.trim() || undefined);
      setActionMessage({
        type: 'success',
        text: `Quote #${selectedReq.quoteNumber} successfully APPROVED by Sales Manager!`,
      });
      setSelectedReq(null);
      setApprovalReason('');
      await loadRequests();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to approve deal.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq || isSubmitting) return;
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await apiClient.rejectQuote(selectedReq.quoteId, approvalReason.trim() || undefined);
      setActionMessage({
        type: 'success',
        text: `Quote #${selectedReq.quoteNumber} REJECTED by Sales Manager.`,
      });
      setSelectedReq(null);
      setApprovalReason('');
      await loadRequests();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to reject deal.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (val?: number | null): string => {
    if (val === undefined || val === null || isNaN(Number(val))) return '₹0';
    return `₹${Number(val).toLocaleString()}`;
  };

  const formatDate = (val?: string | Date | null): string => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString();
    } catch {
      return '—';
    }
  };

  const isManagerOrAdmin = currentRole === 'SALES_MANAGER' || currentRole === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-3 rounded-xl shadow-lg shadow-purple-900/30">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Manager Approval Queue
              <span className="bg-purple-950 text-purple-300 text-xs font-mono font-semibold px-2 py-0.5 rounded border border-purple-800/60">
                {requests.length} Pending Approvals
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Review and act on initial Sales Rep deals requiring commercial governance approval.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={isLoading}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Queue
        </button>
      </div>

      {/* Global Action / Error Messages */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-200'
              : 'bg-red-950/50 border-red-800/60 text-red-200'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-xl flex items-center gap-3 text-red-200 text-sm">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Approval Requests List */}
      {requests.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Manager Queue Empty</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            There are currently no initial Sales Rep quotes awaiting commercial manager approval.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((req) => {
            const riskLevel = req.financials?.riskLevel ?? 'LOW';
            const riskScore = req.financials?.riskScore ?? 0;

            return (
              <div
                key={req.id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-lg space-y-4 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-base font-extrabold text-white">Quote #{req.quoteNumber}</span>
                      <span className="bg-amber-950 text-amber-300 text-xs font-mono font-bold px-2.5 py-0.5 rounded border border-amber-800/60">
                        {req.quoteStatus}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                          riskLevel === 'HIGH'
                            ? 'bg-red-950 text-red-400 border border-red-800'
                            : riskLevel === 'MEDIUM'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        }`}
                      >
                        Risk: {riskLevel} (Score: {riskScore})
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>
                        Company: <strong className="text-slate-200">{req.customerName}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Tier: <strong className="text-purple-300">{req.customerTier}</strong> ({req.tierDiscountCeiling}% Ceiling)
                      </span>
                      <span>•</span>
                      <span>Sales Rep: <strong className="text-slate-200">{req.salesRepName}</strong></span>
                      <span>•</span>
                      <span>Submitted: {formatDate(req.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Net Revenue</div>
                      <div className="text-sm font-mono font-bold text-emerald-400">
                        {formatCurrency(req.financials?.netRevenue)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReq(req)}
                      className="py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>Review Deal</span>
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Triggered Governance Violations */}
                {req.riskReasons && req.riskReasons.length > 0 && (
                  <div className="bg-amber-950/30 border border-amber-800/50 p-3 rounded-xl text-xs space-y-1">
                    <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Triggered Commercial Governance Warnings:
                    </div>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                      {req.riskReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Line Item Table Summary */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="py-2 px-3">Product</th>
                        <th className="py-2 px-3">SKU</th>
                        <th className="py-2 px-3">Quantity</th>
                        <th className="py-2 px-3">Unit Price</th>
                        <th className="py-2 px-3">Discount %</th>
                        <th className="py-2 px-3">Net Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(req.lines || []).map((l, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40">
                          <td className="py-2 px-3 font-semibold text-white">{l.productName}</td>
                          <td className="py-2 px-3 font-mono text-slate-400">{l.sku}</td>
                          <td className="py-2 px-3 font-mono text-slate-200">{l.quantity}</td>
                          <td className="py-2 px-3 font-mono text-slate-300">{formatCurrency(l.unitPrice)}</td>
                          <td className="py-2 px-3 font-mono font-bold text-amber-400">{l.discountPercent}%</td>
                          <td className="py-2 px-3 font-mono text-emerald-300">{formatCurrency(l.netTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detailed Review & Decision Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-purple-400" />
                  Review Sales Rep Deal (Quote #{selectedReq.quoteNumber})
                </h3>
                <p className="text-xs text-slate-400">
                  Review governance violations and execute authoritative commercial decision.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Deal Overview Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400">Customer:</span>
                <div className="font-bold text-white text-sm">{selectedReq.customerName}</div>
                <div className="text-purple-300 font-semibold">Tier: {selectedReq.customerTier} ({selectedReq.tierDiscountCeiling}% Ceiling)</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400">Financial Summary:</span>
                <div className="font-bold text-emerald-400 text-sm">Net: {formatCurrency(selectedReq.financials?.netRevenue)}</div>
                <div className="text-slate-300">Discount Total: {formatCurrency(selectedReq.financials?.discountAmount)}</div>
              </div>
            </div>

            {/* Decision Reason Input */}
            <div className="space-y-2 text-xs">
              <label className="block text-slate-300 font-semibold">
                Manager Approval / Rejection Reason (Audit Logged)
              </label>
              <input
                type="text"
                placeholder="e.g. Approved for strategic account expansion under Q3 policy"
                value={approvalReason}
                onChange={(e) => setApprovalReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-slate-800">
              {isManagerOrAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Approve Deal
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Reject Deal
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="w-full bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-center text-amber-300 text-xs flex items-center justify-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Only Sales Managers or Administrators can action deal approval requests.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
