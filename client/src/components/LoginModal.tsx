import React, { useState } from 'react';
import { LogIn, LogOut, Shield, User, Key, CheckCircle, AlertCircle, X } from 'lucide-react';
import { apiClient } from '../services/api';
import { AuthUserDTO, RealUserRole } from '../types/api';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: AuthUserDTO) => void;
  currentUser: AuthUserDTO | null;
  onLogout: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  currentUser,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<RealUserRole>('SALES_REP');
  const [customerId, setCustomerId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickFill = (demoEmail: string, demoRole: RealUserRole) => {
    setEmail(demoEmail);
    setPassword('Password123!');
    setRole(demoRole);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await apiClient.login({ email, password });
        onAuthSuccess(res.user);
        onClose();
      } else {
        const res = await apiClient.signup({
          name,
          email,
          password,
          role,
          customerId: customerId || undefined,
        });
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Authentication request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="bg-blue-600/20 text-blue-400 p-3 rounded-xl border border-blue-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {currentUser
                ? 'Authenticated Session'
                : mode === 'login'
                ? 'Real JWT Login'
                : 'Register Account'}
            </h2>
            <p className="text-xs text-slate-400">
              {currentUser
                ? 'Server-authoritative JWT identity active'
                : 'DealFlow360 P0-1 Authentication Gateway'}
            </p>
          </div>
        </div>

        {/* Active Session View */}
        {currentUser ? (
          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Authenticated User:</span>
                <span className="font-bold text-white">{currentUser.name}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Email:</span>
                <span className="font-mono text-blue-300">{currentUser.email}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Server Authoritative Role:</span>
                <span className="bg-blue-900/60 border border-blue-700/50 text-blue-300 font-bold px-2 py-0.5 rounded text-[11px]">
                  {currentUser.role}
                </span>
              </div>
              {currentUser.customerId && (
                <div className="flex justify-between items-center text-slate-400">
                  <span>Customer ID:</span>
                  <span className="font-mono text-emerald-300">{currentUser.customerId}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sign Out Session
              </button>
            </div>
          </div>
        ) : (
          /* Login / Signup Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`py-1.5 font-bold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`py-1.5 font-bold rounded-lg transition-all ${
                  mode === 'signup'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-800/60 p-3 rounded-xl flex items-center gap-2 text-red-200 text-xs">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Sales Rep"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="salesrep@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as RealUserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="SALES_REP">Sales Rep (Allowed)</option>
                    <option value="CUSTOMER">Customer (Allowed)</option>
                    <option value="SALES_MANAGER" disabled>Sales Manager (Protected - Server Rejects)</option>
                    <option value="OPERATIONS_MANAGER" disabled>Operations Manager (Protected - Server Rejects)</option>
                    <option value="ADMIN" disabled>Admin (Protected - Server Rejects)</option>
                  </select>
                </div>

                {role === 'CUSTOMER' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Customer ID</label>
                    <input
                      type="text"
                      required
                      placeholder="cust_acme_101"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Quick Fill Buttons for Seed Users */}
            <div className="border-t border-slate-800 pt-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400">Quick Fill Seed Accounts:</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickFill('salesrep@example.com', 'SALES_REP')}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px] font-semibold"
                >
                  Sales Rep
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('salesmanager@example.com', 'SALES_MANAGER')}
                  className="px-2 py-1 bg-purple-950/80 border border-purple-800/60 hover:bg-purple-900 text-purple-200 rounded text-[10px] font-semibold"
                >
                  Sales Manager
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('operations@example.com', 'OPERATIONS_MANAGER')}
                  className="px-2 py-1 bg-emerald-950/80 border border-emerald-800/60 hover:bg-emerald-900 text-emerald-200 rounded text-[10px] font-semibold"
                >
                  Operations Lead
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('admin@example.com', 'ADMIN')}
                  className="px-2 py-1 bg-amber-950/80 border border-amber-800/60 hover:bg-amber-900 text-amber-200 rounded text-[10px] font-semibold"
                >
                  Admin
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {isSubmitting ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
