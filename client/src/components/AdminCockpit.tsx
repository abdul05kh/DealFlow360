import React, { useEffect, useState } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Package,
  Users,
  Award,
  Tags,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '../services/api';
import { OperatorAdminCard } from './Admin/OperatorAdminCard';
import {
  CustomerDTO,
  CustomerTierDTO,
  DemoRole,
  ProductCategoryDTO,
  ProductDTO,
} from '../types/api';

interface AdminCockpitProps {
  currentRole: DemoRole;
  onMasterDataChanged?: () => void;
}

export const AdminCockpit: React.FC<AdminCockpitProps> = ({
  currentRole,
  onMasterDataChanged,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'operators' | 'products' | 'tiers' | 'customers' | 'categories'>('operators');
  
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [tiers, setTiers] = useState<CustomerTierDTO[]>([]);
  const [customers, setCustomers] = useState<CustomerDTO[]>([]);
  const [categories, setCategories] = useState<ProductCategoryDTO[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New product state
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('50000');
  const [newProdCost, setNewProdCost] = useState('25000');
  const [newProdCategoryId, setNewProdCategoryId] = useState('');

  // Edit tier ceiling state
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [editingTierMaxDiscount, setEditingTierMaxDiscount] = useState<string>('');

  // New tier state (P0-2.1)
  const [newTierCode, setNewTierCode] = useState('');
  const [newTierName, setNewTierName] = useState('');
  const [newTierMaxDiscount, setNewTierMaxDiscount] = useState('15.0');
  const [newTierMinMargin, setNewTierMinMargin] = useState('30.0');

  // New customer state
  const [newCustName, setNewCustName] = useState('');
  const [newCustTierId, setNewCustTierId] = useState('');

  const isAdmin = currentRole === 'ADMIN';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, tierRes, custRes, catRes] = await Promise.all([
        apiClient.getProducts(true),
        apiClient.getCustomerTiers(true),
        apiClient.getCustomers(true),
        apiClient.getProductCategories(),
      ]);
      setProducts(prodRes);
      setTiers(tierRes);
      setCustomers(custRes);
      setCategories(catRes);
      if (catRes.length > 0 && !newProdCategoryId) {
        setNewProdCategoryId(catRes[0].id);
      }
      if (tierRes.length > 0 && !newCustTierId) {
        setNewCustTierId(tierRes[0].id);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load master data' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required to create products' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const created = await apiClient.createProduct({
        sku: newProdSku.trim().toUpperCase(),
        name: newProdName.trim(),
        categoryId: newProdCategoryId,
        sellingPrice: parseFloat(newProdPrice),
        costPrice: parseFloat(newProdCost),
        isActive: true,
      });

      setMessage({ type: 'success', text: `Product '${created.name}' (${created.sku}) created and persisted to database!` });
      setNewProdSku('');
      setNewProdName('');
      await loadData();
      if (onMasterDataChanged) onMasterDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Product creation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleProductActive = async (product: ProductDTO) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required to update products' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      await apiClient.updateProduct(product.id, {
        isActive: !product.isActive,
      });
      setMessage({
        type: 'success',
        text: `Product '${product.name}' set to ${!product.isActive ? 'ACTIVE' : 'INACTIVE'}.`,
      });
      await loadData();
      if (onMasterDataChanged) onMasterDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update product status' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTierCeiling = async (tierId: string) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required to update tier governance' });
      return;
    }

    const val = parseFloat(editingTierMaxDiscount);
    if (isNaN(val) || val < 0 || val > 100) {
      setMessage({ type: 'error', text: 'Discount ceiling must be between 0 and 100%' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const updated = await apiClient.updateCustomerTier(tierId, {
        maxOverallDiscount: val,
      });
      setMessage({
        type: 'success',
        text: `Customer Tier '${updated.name}' max overall discount ceiling updated to ${val.toFixed(1)}%!`,
      });
      setEditingTierId(null);
      await loadData();
      if (onMasterDataChanged) onMasterDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update tier discount ceiling' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required to create customer tiers' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const created = await apiClient.createCustomerTier({
        code: newTierCode.trim().toUpperCase(),
        name: newTierName.trim(),
        maxOverallDiscount: parseFloat(newTierMaxDiscount),
        minMarginThreshold: parseFloat(newTierMinMargin),
        isActive: true,
      });

      setMessage({ type: 'success', text: `Customer Tier '${created.name}' (${created.code}) created successfully!` });
      setNewTierCode('');
      setNewTierName('');
      await loadData();
      if (onMasterDataChanged) onMasterDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Customer tier creation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeactivateTier = async (tier: CustomerTierDTO) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required to deactivate customer tiers' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const updated = await apiClient.deactivateCustomerTier(tier.id);
      setMessage({
        type: 'success',
        text: `Customer Tier '${updated.name}' soft-deactivated successfully (isActive: false). Historical data preserved.`,
      });
      await loadData();
      if (onMasterDataChanged) onMasterDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to deactivate customer tier' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReassignCustomerTier = async (customerId: string, newTierId: string) => {
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required to reassign customer tiers' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const updated = await apiClient.updateCustomer(customerId, { tierId: newTierId });
      setMessage({
        type: 'success',
        text: `Company '${updated.name}' reassigned to tier '${updated.tier.name}' (${updated.tier.code})!`,
      });
      await loadData();
      if (onMasterDataChanged) onMasterDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to reassign customer tier' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setMessage({ type: 'error', text: 'Forbidden: Admin access required to create customers' });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const created = await apiClient.createCustomer({
        name: newCustName.trim(),
        tierId: newCustTierId,
        currency: 'INR',
        status: 'ACTIVE',
      });
      setMessage({ type: 'success', text: `Customer '${created.name}' created and assigned tier!` });
      setNewCustName('');
      await loadData();
      if (onMasterDataChanged) onMasterDataChanged();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Customer creation failed' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white p-3 rounded-xl shadow-lg shadow-indigo-900/30">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Master Data Administration Cockpit
              <span className="bg-purple-950 text-purple-300 text-xs font-mono font-semibold px-2 py-0.5 rounded border border-purple-800/60">
                P0-2 Server-Authoritative
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Configure products, customer tiers, discount governance ceilings, and account master records.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isAdmin && (
            <div className="bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Read-Only Mode (Switch to Admin persona to edit)</span>
            </div>
          )}
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
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

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSubTab('operators')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'operators'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          1. User Accounts & Operators
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('products')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'products'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          2. Products ({products.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('tiers')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'tiers'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          3. Customer Tiers & Ceilings ({tiers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('customers')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'customers'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          4. Customers ({customers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
            activeSubTab === 'categories'
              ? 'bg-amber-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white bg-slate-900 border border-slate-800'
          }`}
        >
          <Tags className="w-4 h-4" />
          5. Categories ({categories.length})
        </button>
      </div>

      {/* Sub-Tab 0: Operators */}
      {activeSubTab === 'operators' && (
        <OperatorAdminCard currentRole={currentRole} />
      )}

      {/* Sub-Tab 1: Products */}
      {activeSubTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create Product Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Plus className="w-4 h-4 text-blue-400" />
              Create New Dynamic Product
            </h3>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">SKU Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CLOUD-001"
                  value={newProdSku}
                  onChange={(e) => setNewProdSku(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cloud Security Package"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Category</label>
                <select
                  value={newProdCategoryId}
                  onChange={(e) => setNewProdCategoryId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.code}) - Max Disc: {cat.maxCategoryDiscount}%
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Selling Price (INR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Cost Price (INR)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProdCost}
                    onChange={(e) => setNewProdCost(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isAdmin || isLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Persist Product to Database
              </button>
            </form>
          </div>

          {/* Product Table (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
              <span>Catalog Products ({products.length})</span>
              <span className="text-xs font-normal text-slate-400">Server-Persisted Master Data</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Selling Price</th>
                    <th className="py-2.5 px-3">Cost Price</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-300">{p.sku}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{p.name}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-300 font-semibold">
                        ₹{p.sellingPrice.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        ₹{p.costPrice.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.isActive
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-red-950 text-red-400 border border-red-800'
                          }`}
                        >
                          {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleToggleProductActive(p)}
                            className="text-[11px] font-semibold text-slate-300 hover:text-white underline underline-offset-2"
                          >
                            {p.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Customer Tiers */}
      {activeSubTab === 'tiers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create Tier Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Plus className="w-4 h-4 text-purple-400" />
              Create New Customer Tier
            </h3>

            <form onSubmit={handleCreateTier} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tier Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PLATINUM"
                  value={newTierCode}
                  onChange={(e) => setNewTierCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Tier Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Platinum Tier Customer"
                  value={newTierName}
                  onChange={(e) => setNewTierName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Max Discount Ceiling (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    required
                    value={newTierMaxDiscount}
                    onChange={(e) => setNewTierMaxDiscount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Min Margin Target (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    required
                    value={newTierMinMargin}
                    onChange={(e) => setNewTierMinMargin(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isAdmin || isLoading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Persist Customer Tier
              </button>
            </form>
          </div>

          {/* Tier Cards & Governance (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-3">
              <span>Customer Tiers & Governance Discount Ceilings ({tiers.length})</span>
              <span className="text-xs text-purple-300 font-semibold">
                Soft deactivation preserves history
              </span>
            </h3>

            <div className="space-y-4">
              {tiers.map((t) => (
                <div
                  key={t.id}
                  className={`bg-slate-900 border rounded-xl p-4 space-y-3 relative ${
                    t.isActive !== false ? 'border-slate-800' : 'border-red-900/60 bg-slate-950/80 opacity-75'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-purple-300">{t.code}</span>
                      <span className="text-xs text-slate-400">({t.name})</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.isActive !== false
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {t.isActive !== false ? 'ACTIVE' : 'INACTIVE (SOFT-DEACTIVATED)'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Max Discount Ceiling:</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        {t.maxOverallDiscount.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Min Margin Target:</span>
                      <span className="font-mono text-slate-300 font-semibold">
                        {t.minMarginThreshold.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Assigned Companies Pill List */}
                  <div className="text-xs space-y-1">
                    <span className="text-slate-400 font-semibold">Assigned Companies:</span>
                    {t.customers && t.customers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {t.customers.map((c) => (
                          <span
                            key={c.id}
                            className="bg-purple-950/60 text-purple-200 border border-purple-800/60 px-2 py-0.5 rounded text-[11px] font-medium"
                          >
                            {c.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">No companies currently assigned</p>
                    )}
                  </div>

                  {/* Actions */}
                  {editingTierId === t.id ? (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        New Discount Ceiling (%):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={editingTierMaxDiscount}
                          onChange={(e) => setEditingTierMaxDiscount(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs px-2.5 py-1.5 rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateTierCeiling(t.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTierId(null)}
                          className="px-2.5 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    isAdmin && (
                      <div className="flex gap-2 pt-1 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTierId(t.id);
                            setEditingTierMaxDiscount(t.maxOverallDiscount.toString());
                          }}
                          className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Configure Ceiling
                        </button>
                        {t.isActive !== false && (
                          <button
                            type="button"
                            onClick={() => handleDeactivateTier(t)}
                            className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/60 font-semibold text-xs rounded-lg transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Customers */}
      {activeSubTab === 'customers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Create Customer Form (5 cols) */}
          <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Plus className="w-4 h-4 text-emerald-400" />
              Create Customer Account
            </h3>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Company / Customer Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Global Systems"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Assigned Customer Tier</label>
                <select
                  value={newCustTierId}
                  onChange={(e) => setNewCustTierId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {tiers.filter((t) => t.isActive !== false).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code}) - Max Disc: {t.maxOverallDiscount}%
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={!isAdmin || isLoading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Persist Customer Account
              </button>
            </form>
          </div>

          {/* Customer Table (7 cols) */}
          <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3 flex justify-between items-center">
              <span>Persisted Customers ({customers.length})</span>
              <span className="text-xs font-normal text-slate-400">Reassign companies to active tiers</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="py-2.5 px-3">Customer Name</th>
                    <th className="py-2.5 px-3">Current Tier</th>
                    <th className="py-2.5 px-3">Max Discount Ceiling</th>
                    <th className="py-2.5 px-3 text-right">Reassign Tier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-white">{c.name}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-purple-300">
                        {c.tier.code} ({c.tier.name})
                      </td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                        {c.tier.maxOverallDiscount.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isAdmin ? (
                          <select
                            value={c.tierId}
                            onChange={(e) => handleReassignCustomerTier(c.id, e.target.value)}
                            disabled={isLoading}
                            className="bg-slate-900 border border-purple-800/60 text-purple-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono font-semibold"
                          >
                            {tiers.filter((t) => t.isActive !== false).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.code} ({t.maxOverallDiscount}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-500 font-mono">{c.tier.code}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab 4: Product Categories */}
      {activeSubTab === 'categories' && (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
            Product Categories & Line Item Discount Limits
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-sm text-amber-300">{c.code}</span>
                  <span className="text-xs text-slate-400">{c.name}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Max Category Discount:</span>
                  <span className="font-mono font-bold text-amber-400 text-sm">
                    {c.maxCategoryDiscount.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
