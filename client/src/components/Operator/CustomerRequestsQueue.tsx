import React, { useEffect, useState } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowUpRight,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { apiClient } from '../../services/api';
import { OperatorCustomerRequestDTO, RealUserRole } from '../../types/api';

interface CustomerRequestsQueueProps {
  currentRole: RealUserRole;
}

export const CustomerRequestsQueue: React.FC<CustomerRequestsQueueProps> = ({ currentRole }) => {
  const [requests, setRequests] = useState<OperatorCustomerRequestDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active response state
  const [selectedReq, setSelectedReq] = useState<OperatorCustomerRequestDTO | null>(null);
  const [managerReason, setManagerReason] = useState('');
  const [customerResponseNote, setCustomerResponseNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getOperatorCustomerRequests();
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load operator customer requests queue.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [currentRole]);

  const handleRespond = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedReq) return;
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await apiClient.respondToNegotiation(selectedReq.quoteId, selectedReq.id, {
        action,
        managerReason: managerReason.trim() || undefined,
        customerResponseNote: customerResponseNote.trim() || undefined,
      });

      setActionMessage({
        type: 'success',
        text: `Counter-offer for Quote #${selectedReq.quoteNumber} successfully ${action === 'APPROVE' ? 'APPROVED' : 'REJECTED'} fresh against commercial governance!`,
      });

      setSelectedReq(null);
      setManagerReason('');
      setCustomerResponseNote('');
      await loadRequests();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || `Failed to ${action.toLowerCase()} customer counter-offer.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isManagerOrAdmin = currentRole === 'SALES_MANAGER' || currentRole === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-3 rounded-xl shadow-lg shadow-blue-900/30">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Operator Work Queue — Customer Requests
              <span className="bg-blue-950 text-blue-300 text-xs font-mono font-semibold px-2 py-0.5 rounded border border-blue-800/60">
                {requests.length} Active Pending Requests
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Review and act on customer counter-offer negotiations (`QuoteNegotiation`) fresh through server-authoritative governance.
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

      {/* Global Status Message */}
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

      {/* Main List */}
      {requests.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Work Queue Empty</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            There are no pending customer negotiation counter-offers requiring operator review for your active persona scope ({currentRole}).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 shadow-lg space-y-4 transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-extrabold text-white">Quote #{req.quoteNumber}</span>
                    <span className="bg-blue-950 text-blue-300 text-xs font-mono font-bold px-2.5 py-0.5 rounded border border-blue-800/60">
                      Round {req.round} Counter-Offer
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                        req.riskLevel === 'HIGH'
                          ? 'bg-red-950 text-red-400 border border-red-800'
                          : req.riskLevel === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}
                    >
                      Risk: {req.riskLevel} (Score: {req.riskScore})
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>Company: <strong className="text-slate-200">{req.customerName}</strong></span>
                    <span>•</span>
                    <span>Submitted: {new Date(req.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total Offerd Gross</div>
                    <div className="text-sm font-mono font-bold text-white">₹{req.totalOfferedGross.toLocaleString()}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedReq(req)}
                    className="py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span>Review Counter-Offer</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Customer Note */}
              {req.customerNote && (
                <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-blue-300 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Customer Note:
                  </div>
                  <p className="text-slate-300 italic">{req.customerNote}</p>
                </div>
              )}

              {/* Requested Line Item Details */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Original Offered Disc %</th>
                      <th className="py-2 px-3">Requested Counter Disc %</th>
                      <th className="py-2 px-3">Line Customer Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {req.lines.map((l, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-semibold text-white">{l.productName}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{l.sku}</td>
                        <td className="py-2 px-3 font-mono text-slate-300">{l.offeredDiscountPercent}%</td>
                        <td className="py-2 px-3 font-mono font-bold text-amber-400">{l.requestedDiscountPercent}%</td>
                        <td className="py-2 px-3 text-slate-400 italic">{l.customerNote || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review & Respond Modal */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-purple-400" />
                  Review Customer Counter-Offer (Quote #{selectedReq.quoteNumber})
                </h3>
                <p className="text-xs text-slate-400">
                  Responding triggers fresh server-authoritative evaluation against discount governance and risk rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReq(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Manager Internal Decision Reason (Audit Logged)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approved under competitive retention policy for Q3"
                  value={managerReason}
                  onChange={(e) => setManagerReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Customer-Facing Response Note (Visible on Customer Portal)
                </label>
                <input
                  type="text"
                  placeholder="e.g. We have accepted your requested 12% discount for this volume."
                  value={customerResponseNote}
                  onChange={(e) => setCustomerResponseNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-800">
              {isManagerOrAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleRespond('APPROVE')}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Approve Counter-Offer
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRespond('REJECT')}
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Reject Counter-Offer
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="w-full bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-center text-amber-300 text-xs flex items-center justify-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Only Sales Managers or Administrators can action counter-offers.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
