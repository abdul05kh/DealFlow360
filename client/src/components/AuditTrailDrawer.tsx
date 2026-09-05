import React from 'react';
import { History, CheckCircle2, XCircle, FilePlus, User, Clock } from 'lucide-react';
import { AuditEventDTO, SavedQuoteDTO } from '../types/api';

interface AuditTrailDrawerProps {
  savedQuote: SavedQuoteDTO | null;
}

export const AuditTrailDrawer: React.FC<AuditTrailDrawerProps> = ({ savedQuote }) => {
  if (!savedQuote) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <History className="w-4 h-4 text-blue-400" />
          <span>Immutable Audit Log & Persistence Record</span>
        </div>
        <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
          Quote has not been submitted yet. Click "Save & Submit Quote" to persist deal and generate immutable audit log.
        </div>
      </div>
    );
  }

  const auditEvents: AuditEventDTO[] = savedQuote.auditHistory || [];

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'QUOTE_CREATED':
        return {
          label: 'QUOTE_CREATED',
          icon: <FilePlus className="w-3.5 h-3.5 text-blue-400" />,
          style: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
        };
      case 'QUOTE_APPROVED':
        return {
          label: 'QUOTE_APPROVED',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
          style: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
        };
      case 'QUOTE_REJECTED':
        return {
          label: 'QUOTE_REJECTED',
          icon: <XCircle className="w-3.5 h-3.5 text-red-400" />,
          style: 'bg-red-500/10 text-red-300 border-red-500/20',
        };
      default:
        return {
          label: action,
          icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
          style: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
        };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-200 font-semibold text-sm">
          <History className="w-4 h-4 text-blue-400" />
          <span>Immutable Audit Log & Persistence Record</span>
        </div>
        <div className="text-xs font-mono text-blue-400 bg-blue-950/60 px-2.5 py-0.5 rounded border border-blue-800/50">
          Quote #{savedQuote.quoteNumber} ({savedQuote.status})
        </div>
      </div>

      {auditEvents.length === 0 ? (
        <div className="py-4 text-center text-xs text-slate-400">
          Quote persisted with ID: <code className="text-blue-400">{savedQuote.id}</code>. Fetching audit trail...
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {auditEvents.map((event) => {
            const badge = getActionBadge(event.action);
            let prevStatus = '';
            let newStatus = '';
            try {
              if (event.previousStateJson) prevStatus = JSON.parse(event.previousStateJson).status;
              if (event.newStateJson) newStatus = JSON.parse(event.newStateJson).status;
            } catch {
              // fallback
            }

            return (
              <div key={event.id} className="relative space-y-1 text-xs">
                {/* Timeline node icon */}
                <div className="absolute -left-[23px] top-0.5 p-1 bg-slate-950 rounded-full border border-slate-800">
                  {badge.icon}
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${badge.style}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-[11px] text-slate-500">{formatDate(event.createdAt)}</span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Actor: {event.actorName}</span>
                  <span className="text-slate-500 text-[10px] font-mono">({event.actorId})</span>
                </div>

                {prevStatus && newStatus && (
                  <div className="text-[11px] font-mono text-slate-400">
                    State Transition: <span className="text-amber-400">{prevStatus}</span> →{' '}
                    <span className="text-emerald-400">{newStatus}</span>
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
