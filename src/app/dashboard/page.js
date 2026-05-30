'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useDashboardStats } from '@/lib/hooks';
import { StatCard } from '@/components/shared';
import { createClient } from '@/lib/supabase/client';
import {
  Users, Package, Building2, Receipt, Car, AlertTriangle,
  TrendingUp, ShoppingCart, DollarSign, Truck,
} from 'lucide-react';

const COLORS = ['#ea580c', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function DashboardPage() {
  const { stats, loading } = useDashboardStats();
  const [salesData, setSalesData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [maintenanceDue, setMaintenanceDue] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      // Monthly sales for last 6 months
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push({
          month: d.toLocaleString('en-IN', { month: 'short' }),
          year: d.getFullYear(),
          start: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0],
          end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0],
        });
      }

      const salesPromises = months.map(m =>
        supabase.from('invoices').select('total_amount')
          .gte('invoice_date', m.start).lte('invoice_date', m.end)
          .is('deleted_at', null)
          .then(({ data }) => ({
            name: m.month,
            sales: (data || []).reduce((s, r) => s + Number(r.total_amount), 0),
          }))
      );
      setSalesData(await Promise.all(salesPromises));

      // Category-wise sales
      const { data: catData } = await supabase
        .from('invoice_items')
        .select('product_id, total, products(category_id, product_categories(name))');
      const catMap = {};
      (catData || []).forEach(item => {
        const catName = item.products?.product_categories?.name || 'Uncategorized';
        catMap[catName] = (catMap[catName] || 0) + Number(item.total);
      });
      setCategoryData(Object.entries(catMap).map(([name, value]) => ({ name, value })).slice(0, 6));

      // Recent invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('invoice_number, invoice_date, total_amount, status, customers(name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentInvoices(invData || []);

      // Low stock
      const { data: stockData } = await supabase
        .from('products')
        .select('name, stock_quantity, minimum_stock, stock_status')
        .in('stock_status', ['low_stock', 'out_of_stock'])
        .is('deleted_at', null)
        .limit(5);
      setLowStockItems(stockData || []);

      // Maintenance due
      const { data: maintData } = await supabase
        .from('maintenance_records')
        .select('next_service_date, vehicles(vehicle_name, registration_number)')
        .not('next_service_date', 'is', null)
        .gte('next_service_date', new Date().toISOString().split('T')[0])
        .order('next_service_date', { ascending: true })
        .limit(5);
      setMaintenanceDue(maintData || []);
    };
    load();
  }, []);

  const formatCurrency = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-surface-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard title="Today's Sales" value={formatCurrency(stats.todaySales)} icon={TrendingUp} color="brand" loading={loading} />
        <StatCard title="Monthly Sales" value={formatCurrency(stats.monthlySales)} icon={DollarSign} color="green" loading={loading} />
        <StatCard title="Customers" value={stats.totalCustomers?.toLocaleString()} icon={Users} color="blue" loading={loading} />
        <StatCard title="Products" value={stats.totalProducts?.toLocaleString()} icon={Package} color="purple" loading={loading} />
        <StatCard title="Suppliers" value={stats.totalSuppliers?.toLocaleString()} icon={Building2} color="yellow" loading={loading} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Vehicles" value={stats.totalVehicles?.toLocaleString()} subtitle={`${stats.availableVehicles} available`} icon={Car} color="blue" loading={loading} />
        <StatCard title="Pending Credits" value={formatCurrency(stats.pendingCredits)} icon={Receipt} color="red" loading={loading} />
        <StatCard title="Low Stock" value={stats.lowStockCount?.toLocaleString()} icon={AlertTriangle} color="yellow" loading={loading} />
        <StatCard title="Deliveries" value="—" icon={Truck} color="brand" loading={loading} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Monthly sales area chart */}
        <div className="card p-5 xl:col-span-2">
          <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Monthly Sales</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ea580c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ea580c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} />
              <Tooltip
                formatter={(v) => [formatCurrency(v), 'Sales']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={2.5} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie chart */}
        <div className="card p-5">
          <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">Sales by Category</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value">
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [formatCurrency(v), 'Sales']}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: '11px' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-surface-400 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Bottom widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent invoices */}
        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white">Recent Invoices</h3>
            <a href="/invoices" className="text-brand-600 text-xs hover:underline">View all</a>
          </div>
          <div className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-surface-400 text-sm text-center py-4">No invoices yet</p>
            ) : recentInvoices.map((inv) => (
              <div key={inv.invoice_number} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{inv.invoice_number}</p>
                  <p className="text-xs text-surface-400">{inv.customers?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">{formatCurrency(inv.total_amount)}</p>
                  <span className={`badge text-xs ${inv.status === 'paid' ? 'badge-green' : inv.status === 'partial' ? 'badge-yellow' : 'badge-red'}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alerts */}
        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white">Low Stock Alerts</h3>
            <a href="/products" className="text-brand-600 text-xs hover:underline">View all</a>
          </div>
          <div className="space-y-3">
            {lowStockItems.length === 0 ? (
              <p className="text-surface-400 text-sm text-center py-4">No low stock items</p>
            ) : lowStockItems.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${p.stock_status === 'out_of_stock' ? 'text-red-500' : 'text-yellow-500'}`} />
                  <p className="text-sm text-surface-800 dark:text-surface-200 truncate">{p.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-mono">{p.stock_quantity} / {p.minimum_stock}</p>
                  <span className={`badge text-xs ${p.stock_status === 'out_of_stock' ? 'badge-red' : 'badge-yellow'}`}>
                    {p.stock_status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming maintenance */}
        <div className="card p-5">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-display font-semibold text-surface-900 dark:text-white">Upcoming Maintenance</h3>
            <a href="/maintenance" className="text-brand-600 text-xs hover:underline">View all</a>
          </div>
          <div className="space-y-3">
            {maintenanceDue.length === 0 ? (
              <p className="text-surface-400 text-sm text-center py-4">No scheduled maintenance</p>
            ) : maintenanceDue.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-surface-100 dark:border-surface-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{m.vehicles?.vehicle_name}</p>
                  <p className="text-xs text-surface-400">{m.vehicles?.registration_number}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-brand-600">
                    {new Date(m.next_service_date).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
