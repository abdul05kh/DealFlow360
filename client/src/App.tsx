import React, { useState } from 'react';
import {
  Header,
  CustomerSelector,
  QuoteLineItems,
  CommercialEconomics,
  GovernanceRiskRadar,
  RecommendationsCard,
  AuditTrailDrawer,
  QuickDemoPresetBar,
  FulfillmentCockpit,
} from './components';
import { useQuoteGovernance } from './hooks/useQuoteGovernance';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Truck,
  ArrowRight,
} from 'lucide-react';

export default function App() {
  const {
    currentRole,
    setRole,
    customers,
    products,
    selectedCustomerId,
    setSelectedCustomerId,
    lineItems,
    setLineItems,
    addLineItem,
    updateLineItem,
    removeLineItem,
    evaluation,
    isEvaluating,
    evaluationError,
    savedQuote,
    submitQuote,
    approveQuote,
    rejectQuote,
    isSubmitting,
    actionError,
    apiConnected,
    applyPreset,
  } = useQuoteGovernance();

  const [activeTab, setActiveTab] = useState<'governance' | 'fulfillment'>('governance');
  const [approvalReason, setApprovalReason] = useState<string>('');

  const isSalesRep = currentRole === 'SALES_REP';
  const isSalesManager = currentRole === 'SALES_MANAGER';

  // Add recommended product directly into quote line items
  const handleAddRecommendation = (productId: string) => {
    const existingIndex = lineItems.findIndex((item) => item.productId === productId);
    if (existingIndex >= 0) {
      updateLineItem(existingIndex, {
        quantity: lineItems[existingIndex].quantity + 1,
      });
    } else {
      setLineItems((prev) => [
        ...prev,
        {
          productId,
          quantity: 1,
          discountPercent: 5,
        },
      ]);
    }
  };

  const isApprovedQuote =
    savedQuote && (savedQuote.status === 'APPROVED' || savedQuote.status === 'AUTO_APPROVED');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* 1. Header with View Tabs & Persona Switcher */}
      <Header
        currentRole={currentRole}
        onRoleChange={setRole}
        apiConnected={apiConnected}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* 2. Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Quick Demo Preset Bar */}
        <QuickDemoPresetBar
          customers={customers}
          products={products}
          onApplyPreset={applyPreset}
          disabled={isSubmitting}
        />

        {/* Global Action / Error Messages */}
        {evaluationError && (
          <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-xl flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <div className="font-bold">Governance Engine Evaluation Warning</div>
              <div className="text-xs text-red-300">{evaluationError}</div>
            </div>
          </div>
        )}

        {actionError && (
          <div className="bg-amber-950/40 border border-amber-800/60 p-4 rounded-xl flex items-center gap-3 text-amber-200 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold">Action Failed</div>
              <div className="text-xs text-amber-300">{actionError}</div>
            </div>
          </div>
        )}

        {/* Saved Quote Banner */}
        {savedQuote && (
          <div className="bg-blue-950/40 border border-blue-800/60 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-lg">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-white">
                  Quote #{savedQuote.quoteNumber} Persisted to Database
                </div>
                <div className="text-xs text-blue-300">
                  Status: <span className="font-mono font-bold text-white">{savedQuote.status}</span> | Risk Level:{' '}
                  <span className="font-bold text-amber-300">{savedQuote.riskLevel}</span> (Score: {savedQuote.riskScore})
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Manager Actions overlay if viewing saved quote as manager */}
              {isSalesManager && savedQuote.status === 'PENDING_APPROVAL' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Optional approval/rejection reason..."
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => approveQuote(approvalReason)}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve Deal
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectQuote(approvalReason)}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Deal
                  </button>
                </div>
              )}

              {/* Proceed to Fulfillment Cockpit action if deal is approved */}
              {isApprovedQuote && (
                <button
                  type="button"
                  onClick={() => setActiveTab('fulfillment')}
                  className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  Proceed to Operational Fulfillment Cockpit
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 3. Main Views */}
        {activeTab === 'governance' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: Deal Configuration (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              <CustomerSelector
                customers={customers}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={setSelectedCustomerId}
                disabled={isSubmitting}
              />

              <QuoteLineItems
                products={products}
                lineItems={lineItems}
                onAddLineItem={addLineItem}
                onUpdateLineItem={updateLineItem}
                onRemoveLineItem={removeLineItem}
                disabled={isSubmitting}
              />

              {/* Quote Action Bar */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Active Persona Action:</span>
                  <span className="font-semibold text-slate-200">
                    {isSalesRep
                      ? 'Sales Rep (Alex)'
                      : currentRole === 'SALES_MANAGER'
                      ? 'Sales Manager (Morgan)'
                      : 'Operations Lead'}
                  </span>
                </div>

                {isSalesRep ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={submitQuote}
                      disabled={isSubmitting || !evaluation || isEvaluating}
                      className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Persisting Quote & Audit Trail...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          Save & Submit Quote
                        </>
                      )}
                    </button>

                    {evaluation?.decision.requiresApproval && (
                      <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-center justify-between text-xs text-amber-300">
                        <span>Manager approval required for this discount level.</span>
                        <button
                          type="button"
                          onClick={() => setRole('SALES_MANAGER')}
                          className="flex items-center gap-1 font-bold text-purple-300 hover:text-white underline underline-offset-2 ml-2"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Switch to Manager Demo Persona
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedQuote && savedQuote.status === 'PENDING_APPROVAL' ? (
                      <div className="bg-purple-950/40 border border-purple-800/60 p-3.5 rounded-lg text-xs space-y-2">
                        <div className="font-semibold text-purple-200 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-purple-400" />
                          Manager Review Active for Quote #{savedQuote.quoteNumber}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => approveQuote(approvalReason)}
                            disabled={isSubmitting}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve Deal
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectQuote(approvalReason)}
                            disabled={isSubmitting}
                            className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject Deal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-center">
                        {currentRole === 'SALES_MANAGER'
                          ? 'Sales Manager Persona Active. Submit a quote requiring approval as Sales Rep to test manager approval workflow.'
                          : 'Operations Lead Persona Active. Switch to Fulfillment Cockpit tab to manage warehouse stock allocation.'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Commercial Intelligence & Risk Radar (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <CommercialEconomics
                financials={evaluation?.financials || null}
                isEvaluating={isEvaluating}
              />

              <GovernanceRiskRadar
                evaluation={evaluation}
                savedQuoteStatus={savedQuote?.status}
                isEvaluating={isEvaluating}
              />

              <RecommendationsCard
                recommendations={evaluation?.recommendations || []}
                onAddRecommendation={handleAddRecommendation}
                disabled={isSubmitting}
              />

              <AuditTrailDrawer savedQuote={savedQuote} />
            </div>
          </div>
        ) : (
          <FulfillmentCockpit
            currentRole={currentRole}
            activeQuote={savedQuote}
            onSwitchPersona={setRole}
          />
        )}
      </main>
    </div>
  );
}
