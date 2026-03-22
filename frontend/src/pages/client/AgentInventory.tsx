import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Plus, AlertCircle, QrCode, Download,
  ToggleLeft, ToggleRight, Edit3, Trash2, TrendingDown,
  X, Check, DollarSign, BarChart3
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  threshold: number;
  supplier: string;
  unitCost: number;
  autoOrder: boolean;
  lastUpdated: string;
}

const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Massage Oil 500ml', quantity: 3, unit: 'bottle', threshold: 5, supplier: 'GreenSupply Co.', unitCost: 12.50, autoOrder: true, lastUpdated: 'Mar 21, 2026' },
  { id: 'p2', name: 'Lavender Candles', quantity: 12, unit: 'unit', threshold: 8, supplier: 'GreenSupply Co.', unitCost: 4.00, autoOrder: true, lastUpdated: 'Mar 20, 2026' },
  { id: 'p3', name: 'Disposable Face Masks', quantity: 87, unit: 'pack', threshold: 20, supplier: 'MedSupply Inc.', unitCost: 0.85, autoOrder: false, lastUpdated: 'Mar 18, 2026' },
  { id: 'p4', name: 'Hot Stone Set', quantity: 2, unit: 'set', threshold: 3, supplier: 'WellnessGear Ltd.', unitCost: 45.00, autoOrder: false, lastUpdated: 'Mar 15, 2026' },
  { id: 'p5', name: 'Organic Coconut Oil 1L', quantity: 18, unit: 'bottle', threshold: 6, supplier: 'NaturalPure Co.', unitCost: 9.75, autoOrder: true, lastUpdated: 'Mar 22, 2026' },
  { id: 'p6', name: 'Disposable Towels', quantity: 4, unit: 'pack', threshold: 10, supplier: 'CleanPro Supplies', unitCost: 15.00, autoOrder: true, lastUpdated: 'Mar 22, 2026' },
];

const USAGE_HISTORY = [
  { product: 'Massage Oil 500ml', used: 2, date: 'Mar 22', cost: 25.00 },
  { product: 'Lavender Candles', used: 3, date: 'Mar 22', cost: 12.00 },
  { product: 'Disposable Face Masks', used: 5, date: 'Mar 21', cost: 4.25 },
  { product: 'Organic Coconut Oil 1L', used: 1, date: 'Mar 20', cost: 9.75 },
  { product: 'Disposable Towels', used: 2, date: 'Mar 20', cost: 30.00 },
  { product: 'Massage Oil 500ml', used: 1, date: 'Mar 19', cost: 12.50 },
];

const EMPTY_PRODUCT: Omit<Product, 'id' | 'lastUpdated'> = {
  name: '',
  quantity: 0,
  unit: 'unit',
  threshold: 5,
  supplier: '',
  unitCost: 0,
  autoOrder: false,
};

