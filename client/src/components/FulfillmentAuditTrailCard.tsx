import React from 'react';
import { History, ShieldCheck, Truck, AlertTriangle, Settings2 } from 'lucide-react';
import { AuditEventDTO } from '../types/api';

interface FulfillmentAuditTrailCardProps {
  auditHistory?: AuditEventDTO[];
}

export const FulfillmentAuditTrailCard: React.FC<FulfillmentAuditTrailCardProps> = ({
  auditHistory = [],
}) => {
  const fulfillmentAudits = auditHistory.filter((event) =>
    ['FULFILLMENT_ALLOCATED', 'BACKORDER_CREATED', 'FULFILLMENT_OVERRIDDEN'].includes(event.action)
  );

  if (fulfillmentAudits.length === 0) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <History className="w-4 h-4" />
          Fulfillment Audit History
        </div>
        <p className="text-xs text-slate-500 italic">
          No persisted fulfillment audit events recorded yet. Perform allocation as Operations Lead to record immutable audit entries.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="bg-purple-600/20 text-purple-400 p-2 rounded-lg border border-purple-500/30">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Persisted Fulfillment Audit Trail
              <span className="bg-purple-950 text-purple-300 text-[10px] font-semibold px-2 py-0.5 rounded border border-purple-800/50">
                Immutable DB Audit Log
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Cryptographically timestamped log entries recorded for allocation & override actions.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {fulfillmentAudits.map((event) => {
          const isOverridden = event.action === 'FULFILLMENT_OVERRIDDEN';
          const isBackordered = event.action === 'BACKORDER_CREATED';

          return (
            <div
              key={event.id}
              className="bg-slate-900/60 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isOverridden ? (
                    <span className="bg-amber-950 text-amber-300 border border-amber-800/60 font-bold px-2 py-0.5 rounded flex items-center gap-1 text-[11px]">
                      <Settings2 className="w-3.5 h-3.5 text-amber-400" />
                      {event.action}
                    </span>
                  ) : isBackordered ? (
                    <span className="bg-red-950 text-red-300 border border-red-800/60 font-bold px-2 py-0.5 rounded flex items-center gap-1 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                      {event.action}
                    </span>
                  ) : (
                    <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-bold px-2 py-0.5 rounded flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {event.action}
                    </span>
                  )}
                  <span className="font-semibold text-white">{event.actorName}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>

              {event.newStateJson && (
                <div className="bg-slate-950/80 p-2 rounded border border-slate-800/80 font-mono text-[11px] text-slate-300">
                  {event.newStateJson}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
