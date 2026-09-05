import React from 'react';
import { Shield, UserCheck, ShieldAlert, Cpu, Truck, KeyRound, CheckCircle2 } from 'lucide-react';
import { AuthUserDTO, DemoRole } from '../types/api';

interface HeaderProps {
  currentRole: DemoRole;
  onRoleChange: (role: DemoRole) => void;
  apiConnected: boolean;
  activeTab?: 'governance' | 'fulfillment' | 'admin' | 'customer';
  onTabChange?: (tab: 'governance' | 'fulfillment' | 'admin' | 'customer') => void;
  authUser?: AuthUserDTO | null;
  onOpenAuthModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  apiConnected,
  activeTab = 'governance',
  onTabChange,
  authUser,
  onOpenAuthModal,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-30 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-2.5 rounded-xl shadow-lg shadow-blue-900/20 border border-blue-400/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">DealFlow360</h1>
              <span className="bg-blue-950 text-blue-400 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-blue-800/50">
                Flow A + Flow B Engine
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Commercial Governance & Operational Fulfillment Cockpit
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        {onTabChange && (
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 ml-4">
            <button
              type="button"
              onClick={() => onTabChange('governance')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'governance'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1. Commercial Governance
            </button>
            <button
              type="button"
              onClick={() => onTabChange('fulfillment')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'fulfillment'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              2. Fulfillment Cockpit
            </button>
            <button
              type="button"
              onClick={() => onTabChange('admin')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'admin'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              3. Master Data Admin
            </button>
            <button
              type="button"
              onClick={() => onTabChange('customer')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'customer'
                  ? 'bg-cyan-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              4. Customer Portal
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Server Engine:</span>
          <span className="flex items-center gap-1.5 font-medium text-slate-200">
            <span
              className={`w-2 h-2 rounded-full ${
                apiConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            {apiConnected ? 'Connected (Authoritative)' : 'Connecting...'}
          </span>
        </div>

        {/* Real JWT Auth Button */}
        {onOpenAuthModal && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
              authUser
                ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/80 shadow-md shadow-emerald-950/40'
                : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-indigo-400/30 shadow-md shadow-indigo-950/40'
            }`}
          >
            {authUser ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  JWT Active: <span className="text-white">{authUser.name}</span> ({authUser.role})
                </span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Real JWT Sign In</span>
              </>
            )}
          </button>
        )}

        {/* Persona Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 px-2 font-medium">Demo Persona:</span>
          <button
            type="button"
            onClick={() => onRoleChange('SALES_REP')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
              currentRole === 'SALES_REP'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Alex (Sales Rep)
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('SALES_MANAGER')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
              currentRole === 'SALES_MANAGER'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Morgan (Sales Manager)
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('OPERATIONS_MANAGER')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
              currentRole === 'OPERATIONS_MANAGER'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            Operations Lead
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('ADMIN')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
              currentRole === 'ADMIN'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            System Admin
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('CUSTOMER')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
              currentRole === 'CUSTOMER'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Customer (Acme)
          </button>
        </div>
      </div>
    </header>
  );
};
