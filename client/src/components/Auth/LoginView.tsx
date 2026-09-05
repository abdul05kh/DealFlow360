import React, { useState } from 'react';
import { Shield, KeyRound, ArrowRight, AlertCircle, RefreshCw, UserCheck, Lock } from 'lucide-react';
import { apiClient } from '../../services/api';
import { firebaseAuth, signInWithEmailAndPassword } from '../../services/firebaseClient';
import { AuthUserDTO } from '../../types/api';

interface LoginViewProps {
  onLoginSuccess: (user: AuthUserDTO) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('salesmanager@example.com');
  const [password, setPassword] = useState('Password123!');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      let authRes: any = null;
      try {
        const userCred = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const idToken = await userCred.user.getIdToken();
        authRes = await apiClient.loginWithFirebaseToken(idToken);
      } catch (fbErr: any) {
        console.warn('Firebase Client Sign-In fallback:', fbErr.message);
        authRes = await apiClient.login({ email, password });
      }

      onLoginSuccess(authRes.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setIsLoading(true);
    setError(null);
    setEmail(demoEmail);
    try {
      let authRes: any = null;
      try {
        const userCred = await signInWithEmailAndPassword(firebaseAuth, demoEmail, 'Password123!');
        const idToken = await userCred.user.getIdToken();
        authRes = await apiClient.loginWithFirebaseToken(idToken);
      } catch (fbErr: any) {
        console.warn('Firebase Client Sign-In fallback:', fbErr.message);
        authRes = await apiClient.login({ email: demoEmail, password: 'Password123!' });
      }
      onLoginSuccess(authRes.user);
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 p-4 rounded-2xl shadow-xl shadow-blue-900/30 border border-blue-400/30">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">DealFlow360</h1>
          <p className="text-sm text-slate-400 font-medium">
            Commercial Deal Governance Engine & Fulfillment Operations
          </p>
          <div className="inline-block bg-slate-900 border border-slate-800 text-blue-400 text-xs px-3 py-1 rounded-full font-semibold">
            Single Secure Authenticated Entry Point
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-400" />
              Account Login
            </h2>
            <span className="text-xs text-slate-500 font-mono">Firebase / JWT Auth</span>
          </div>

          {error && (
            <div className="bg-red-950/60 border border-red-800/80 p-3.5 rounded-xl flex items-center gap-3 text-red-200 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@dealflow360.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1.5">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  Sign In to Portal
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Persona Presets */}
          <div className="pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
              <span>Hackathon Quick Demo Logins:</span>
              <Lock className="w-3 h-3 text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickLogin('salesrep@example.com')}
                className="p-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-all text-slate-200 flex items-center gap-2"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div>
                  <div className="font-bold text-[11px]">Alex (Sales Rep)</div>
                  <div className="text-[10px] text-slate-400">Operator Portal</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('salesmanager@example.com')}
                className="p-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-all text-slate-200 flex items-center gap-2"
              >
                <UserCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <div>
                  <div className="font-bold text-[11px]">Morgan (Sales Mgr)</div>
                  <div className="text-[10px] text-slate-400">Operator Portal</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('operations@example.com')}
                className="p-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-all text-slate-200 flex items-center gap-2"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-bold text-[11px]">Operations Lead</div>
                  <div className="text-[10px] text-slate-400">Operator Portal</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin@example.com')}
                className="p-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-all text-slate-200 flex items-center gap-2"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-bold text-[11px]">System Admin</div>
                  <div className="text-[10px] text-slate-400">Admin Cockpit</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('customer@example.com')}
                className="p-2 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-left transition-all text-slate-200 flex items-center gap-2 col-span-2"
              >
                <UserCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <div>
                  <div className="font-bold text-[11px]">Acme Customer (Acme)</div>
                  <div className="text-[10px] text-slate-400">Customer Portal</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          DealFlow360 Enterprise Deal Governance • Odoo Hackathon 2026
        </div>
      </div>
    </div>
  );
};
