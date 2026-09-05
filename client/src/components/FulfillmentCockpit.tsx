import React from 'react';
import {
  Truck,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Building2,
  Package,
  Layers,
  IndianRupee,
  CheckCircle,
  XCircle,
  Settings2,
  Lock,
} from 'lucide-react';
import { useFulfillmentGovernance } from '../hooks/useFulfillmentGovernance';
import { DemoRole, SavedQuoteDTO } from '../types/api';
import { FulfillmentAuditTrailCard } from './FulfillmentAuditTrailCard';
import { RecommendedAllocationCard } from './RecommendedAllocationCard';
import { WarehouseAvailabilityCard } from './WarehouseAvailabilityCard';

interface FulfillmentCockpitProps {
  currentRole: DemoRole;
  activeQuote: SavedQuoteDTO | null;
  onSwitchPersona: (role: DemoRole) => void;
}

export const FulfillmentCockpit: React.FC<FulfillmentCockpitProps> = ({
  currentRole,
  activeQuote,
  onSwitchPersona,
}) => {
  const {
    warehouses,
    isLoadingWarehouses,
    warehousesError,
    evaluation,
    isEvaluating,
    evaluationError,
    manualOverrides,
    setOverride,
    clearOverrides,
    persistedPlan,
    isAllocating,
    allocationError,
    allocateFulfillment,
  } = useFulfillmentGovernance(activeQuote);

  const isSalesRep = currentRole === 'SALES_REP';
  const isOperationsOrManager = currentRole === 'OPERATIONS_MANAGER' || currentRole === 'SALES_MANAGER';

  if (!activeQuote) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 shadow-xl text-center space-y-3">
        <div className="bg-blue-600/20 text-blue-400 p-3 rounded-full w-12 h-12 mx-auto flex items-center justify-center border border-blue-500/30">
          <Truck className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-white">No Approved Quote Selected for Fulfillment</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Please create and approve a quote in the <span className="text-blue-400 font-semibold">Commercial Governance Cockpit</span> tab, or use an interactive demo preset to evaluate fulfillment allocation.
        </p>
      </div>
    );
  }

  // Derive display values strictly from persisted plan or live server evaluation response
  const activeStatus = persistedPlan
    ? persistedPlan.status
    : evaluation
    ? evaluation.evaluation.status
    : 'UNALLOCATED';

  const totalShipments = persistedPlan
    ? persistedPlan.totalShipments
    : evaluation
    ? evaluation.evaluation.totalShipments
    : 0;

  const totalCost = persistedPlan
    ? persistedPlan.totalFulfillmentCost
    : evaluation
    ? evaluation.evaluation.totalFulfillmentCost
    : 0;

  const backorderCount = persistedPlan
    ? persistedPlan.backorderCount
    : evaluation
    ? evaluation.evaluation.backorderCount
    : 0;

  const isBackorder = backorderCount > 0;
  const isOverridden = activeStatus === 'OVERRIDDEN';

  // Calculate requested vs allocated quantities
  const totalRequestedUnits = activeQuote.lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalAllocatedUnits = Math.max(0, totalRequestedUnits - backorderCount);

  return (
    <div className="space-y-6">
      {/* 1. Primary Status & High-Level Operational Metrics Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-mono">
                Quote #{activeQuote.quoteNumber}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                Customer: <span className="text-white">{activeQuote.customer.name}</span> (
                {activeQuote.customer.tier?.name || 'Gold Tier'})
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-3">
              Fulfillment Allocation Intelligence
              {isOverridden ? (
                <span className="bg-amber-950 text-amber-300 border border-amber-800/60 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-amber-400" />
                  OVERRIDDEN
                </span>
              ) : isBackorder ? (
                <span className="bg-red-950 text-red-300 border border-red-800/60 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  PARTIALLY FULFILLED — BACKORDER
                </span>
              ) : (
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  100% ALLOCATED
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {persistedPlan ? (
              <div className="bg-purple-950/60 border border-purple-800/60 px-3 py-1.5 rounded-lg text-xs text-purple-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                <span>Persisted & Inventory Reserved in DB</span>
              </div>
            ) : (
              <div className="bg-blue-950/60 border border-blue-800/60 px-3 py-1.5 rounded-lg text-xs text-blue-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Simulation Active (Uncommitted)</span>
              </div>
            )}
          </div>
        </div>

        {/* 4 Primary Operational Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-400" />
              Units Requested vs Allocated
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {totalAllocatedUnits} <span className="text-sm font-normal text-slate-400">/ {totalRequestedUnits}</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {isBackorder ? `${backorderCount} units backordered` : '100% stock available'}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-purple-400" />
              Shipment Splits Required
            </div>
            <div className="text-2xl font-bold font-mono text-purple-300">
              {totalShipments} {totalShipments === 1 ? 'Shipment' : 'Shipments'}
            </div>
            <div className="text-[11px] text-slate-400">
              {totalShipments === 1 ? 'Single warehouse dispatch' : 'Multi-warehouse split dispatch'}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-1">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-emerald-400" />
              Total Fulfillment Cost
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              ₹{totalCost.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400">
              Sum of base shipping fees across hubs
            </div>
          </div>

          <div
            className={`p-4 rounded-xl border space-y-1 ${
              isBackorder
                ? 'bg-red-950/40 border-red-800/60'
                : 'bg-slate-900/80 border-slate-800'
            }`}
          >
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <AlertTriangle className={`w-4 h-4 ${isBackorder ? 'text-red-400' : 'text-slate-400'}`} />
              Backorder Quantity
            </div>
            <div
              className={`text-2xl font-bold font-mono ${
                isBackorder ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              {backorderCount} <span className="text-sm font-normal text-slate-400">units</span>
            </div>
            <div className="text-[11px] text-slate-400">
              {isBackorder ? 'Immediate replenishment required' : 'Zero backorders'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Global Error Alerts */}
      {evaluationError && (
        <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-xl flex items-center gap-3 text-red-200 text-sm">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <div className="font-bold">Fulfillment Evaluation Failed</div>
            <div className="text-xs text-red-300">{evaluationError}</div>
          </div>
        </div>
      )}

      {allocationError && (
        <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl flex items-center gap-3 text-amber-200 text-sm">
          <XCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold">Allocation Transaction Error</div>
            <div className="text-xs text-amber-300">{allocationError}</div>
          </div>
        </div>
      )}

      {/* 3. High-Visibility Backorder Warning Banner */}
      {isBackorder && (
        <div className="bg-gradient-to-r from-red-950/80 to-amber-950/80 border-2 border-red-600/80 p-5 rounded-xl flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-red-950/50">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 text-white p-2.5 rounded-xl shrink-0">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                INSUFFICIENT STOCK DETECTED — BACKORDER REQUIRED
              </h3>
              <p className="text-xs text-red-200 mt-0.5">
                Demand exceeds total available stock across all active distribution hubs.{' '}
                <span className="font-bold text-white font-mono">{backorderCount} units</span> will be flagged for backorder fulfillment upon allocation.
              </p>
            </div>
          </div>

          <div className="bg-red-900/60 border border-red-700/60 px-4 py-2 rounded-lg text-right font-mono text-xs text-white font-bold">
            Requested: {totalRequestedUnits} | Backordered: {backorderCount}
          </div>
        </div>
      )}

      {/* 4. Distribution Warehouse Inventory Matrix */}
      <WarehouseAvailabilityCard
        warehouses={warehouses}
        isLoading={isLoadingWarehouses}
        error={warehousesError}
      />

      {/* 5. Server Recommended Allocation & Shipment Splits */}
      <RecommendedAllocationCard
        evaluation={evaluation}
        persistedPlan={persistedPlan}
        quote={activeQuote}
        warehouses={warehouses}
        manualOverrides={manualOverrides}
        onSetOverride={setOverride}
        onClearOverrides={clearOverrides}
        isEvaluating={isEvaluating}
        isOperationsOrManager={isOperationsOrManager}
      />

      {/* 6. Operations Action Bar (Commit Allocation) */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Active Persona:</span>
            <span className="font-bold text-white font-mono">
              {currentRole === 'OPERATIONS_MANAGER'
                ? 'Operations Lead (ops_1)'
                : currentRole === 'SALES_MANAGER'
                ? 'Morgan (Sales Manager)'
                : 'Alex (Sales Rep)'}
            </span>
          </div>

          {manualOverrides.length > 0 && (
            <span className="text-amber-400 font-semibold bg-amber-950/60 border border-amber-800/60 px-2.5 py-0.5 rounded">
              Manual Override Pending ({manualOverrides.length} items)
            </span>
          )}
        </div>

        {isSalesRep ? (
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2 text-amber-400">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Sales Rep persona may evaluate simulation but cannot execute allocation or manual overrides.</span>
            </div>
            <button
              type="button"
              onClick={() => onSwitchPersona('OPERATIONS_MANAGER')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
            >
              Switch to Operations Lead
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={allocateFulfillment}
              disabled={isAllocating || Boolean(persistedPlan) || !evaluation}
              className={`w-full py-3.5 font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                persistedPlan
                  ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30'
              }`}
            >
              {isAllocating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executing Transactional Allocation & Inventory Reservation...
                </>
              ) : persistedPlan ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Fulfillment Plan Persisted & Reserved in DB
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4" />
                  {manualOverrides.length > 0
                    ? 'Commit Manual Override & Allocate Fulfillment'
                    : 'Allocate Fulfillment & Reserve Inventory'}
                </>
              )}
            </button>

            {persistedPlan && (
              <div className="text-center text-xs text-purple-300 font-medium bg-purple-950/40 border border-purple-800/40 p-2.5 rounded-lg">
                Fulfillment plan is committed to database with reserved stock. Audit event recorded.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Fulfillment Audit Trail */}
      <FulfillmentAuditTrailCard auditHistory={persistedPlan?.auditHistory || activeQuote.auditHistory} />
    </div>
  );
};
