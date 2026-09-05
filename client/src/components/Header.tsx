import React from 'react';
import { Shield, UserCheck, ShieldAlert, Cpu, Truck, KeyRound, CheckCircle2, LogOut, MessageSquare } from 'lucide-react';
import { AuthUserDTO, DemoRole } from '../types/api';

interface HeaderProps {
  currentRole: DemoRole;
  onRoleChange: (role: DemoRole) => void;
  apiConnected: boolean;
  activeTab?: 'governance' | 'requests' | 'fulfillment' | 'admin' | 'customer';
  onTabChange?: (tab: 'governance' | 'requests' | 'fulfillment' | 'admin' | 'customer') => void;
  authUser?: AuthUserDTO | null;
  onOpenAuthModal?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  apiConnected,
  activeTab = 'governance',
  onTabChange,
  authUser,
  onOpenAuthModal,
  onLogout,
}) => {
  const isCustomer = currentRole === 'CUSTOMER';

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
                {isCustomer ? 'Customer Portal' : 'Operator Workspaces'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              {isCustomer
                ? 'Direct Negotiation & Commercial Offer Management'
                : 'Commercial Governance, Work Queue & Operational Fulfillment'}
            </p>
          </div>
        </div>

        {/* Operator View Switcher Tabs (Hidden for Customers) */}
        {!isCustomer && onTabChange && (
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 ml-4 flex-wrap">
            <button
              type="button"
              onClick={() => onTabChange('governance')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'governance'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1. Sales Governance
            </button>
            <button
              type="button"
              onClick={() => onTabChange('requests')}
              className={`text-xs font-bold px-3 py-1.5 rounded-md transition-all flex items-center gap-1 ${
                activeTab === 'requests'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              2. Customer Requests
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
              3. Fulfillment Cockpit
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
              4. Master Data & Admin
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
            {apiConnected ? 'Connected' : 'Connecting...'}
          </span>
        </div>

        {/* Auth User Info & Logout / Login Button */}
        {authUser ? (
          <div className="flex items-center gap-2">
            <div className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md shadow-emerald-950/40">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                <span className="text-white">{authUser.name}</span> ({authUser.role})
              </span>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 bg-slate-900 hover:bg-red-950 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-indigo-400/30 shadow-md shadow-indigo-950/40"
            >
              <KeyRound className="w-4 h-4" />
              <span>Sign In</span>
            </button>
          )
        )}

        {/* Persona Switcher (For Demo & Testing) */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <span className="text-xs text-slate-400 px-2 font-medium">Demo Persona:</span>
          <button
            type="button"
            onClick={() => onRoleChange('SALES_REP')}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
              currentRole === 'SALES_REP'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            Alex
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('SALES_MANAGER')}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
              currentRole === 'SALES_MANAGER'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            Morgan
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('OPERATIONS_MANAGER')}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
              currentRole === 'OPERATIONS_MANAGER'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Truck className="w-3 h-3" />
            Ops
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('ADMIN')}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
              currentRole === 'ADMIN'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Shield className="w-3 h-3" />
            Admin
          </button>
          <button
            type="button"
            onClick={() => onRoleChange('CUSTOMER')}
            className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md transition-all ${
              currentRole === 'CUSTOMER'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3 h-3" />
            Customer
          </button>
        </div>
      </div>
    </header>
  );
};
