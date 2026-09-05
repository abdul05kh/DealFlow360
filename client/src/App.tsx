import React from 'react';
import { Shield, CheckCircle } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 text-blue-400 p-2 rounded-lg border border-blue-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">DealFlow360</h1>
            <p className="text-xs text-slate-400">Flow A — Commercial Governance Engine</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-8 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            Phase 1 Foundation Active
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Monorepo structure, Prisma SQLite schema, master data seed engine, and Vitest test suite ready for Phase 2 domain execution.
          </p>
        </div>
      </main>
    </div>
  );
}
