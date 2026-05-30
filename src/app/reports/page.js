'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { exportToExcel } from '@/lib/excel/exporters';
import { PageHeader } from '@/components/shared';
import { Download, TrendingUp, ShoppingCart, Package, Users, Car, Wrench } from 'lucide-react';

const COLORS = ['#ea580c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
const TABS = ['Sales', 'Purchase', 'Inventory', 'Customers', 'Vehicles', 'Maintenance'];

export default function ReportsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('Sales');
  const [period, setPeriod] = useState('monthly');
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [customerData, setCustomerData] = useState([]);
  const [vehicleData, setVehicleData] = useState([]);
  const [maintenanceData, setMaintenanceData] = useState([]);

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    if (period === 'daily') start.setDate(start.getDate() - 30);
    else if (period === 'weekly') start.setDate(start.getDate() - 84);
    else if (period === 'monthly') start.setMonth(start.getMonth() - 11);
    else start.setFullYear(start.getFullYear() - 4);
    return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { start, end } = getDateRange();

      // Sales data
      const { data: invs } = await supabase.from('invoices')
        .select('invoice_date, total_amount, paid_amount, pending_amount, status')
        .gte('invoice_date', start).lte('invoice_date', end)
        .is('deleted_at', null).order('invoice_date');

      // Group by period
      const grouped = {};
      (invs || []).forEach(inv => {
        const d = new Date(inv.invoice_date);
        let key;
        if (period === 'daily') key = d.toLocaleDateString('en-IN');
        else if (period === 'weekly') key = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString('en-IN', { month: 'short' })}`;
        else if (period === 'monthly') key = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
        else key = d.getFullYear().toString();
        if (!grouped[key]) grouped[key] = { name: key, revenue: 0, paid: 0, pending: 0, count: 0 };
        grouped[key].revenue += Number(inv.total_amount);
        grouped[key].paid += Number(inv.paid_amount);
        grouped[key].pending += Number(inv.pending_amount);
        grouped[key].count++;
      });
      setSalesData(Object.values(grouped));

      // Purchase data
      const { data: pos } = await supabase.from('purchase_orders')
        .select('purchase_date, total_amount, payment_status')
        .gte('purchase_date', start).lte('purchase_date', end).is('deleted_at', null);
      const pgrouped = {};
      (pos || []).forEach(po => {
        const d = new Date(po.purchase_date);
        const key = period === 'monthly' ? d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }) : d.getFullYear().toString();
        if (!pgrouped[key]) pgrouped[key] = { name: key, amount: 0, count: 0 };
        pgrouped[key].amount += Number(po.total_amount);
        pgrouped[key].count++;
      });
      setPurchaseData(Object.values(pgrouped));

      // Inventory data
      const { data: prods } = await supabase.from('products')
        .select('name, stock_quantity, minimum_stock, selling_price, stock_status')
        .is('deleted_at', null).order('stock_quantity', { ascending: true }).limit(20);
      setInventoryData(prods || []);

      // Customer data (credit report)
      const { data: custs } = await supabase.from('customers')
        .select('name, credit_limit, current_credit, customer_type').is('deleted_at', null)
        .gt('current_credit', 0).order('current_credit', { ascending: false }).limit(15);
      setCustomerData(custs || []);

      // Vehicle data
      const { data: vehs } = await supabase.from('vehicles').select('vehicle_status').is('deleted_at', null);
      const vmap = {};
      (vehs || []).forEach(v => { vmap[v.vehicle_status] = (vmap[v.vehicle_status] || 0) + 1; });
      setVehicleData(Object.entries(vmap).map(([name, value]) => ({ name: name.replace('_', ' '), value })));

      // Maintenance data
      const { data: maints } = await supabase.from('maintenance_records')
        .select('maintenance_date, cost, vehicles(vehicle_name)')
        .gte('maintenance_date', start).lte('maintenance_date', end).is('deleted_at', null);
      const mmapped = {};
      (maints || []).forEach(m => {
        const key = new Date(m.maintenance_date).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
        if (!mmapped[key]) mmapped[key] = { name: key, cost: 0, count: 0 };
        mmapped[key].cost += Number(m.cost);
        mmapped[key].count++;
      });
      setMaintenanceData(Object.values(mmapped));

      setLoading(false);
    };
    load();
  }, [period, activeTab]);

  const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  const exportCurrentReport = () => {
    if (activeTab === 'Sales') exportToExcel(salesData, [
      { key: 'name', label: 'Period' },
      { key: 'revenue', label: 'Revenue', format: v => Number(v).toFixed(2) },
      { key: 'paid', label: 'Paid', format: v => Number(v).toFixed(2) },
      { key: 'pending', label: 'Pending', format: v => Number(v).toFixed(2) },
      { key: 'count', label: 'Invoices' },
    ], 'sales_report');
    else if (activeTab === 'Inventory') exportToExcel(inventoryData, [
      { key: 'name', label: 'Product' },
      { key: 'stock_quantity', label: 'Stock' },
      { key: 'minimum_stock', label: 'Min Stock' },
      { key: 'stock_status', label: 'Status' },
      { key: 'selling_price', label: 'Sell Price', format: v => Number(v).toFixed(2) },
    ], 'inventory_report');
  };

  const TabIcon = { Sales: TrendingUp, Purchase: ShoppingCart, Inventory: Package, Customers: Users, Vehicles: Car, Maintenance: Wrench };

  return (
    <div className="space-y-5">
      <PageHeader title="Reports" subtitle="Business analytics and insights"
        actions={
          <div className="flex items-center gap-2">
            <select value={period} onChange={e => setPeriod(e.target.value)} className="input w-36 text-sm">
              <option value="daily">Daily (30d)</option>
              <option value="weekly">Weekly (12w)</option>
              <option value="monthly">Monthly (12m)</option>
              <option value="yearly">Yearly (5y)</option>
            </select>
            <button onClick={exportCurrentReport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => {
          const Icon = TabIcon[tab];
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                ${activeTab === tab ? 'bg-white dark:bg-surface-700 text-brand-600 shadow-sm' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}`}>
              <Icon className="w-4 h-4" /> {tab}
            </button>
          );
        })}
      </div>

      {/* Sales Report */}
      {activeTab === 'Sales' && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Revenue', value: formatCurrency(salesData.reduce((s, d) => s + d.revenue, 0)), color: 'text-green-600' },
              { label: 'Collected', value: formatCurrency(salesData.reduce((s, d) => s + d.paid, 0)), color: 'text-blue-600' },
              { label: 'Pending', value: formatCurrency(salesData.reduce((s, d) => s + d.pending, 0)), color: 'text-red-500' },
              { label: 'Total Invoices', value: salesData.reduce((s, d) => s + d.count, 0), color: 'text-surface-800 dark:text-white' },
            ].map(card => (
              <div key={card.label} className="card p-4">
                <p className="text-surface-400 text-sm">{card.label}</p>
                <p className={`text-2xl font-display font-bold mt-1 ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold mb-4">Revenue Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`} />
                <Tooltip formatter={v => [formatCurrency(v)]} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="revenue" name="Revenue" fill="#ea580c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="paid" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="pending" name="Pending" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Purchase Report */}
      {activeTab === 'Purchase' && (
        <div className="card p-5">
          <h3 className="font-semibold mb-4">Purchase Trend</h3>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="card p-4">
              <p className="text-surface-400 text-sm">Total Spent</p>
              <p className="text-2xl font-display font-bold text-brand-600">{formatCurrency(purchaseData.reduce((s, d) => s + d.amount, 0))}</p>
            </div>
            <div className="card p-4">
              <p className="text-surface-400 text-sm">Total Orders</p>
              <p className="text-2xl font-display font-bold">{purchaseData.reduce((s, d) => s + d.count, 0)}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={purchaseData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`} />
              <Tooltip formatter={v => [formatCurrency(v), 'Purchase Amount']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="amount" stroke="#ea580c" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Inventory Report */}
      {activeTab === 'Inventory' && (
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-4">Stock Levels (Bottom 20 Products)</h3>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={inventoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="stock_quantity" name="Stock" fill="#ea580c" radius={[0, 4, 4, 0]} />
                <Bar dataKey="minimum_stock" name="Min Stock" fill="#fca5a5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-surface-100 dark:border-surface-700 font-semibold">Inventory Status</div>
            <table className="table text-xs">
              <thead><tr><th>Product</th><th>Stock</th><th>Min Stock</th><th>Status</th><th>Value (₹)</th></tr></thead>
              <tbody>
                {inventoryData.map(p => (
                  <tr key={p.name}>
                    <td className="font-medium">{p.name}</td>
                    <td className="font-mono">{p.stock_quantity}</td>
                    <td className="font-mono">{p.minimum_stock}</td>
                    <td><span className={`badge ${p.stock_status === 'in_stock' ? 'badge-green' : p.stock_status === 'low_stock' ? 'badge-yellow' : 'badge-red'}`}>{p.stock_status?.replace('_', ' ')}</span></td>
                    <td>{(Number(p.stock_quantity) * Number(p.selling_price)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Credit Report */}
      {activeTab === 'Customers' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-surface-100 dark:border-surface-700 font-semibold">Customer Credit Report</div>
          <table className="table text-sm">
            <thead><tr><th>Customer</th><th>Type</th><th>Credit Limit</th><th>Used Credit</th><th>Available</th><th>Utilization</th></tr></thead>
            <tbody>
              {customerData.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-surface-400">No customers with outstanding credit</td></tr>
              ) : customerData.map(c => {
                const utilization = c.credit_limit > 0 ? (c.current_credit / c.credit_limit) * 100 : 0;
                return (
                  <tr key={c.name}>
                    <td className="font-medium">{c.name}</td>
                    <td><span className={`badge ${c.customer_type === 'retail' ? 'badge-blue' : c.customer_type === 'dealer' ? 'badge-orange' : 'badge-purple'}`}>{c.customer_type}</span></td>
                    <td>₹{Number(c.credit_limit).toLocaleString('en-IN')}</td>
                    <td className="text-red-600 font-semibold">₹{Number(c.current_credit).toLocaleString('en-IN')}</td>
                    <td className={Number(c.credit_limit) - Number(c.current_credit) < 0 ? 'text-red-500' : 'text-green-600'}>
                      ₹{(Number(c.credit_limit) - Number(c.current_credit)).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-surface-200 dark:bg-surface-700 rounded-full h-2">
                          <div className={`h-2 rounded-full ${utilization > 90 ? 'bg-red-500' : utilization > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(utilization, 100)}%` }} />
                        </div>
                        <span className="text-xs w-10">{utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vehicle Report */}
      {activeTab === 'Vehicles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="card p-5">
            <h3 className="font-semibold mb-4">Fleet Status Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={vehicleData} cx="50%" cy="50%" outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {vehicleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold mb-4">Fleet Summary</h3>
            <div className="space-y-3">
              {vehicleData.map((v, i) => (
                <div key={v.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm capitalize">{v.name}</span>
                  </div>
                  <span className="font-bold text-surface-800 dark:text-white">{v.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-surface-100 dark:border-surface-700 flex justify-between font-semibold">
                <span>Total Fleet</span>
                <span>{vehicleData.reduce((s, v) => s + v.value, 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Report */}
      {activeTab === 'Maintenance' && (
        <div className="card p-5">
          <h3 className="font-semibold mb-2">Maintenance Cost Trend</h3>
          <p className="text-surface-400 text-sm mb-4">Total spent: {formatCurrency(maintenanceData.reduce((s, d) => s + d.cost, 0))}</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={maintenanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? Math.round(v / 1000) + 'k' : v}`} />
              <Tooltip formatter={v => [formatCurrency(v), 'Maintenance Cost']} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="cost" name="Cost" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