export default function AgentInventory() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ ...EMPTY_PRODUCT });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qrProduct, setQrProduct] = useState<string | null>(null);

  const lowStockProducts = products.filter(p => p.quantity <= p.threshold);
  const totalStockCost = products.reduce((s, p) => s + p.quantity * p.unitCost, 0);
  const monthlyUsageCost = USAGE_HISTORY.reduce((s, u) => s + u.cost, 0);

  const toggleAutoOrder = (id: string) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, autoOrder: !p.autoOrder } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const addProduct = () => {
    if (!newProduct.name.trim()) return;
    const product: Product = {
      ...newProduct,
      id: `p${Date.now()}`,
      lastUpdated: 'Just now',
    };
    setProducts(prev => [...prev, product]);
    setNewProduct({ ...EMPTY_PRODUCT });
    setShowAddModal(false);
  };

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">Inventory AI</h1>
            <p className="text-sm text-[#86868b]">Real-time stock tracking with auto-order capabilities</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[#6366f1] text-white hover:bg-[#4f46e5] transition-all"
          >
            <Plus size={15} /> Add Product
          </button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Products', value: products.length, sub: 'tracked', icon: Package, color: 'blue' },
          { label: 'Low Stock Alerts', value: lowStockProducts.length, sub: 'need reorder', icon: AlertCircle, color: 'red' },
          { label: 'Total Stock Value', value: `$${totalStockCost.toFixed(0)}`, sub: 'on hand', icon: DollarSign, color: 'emerald' },
          { label: 'Monthly Usage Cost', value: `$${monthlyUsageCost.toFixed(0)}`, sub: 'this month', icon: TrendingDown, color: 'amber' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 hover:shadow-md hover:border-[#d2d2d7] transition-all"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-600 mb-3`}>
              <kpi.icon size={18} />
            </div>
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="text-xs text-[#86868b] mt-1">{kpi.label}</p>
            <p className="text-[10px] text-[#86868b]/60 mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-red-200 bg-red-50 p-5 mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} className="text-red-600" />
            <h3 className="text-sm font-semibold text-red-700">Low Stock Alerts</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-red-100">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-red-600">{p.quantity} {p.unit}s left · threshold: {p.threshold}</p>
                </div>
                {p.autoOrder ? (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Auto-order on</span>
                ) : (
                  <button className="text-xs font-medium text-[#6366f1] hover:underline">Order now</button>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Product Table */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold">Product List</h3>
            <p className="text-xs text-[#86868b] mt-0.5">{products.length} products tracked</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d2d2d7]/40">
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Product</th>
                <th className="text-right text-xs font-medium text-[#86868b] pb-3">Qty</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3 pl-3">Unit</th>
                <th className="text-right text-xs font-medium text-[#86868b] pb-3">Threshold</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3 pl-4">Supplier</th>
                <th className="text-right text-xs font-medium text-[#86868b] pb-3">Unit Cost</th>
                <th className="text-center text-xs font-medium text-[#86868b] pb-3">Auto-order</th>
                <th className="text-center text-xs font-medium text-[#86868b] pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const isLow = p.quantity <= p.threshold;
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-[#d2d2d7]/20 hover:bg-[#f5f5f7] transition-colors"
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isLow ? 'bg-red-500' : 'bg-emerald-500'}`} />
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className={`py-3 text-right font-semibold ${isLow ? 'text-red-600' : ''}`}>{p.quantity}</td>
                    <td className="py-3 pl-3 text-xs text-[#86868b]">{p.unit}</td>
                    <td className="py-3 text-right text-xs text-[#86868b]">{p.threshold}</td>
                    <td className="py-3 pl-4 text-xs text-[#86868b]">{p.supplier}</td>
                    <td className="py-3 text-right text-xs">${p.unitCost.toFixed(2)}</td>
                    <td className="py-3 text-center">
                      <button onClick={() => toggleAutoOrder(p.id)}>
                        {p.autoOrder
                          ? <ToggleRight size={20} className="text-[#6366f1] mx-auto" />
                          : <ToggleLeft size={20} className="text-[#86868b] mx-auto" />
                        }
                      </button>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setQrProduct(qrProduct === p.id ? null : p.id)}
                          className="text-[#86868b] hover:text-[#6366f1] transition-colors"
                          title="Generate QR Code"
                        >
                          <QrCode size={15} />
                        </button>
                        <button
                          onClick={() => deleteProduct(p.id)}
                          className="text-[#86868b] hover:text-red-500 transition-colors"
                          title="Delete product"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* QR Code placeholder */}
        <AnimatePresence>
          {qrProduct && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-5 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/60 flex items-center gap-5"
            >
              <div className="w-24 h-24 bg-white border border-[#d2d2d7]/60 rounded-xl flex items-center justify-center flex-shrink-0">
                <QrCode size={48} className="text-[#1d1d1f]" />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1">QR Code — {products.find(p => p.id === qrProduct)?.name}</p>
                <p className="text-xs text-[#86868b] mb-3">Scan to log usage or trigger reorder</p>
                <div className="flex gap-2">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#6366f1] text-white rounded-lg hover:bg-[#4f46e5] transition-colors">
                    <Download size={11} /> Download PNG
                  </button>
                  <button onClick={() => setQrProduct(null)} className="px-3 py-1.5 text-xs font-medium bg-white text-[#86868b] rounded-lg border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Usage Tracking */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-5">Usage Tracking</h3>
          <div className="space-y-2">
            {USAGE_HISTORY.map((u, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[#f5f5f7] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Package size={14} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.product}</p>
                  <p className="text-xs text-[#86868b]">Used: {u.used} · {u.date}</p>
                </div>
                <span className="text-sm font-semibold text-red-500">-${u.cost.toFixed(2)}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Monthly Stock Cost Summary */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-5">Monthly Stock Cost Summary</h3>
          <div className="space-y-3">
            {products.slice(0, 5).map(p => {
              const totalValue = p.quantity * p.unitCost;
              const maxValue = Math.max(...products.map(pr => pr.quantity * pr.unitCost));
              const pct = maxValue > 0 ? (totalValue / maxValue) * 100 : 0;
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#86868b] truncate max-w-[60%]">{p.name}</span>
                    <span className="text-xs font-semibold">${totalValue.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-[#f5f5f7] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#6366f1] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 border-t border-[#d2d2d7]/40 flex items-center justify-between">
              <span className="text-sm font-semibold">Total on hand</span>
              <span className="text-sm font-bold text-[#6366f1]">${totalStockCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold">Add Product</h3>
                <button onClick={() => setShowAddModal(false)} className="text-[#86868b] hover:text-[#1d1d1f] transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1.5">Product Name *</label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Massage Oil 500ml"
                    className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#86868b] mb-1.5">Quantity</label>
                    <input
                      type="number"
                      value={newProduct.quantity}
                      onChange={e => setNewProduct(p => ({ ...p, quantity: Number(e.target.value) }))}
                      min={0}
                      className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#86868b] mb-1.5">Unit</label>
                    <input
                      type="text"
                      value={newProduct.unit}
                      onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}
                      placeholder="bottle, pack, unit..."
                      className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#86868b] mb-1.5">Low Stock Threshold</label>
                    <input
                      type="number"
                      value={newProduct.threshold}
                      onChange={e => setNewProduct(p => ({ ...p, threshold: Number(e.target.value) }))}
                      min={0}
                      className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#86868b] mb-1.5">Unit Cost ($)</label>
                    <input
                      type="number"
                      value={newProduct.unitCost}
                      onChange={e => setNewProduct(p => ({ ...p, unitCost: Number(e.target.value) }))}
                      min={0}
                      step={0.01}
                      className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#86868b] mb-1.5">Supplier</label>
                  <input
                    type="text"
                    value={newProduct.supplier}
                    onChange={e => setNewProduct(p => ({ ...p, supplier: e.target.value }))}
                    placeholder="Supplier name"
                    className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Enable Auto-order</p>
                    <p className="text-xs text-[#86868b]">Automatically reorder when below threshold</p>
                  </div>
                  <button onClick={() => setNewProduct(p => ({ ...p, autoOrder: !p.autoOrder }))}>
                    {newProduct.autoOrder
                      ? <ToggleRight size={24} className="text-[#6366f1]" />
                      : <ToggleLeft size={24} className="text-[#86868b]" />
                    }
                  </button>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={addProduct}
                  disabled={!newProduct.name.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-[#6366f1] text-white rounded-xl hover:bg-[#4f46e5] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={15} /> Add Product
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 text-sm font-medium bg-[#f5f5f7] text-[#1d1d1f] rounded-xl hover:bg-[#e8e8ed] border border-[#d2d2d7]/60 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
