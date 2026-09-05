import React, { useEffect, useState } from 'react';
import { Users, Plus, Shield, CheckCircle2, AlertCircle, RefreshCw, UserX, UserCheck, Edit2, X } from 'lucide-react';
import { apiClient } from '../../services/api';
import { CustomerDTO, OperatorDTO, RealUserRole } from '../../types/api';

interface OperatorAdminCardProps {
  currentRole: RealUserRole;
}

export const OperatorAdminCard: React.FC<OperatorAdminCardProps> = ({ currentRole }) => {
  const [operators, setOperators] = useState<OperatorDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Operator state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('Password123!');
  const [newRole, setNewRole] = useState<RealUserRole>('SALES_REP');
  const [newCustomerId, setNewCustomerId] = useState<string>('');

  // Edit Operator state
  const [editingOperator, setEditingOperator] = useState<OperatorDTO | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<RealUserRole>('SALES_REP');
  const [editIsActive, setEditIsActive] = useState(true);

  const isAdmin = currentRole === 'ADMIN';

  const loadOperators = async () => {
    setIsLoading(true);
    try {
      const [ops, custs] = await Promise.all([
        apiClient.getOperators(),
        apiClient.getCustomers(true),
      ]);
      setOperators(ops);
      setCustomers(custs);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load operators' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadOperators();
    }
  }, [currentRole]);

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const payload: any = {
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole,
      };
      if (newRole === 'CUSTOMER' && newCustomerId) {
        payload.customerId = newCustomerId;
      }

      const created = await apiClient.createOperator(payload);
      setMessage({
        type: 'success',
        text: `Operator '${created.name}' (${created.email}) created successfully as ${created.role}!`,
      });
      setNewName('');
      setNewEmail('');
      await loadOperators();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Operator creation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartEdit = (op: OperatorDTO) => {
    setEditingOperator(op);
    setEditName(op.name);
    setEditRole(op.role);
    setEditIsActive(op.isActive);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOperator || !isAdmin) return;

    try {
      setIsLoading(true);
      setMessage(null);
      const updated = await apiClient.updateOperator(editingOperator.id, {
        name: editName.trim(),
        role: editRole,
        isActive: editIsActive,
      });
      setMessage({
        type: 'success',
        text: `Operator '${updated.name}' (${updated.email}) updated successfully!`,
      });
      setEditingOperator(null);
      await loadOperators();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update operator' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleOperatorStatus = async (operator: OperatorDTO) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      if (operator.isActive) {
        await apiClient.deactivateOperator(operator.id);
        setMessage({
          type: 'success',
          text: `Operator '${operator.name}' soft-deactivated (isActive: false). Login access revoked.`,
        });
      } else {
        await apiClient.updateOperator(operator.id, { isActive: true });
        setMessage({
          type: 'success',
          text: `Operator '${operator.name}' re-activated (isActive: true). Login access restored.`,
        });
      }
      await loadOperators();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update operator status' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <Shield className="w-8 h-8 text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Admin Operator Management Restricted</h3>
        <p className="text-xs text-slate-400">
          Only System Administrators (ADMIN) can provision, edit, and deactivate operator user accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white p-3 rounded-xl shadow-lg shadow-purple-900/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Operator & User Account Management
              <span className="bg-purple-950 text-purple-300 text-xs font-mono font-semibold px-2 py-0.5 rounded border border-purple-800/60">
                Admin Exclusive
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Provision internal operators (Sales Reps, Managers, Operations) and customer users with soft-deactivation protection.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadOperators}
          disabled={isLoading}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-200'
              : 'bg-red-950/50 border-red-800/60 text-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Edit Operator Modal */}
      {editingOperator && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-purple-400" />
                Edit Operator Details
              </h3>
              <button
                type="button"
                onClick={() => setEditingOperator(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email (Read-only identity key)</label>
                <input
                  type="text"
                  disabled
                  value={editingOperator.email}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Assigned Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as RealUserRole)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                >
                  <option value="SALES_REP">SALES_REP (Sales Executive)</option>
                  <option value="SALES_MANAGER">SALES_MANAGER (Commercial Approver)</option>
                  <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER (Fulfillment Lead)</option>
                  <option value="CUSTOMER">CUSTOMER (External Customer Account)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Account Active Status</label>
                <select
                  value={editIsActive ? 'true' : 'false'}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
                >
                  <option value="true">ACTIVE (Access Granted)</option>
                  <option value="false">DEACTIVATED (Access Blocked)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOperator(null)}
                  className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-md shadow-purple-900/30 cursor-pointer disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Create Form (5 cols) */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Plus className="w-4 h-4 text-purple-400" />
            Provision New User Account
          </h3>

          <form onSubmit={handleCreateOperator} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Jordan Smith"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
              <input
                type="email"
                required
                placeholder="e.g. jordan@dealflow360.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Initial Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Assigned Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as RealUserRole)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-semibold"
              >
                <option value="SALES_REP">SALES_REP (Sales Executive)</option>
                <option value="SALES_MANAGER">SALES_MANAGER (Commercial Approver)</option>
                <option value="OPERATIONS_MANAGER">OPERATIONS_MANAGER (Fulfillment Lead)</option>
                <option value="CUSTOMER">CUSTOMER (External Customer Account)</option>
              </select>
            </div>

            {newRole === 'CUSTOMER' && (
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Link to Customer Account</label>
                <select
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">Select Company...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.tier.name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Provision Account
            </button>
          </form>
        </div>

        {/* User Account List (7 cols) */}
        <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
            <span>System Users & Operators ({operators.length})</span>
            <span className="text-xs text-purple-300 font-semibold">Server-Enforced Active State</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Name / Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Activity</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {operators.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{op.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{op.email}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          op.role === 'ADMIN'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : op.role === 'SALES_MANAGER'
                            ? 'bg-purple-950 text-purple-400 border border-purple-800'
                            : op.role === 'OPERATIONS_MANAGER'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : op.role === 'CUSTOMER'
                            ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                            : 'bg-blue-950 text-blue-400 border border-blue-800'
                        }`}
                      >
                        {op.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-[11px] text-slate-300 font-mono">
                        Quotes: <span className="font-bold text-white">{op.metrics?.quotesCreated ?? 0}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Approvals: <span className="font-bold text-slate-300">{op.metrics?.approvalsHandled ?? 0}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          op.isActive
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {op.isActive ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(op)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 underline underline-offset-2"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleOperatorStatus(op)}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold underline underline-offset-2 ${
                            op.isActive ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'
                          }`}
                        >
                          {op.isActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              Deactivate
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              Activate
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
