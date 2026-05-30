// LOCATION: src/app/products/page.js
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData, useLookup } from "@/lib/hooks";
import { exportToExcel, EXPORT_COLUMNS } from "@/lib/excel/exporters";
import {
  PageHeader,
  DataTable,
  Pagination,
  SearchBar,
  Modal,
  ConfirmDialog,
  FormField,
  Select,
  EmptyState,
} from "@/components/shared";
import toast from "react-hot-toast";
import {
  Plus,
  Download,
  Pencil,
  Trash2,
  Eye,
  Package,
  RefreshCw,
  History,
  TrendingUp,
} from "lucide-react";

const UNITS = ["pcs", "kg", "ltr", "mtr", "set", "box", "pair", "nos"];

export default function ProductsPage() {
  const { profile, hasPermission } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatus] = useState("");
  const [catFilter, setCat] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [restockOpen, setRestock] = useState(false);
  const [historyOpen, setHistory] = useState(false);
  const [deleteOpen, setDelete] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stockHistory, setStockHistory] = useState([]);
  const [useLastPrice, setUseLastPrice] = useState(true);

  // Cached lookups — fetched once per session, never on re-render
  const { data: categories } = useLookup("product_categories", "id, name");
  const { data: suppliers } = useLookup("suppliers", "id, name");

  const {
    data,
    total,
    page,
    pageSize,
    loading,
    totalPages,
    setPage,
    setPageSize,
    refresh,
  } = useTableData("products", {
    columns: "*, product_categories(name), suppliers(name)",
    search,
    searchColumns: ["name", "product_code"],
    filters: {
      ...(statusFilter ? { stock_status: statusFilter } : {}),
      ...(catFilter ? { category_id: catFilter } : {}),
    },
    orderBy: "name",
    orderAsc: true,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm();
  const {
    register: rReg,
    handleSubmit: rSubmit,
    reset: rReset,
    formState: { errors: rErrors },
  } = useForm();

  const openCreate = () => {
    reset({ tax_rate: 18, unit: "pcs", stock_quantity: 0, minimum_stock: 0 });
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (row) => {
    setSelected(row);
    // Pass flat values so register fields populate correctly
    reset({
      name: row.name,
      description: row.description,
      category_id: row.category_id || "",
      supplier_id: row.supplier_id || "",
      buying_price: row.buying_price,
      selling_price: row.selling_price,
      stock_quantity: row.stock_quantity,
      minimum_stock: row.minimum_stock,
      tax_rate: row.tax_rate,
      unit: row.unit,
      hsn_code: row.hsn_code,
    });
    setFormOpen(true);
  };
  const openView = (row) => {
    setSelected(row);
    setViewOpen(true);
  };
  const openDelete = (row) => {
    setSelected(row);
    setDelete(true);
  };
  const openRestock = (row) => {
    setSelected(row);
    rReset({ quantity: "", buying_price: row.buying_price, notes: "" });
    setUseLastPrice(true);
    setRestock(true);
  };

  const openHistory = async (row) => {
    setSelected(row);
    setStockHistory([]);
    setHistory(true);
    const { data: hist } = await supabase
      .from("stock_transactions")
      .select("*")
      .eq("product_id", row.id)
      .order("created_at", { ascending: false })
      .limit(60);
    setStockHistory(hist || []);
  };

  const profitMargin = (row) => {
    const buy = Number(row.buying_price || 0);
    const sell = Number(row.selling_price || 0);
    if (!buy || !sell) return null;
    return (((sell - buy) / sell) * 100).toFixed(1);
  };

  const onSubmit = async (fd) => {
    setSaving(true);
    const payload = {
      name: fd.name,
      description: fd.description || null,
      category_id: fd.category_id || null,
      supplier_id: fd.supplier_id || null,
      buying_price: Number(fd.buying_price) || 0,
      selling_price: Number(fd.selling_price) || 0,
      stock_quantity: Number(fd.stock_quantity) || 0,
      minimum_stock: Number(fd.minimum_stock) || 0,
      tax_rate: Number(fd.tax_rate) || 18,
      unit: fd.unit || "pcs",
      hsn_code: fd.hsn_code || null,
      updated_by: profile?.id,
    };

    let error;
    if (selected) {
      ({ error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", selected.id));
    } else {
      const code = `PRD${String(Date.now()).slice(-6)}`;
      ({ error } = await supabase
        .from("products")
        .insert({ ...payload, product_code: code, created_by: profile?.id }));
    }

    if (error) toast.error(error.message);
    else {
      toast.success(selected ? "Product updated!" : "Product created!");
      setFormOpen(false);
      refresh();
    }
    setSaving(false);
  };

  const onRestock = async (fd) => {
    setSaving(true);
    const qty = Number(fd.quantity);
    if (qty <= 0) {
      toast.error("Quantity must be positive");
      setSaving(false);
      return;
    }

    const newBuyPrice = useLastPrice
      ? Number(selected.buying_price)
      : Number(fd.buying_price);
    const newStock = Number(selected.stock_quantity) + qty;

    const [{ error: txErr }, { error: prodErr }] = await Promise.all([
      supabase.from("stock_transactions").insert({
        product_id: selected.id,
        quantity: qty,
        previous_stock: selected.stock_quantity,
        new_stock: newStock,
        transaction_type: "purchased",
        buying_price: newBuyPrice,
        notes: fd.notes,
        created_by: profile?.id,
      }),
      supabase
        .from("products")
        .update({
          stock_quantity: newStock,
          buying_price: newBuyPrice,
          updated_by: profile?.id,
        })
        .eq("id", selected.id),
    ]);

    if (txErr || prodErr) toast.error((txErr || prodErr).message);
    else {
      toast.success(`Restocked ${qty} units!`);
      setRestock(false);
      refresh();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString(), updated_by: profile?.id })
      .eq("id", selected.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Product deleted");
      setDelete(false);
      refresh();
    }
    setDeleting(false);
  };

  const stockBadge = (s) => {
    const cls = {
      in_stock: "badge-green",
      low_stock: "badge-yellow",
      out_of_stock: "badge-red",
    };
    return (
      <span className={`badge ${cls[s] || "badge-gray"}`}>
        {s?.replace("_", " ")}
      </span>
    );
  };

  const columns = [
    { key: "product_code", label: "Code", width: "100px" },
    {
      key: "name",
      label: "Product",
      render: (v, row) => (
        <div>
          <p className="font-medium text-surface-900 dark:text-white">{v}</p>
          <p className="text-xs text-surface-400">
            {row.product_categories?.name || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "stock_quantity",
      label: "Stock",
      render: (v, row) => (
        <div>
          <span
            className={`font-mono font-semibold ${Number(v) <= 0 ? "text-red-500" : Number(v) <= row.minimum_stock ? "text-yellow-500" : "text-green-600"}`}
          >
            {v}
          </span>
          <span className="text-xs text-surface-400 ml-1">{row.unit}</span>
        </div>
      ),
    },
    {
      key: "buying_price",
      label: "Buy",
      render: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
    },
    {
      key: "selling_price",
      label: "Sell",
      render: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
    },
    {
      key: "selling_price",
      label: "Margin",
      render: (_, row) => {
        const m = profitMargin(row);
        if (!m) return "—";
        return (
          <span
            className={`font-semibold ${Number(m) >= 20 ? "text-green-600" : Number(m) >= 10 ? "text-yellow-500" : "text-red-500"}`}
          >
            {m}%
          </span>
        );
      },
    },
    { key: "stock_status", label: "Status", render: (v) => stockBadge(v) },
    {
      key: "id",
      label: "Actions",
      width: "160px",
      render: (_, row) => (
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => openView(row)}
            title="View"
            className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
          >
            <Eye className="w-4 h-4 text-surface-500" />
          </button>
          <button
            onClick={() => openHistory(row)}
            title="History"
            className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
          >
            <History className="w-4 h-4 text-purple-500" />
          </button>
          {hasPermission("restock_product") && (
            <button
              onClick={() => openRestock(row)}
              title="Restock"
              className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
            >
              <RefreshCw className="w-4 h-4 text-green-500" />
            </button>
          )}
          {hasPermission("edit_product") && (
            <button
              onClick={() => openEdit(row)}
              title="Edit"
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              <Pencil className="w-4 h-4 text-blue-500" />
            </button>
          )}
          {hasPermission("delete_product") && (
            <button
              onClick={() => openDelete(row)}
              title="Delete"
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        subtitle={`${total} total products`}
        actions={
          <>
            <button
              onClick={() =>
                exportToExcel(data, EXPORT_COLUMNS.products, "products")
              }
              className="btn-secondary"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            {hasPermission("create_product") && (
              <button onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}
          </>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700 flex flex-wrap gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name or code…"
            className="flex-1 min-w-[200px]"
          />
          {/* Category filter using live data */}
          <select
            value={catFilter}
            onChange={(e) => setCat(e.target.value)}
            className="input w-44"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Select
            options={[
              { value: "in_stock", label: "In Stock" },
              { value: "low_stock", label: "Low Stock" },
              { value: "out_of_stock", label: "Out of Stock" },
            ]}
            placeholder="All Status"
            value={statusFilter}
            onChange={setStatus}
            className="w-36"
          />
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={Package}
              title="No products found"
              action={
                hasPermission("create_product") && (
                  <button onClick={openCreate} className="btn-primary">
                    Add Product
                  </button>
                )
              }
            />
          }
        />
        <div className="p-4 border-t border-surface-100 dark:border-surface-700">
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* ── Create / Edit ──────────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={selected ? "Edit Product" : "Add Product"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormField
                label="Product Name"
                required
                error={errors.name?.message}
              >
                <input
                  className="input"
                  autoFocus
                  {...register("name", { required: "Required" })}
                />
              </FormField>
            </div>

            {/* Category — native select with categories from useLookup */}
            <FormField label="Category">
              <select className="input" {...register("category_id")}>
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Supplier */}
            <FormField label="Supplier">
              <select className="input" {...register("supplier_id")}>
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="Buying Price (₹)"
              required
              error={errors.buying_price?.message}
            >
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                {...register("buying_price", { required: "Required", min: 0 })}
              />
            </FormField>
            <FormField
              label="Selling Price (₹)"
              required
              error={errors.selling_price?.message}
            >
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                {...register("selling_price", { required: "Required", min: 0 })}
              />
            </FormField>

            <FormField label="Stock Quantity">
              <input
                type="number"
                step="0.001"
                min="0"
                className="input"
                {...register("stock_quantity")}
              />
            </FormField>
            <FormField label="Minimum Stock Alert">
              <input
                type="number"
                step="0.001"
                min="0"
                className="input"
                {...register("minimum_stock")}
              />
            </FormField>

            <FormField label="Unit">
              <select className="input" {...register("unit")}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tax Rate (%)">
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                {...register("tax_rate")}
              />
            </FormField>
            <FormField label="HSN Code">
              <input className="input" {...register("hsn_code")} />
            </FormField>

            <div className="col-span-2">
              <FormField label="Description">
                <textarea
                  rows={2}
                  className="input resize-none"
                  {...register("description")}
                />
              </FormField>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? "Saving…"
                : selected
                  ? "Update Product"
                  : "Create Product"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Restock ────────────────────────────────────────────────────────── */}
      <Modal
        open={restockOpen}
        onClose={() => setRestock(false)}
        title={`Restock: ${selected?.name}`}
        size="sm"
      >
        <form onSubmit={rSubmit(onRestock)} className="space-y-4">
          <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3 text-sm space-y-1">
            <p className="text-surface-500">
              Current Stock:{" "}
              <strong className="text-surface-900 dark:text-white">
                {selected?.stock_quantity} {selected?.unit}
              </strong>
            </p>
            <p className="text-surface-500">
              Last Buy Price: <strong>₹{selected?.buying_price}</strong>
            </p>
          </div>

          <FormField
            label="Quantity to Add"
            required
            error={rErrors.quantity?.message}
          >
            <input
              type="number"
              step="0.001"
              autoFocus
              className="input"
              {...rReg("quantity", {
                required: "Required",
                min: { value: 0.001, message: "Must be > 0" },
              })}
            />
          </FormField>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useLastPrice}
              onChange={(e) => setUseLastPrice(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-surface-700 dark:text-surface-300">
              Use previous buying price (₹{selected?.buying_price})
            </span>
          </label>

          {!useLastPrice && (
            <FormField
              label="New Buying Price (₹)"
              error={rErrors.buying_price?.message}
            >
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                {...rReg("buying_price", { required: "Required" })}
              />
            </FormField>
          )}

          <FormField label="Notes">
            <input
              className="input"
              {...rReg("notes")}
              placeholder="Optional"
            />
          </FormField>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setRestock(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving…" : "Restock"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Stock History ──────────────────────────────────────────────────── */}
      <Modal
        open={historyOpen}
        onClose={() => setHistory(false)}
        title={`Stock History: ${selected?.name}`}
        size="lg"
      >
        {/* Avg buy price summary */}
        {stockHistory.length > 0 &&
          (() => {
            const purchases = stockHistory.filter(
              (t) => t.transaction_type === "purchased" && t.buying_price,
            );
            const avgBuy = purchases.length
              ? (
                  purchases.reduce((s, t) => s + Number(t.buying_price), 0) /
                  purchases.length
                ).toFixed(2)
              : null;
            const margin =
              avgBuy && selected?.selling_price
                ? (
                    ((Number(selected.selling_price) - Number(avgBuy)) /
                      Number(selected.selling_price)) *
                    100
                  ).toFixed(1)
                : null;
            return (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-surface-400">Avg Buy Price</p>
                  <p className="font-bold text-surface-900 dark:text-white mt-1">
                    ₹{avgBuy || "—"}
                  </p>
                </div>
                <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-surface-400">Sell Price</p>
                  <p className="font-bold text-surface-900 dark:text-white mt-1">
                    ₹{selected?.selling_price}
                  </p>
                </div>
                <div
                  className={`rounded-xl p-3 text-center ${Number(margin) >= 20 ? "bg-green-50 dark:bg-green-900/20" : "bg-yellow-50 dark:bg-yellow-900/20"}`}
                >
                  <p className="text-xs text-surface-400">Profit Margin</p>
                  <p
                    className={`font-bold mt-1 ${Number(margin) >= 20 ? "text-green-600" : "text-yellow-600"}`}
                  >
                    {margin ? `${margin}%` : "—"}
                  </p>
                </div>
              </div>
            );
          })()}

        <div className="table-container max-h-80">
          <table className="table text-xs">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Prev Stock</th>
                <th>New Stock</th>
                <th>Buy Price</th>
              </tr>
            </thead>
            <tbody>
              {stockHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-surface-400">
                    No history
                  </td>
                </tr>
              ) : (
                stockHistory.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {new Date(
                        t.transaction_date || t.created_at,
                      ).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <span
                        className={`badge text-xs ${
                          t.transaction_type === "sold"
                            ? "badge-red"
                            : t.transaction_type === "purchased"
                              ? "badge-green"
                              : "badge-blue"
                        }`}
                      >
                        {t.transaction_type}
                      </span>
                    </td>
                    <td className="font-mono">{t.quantity}</td>
                    <td className="font-mono text-surface-400">
                      {t.previous_stock}
                    </td>
                    <td className="font-mono font-semibold">{t.new_stock}</td>
                    <td>{t.buying_price ? `₹${t.buying_price}` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* ── View ───────────────────────────────────────────────────────────── */}
      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Product Details"
        size="md"
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-surface-100 dark:border-surface-700">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <Package className="w-6 h-6 text-brand-600" />
              </div>
              <div>
                <h3 className="font-bold text-surface-900 dark:text-white">
                  {selected.name}
                </h3>
                <p className="text-surface-400 text-xs">
                  {selected.product_code}
                </p>
                {stockBadge(selected.stock_status)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["Category", selected.product_categories?.name],
                ["Stock", `${selected.stock_quantity} ${selected.unit}`],
                ["Min Stock", selected.minimum_stock],
                [
                  "Buy Price",
                  `₹${Number(selected.buying_price).toLocaleString("en-IN")}`,
                ],
                [
                  "Sell Price",
                  `₹${Number(selected.selling_price).toLocaleString("en-IN")}`,
                ],
                [
                  "Margin",
                  profitMargin(selected) ? `${profitMargin(selected)}%` : null,
                ],
                ["Tax Rate", `${selected.tax_rate}%`],
                ["HSN Code", selected.hsn_code],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <span className="text-surface-400">{k}: </span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
            </div>
            {selected.description && (
              <p className="text-surface-500 italic border-t pt-3 text-xs">
                {selected.description}
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setViewOpen(false);
                  openHistory(selected);
                }}
                className="btn-secondary text-xs"
              >
                <History className="w-3.5 h-3.5" /> Stock History
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDelete(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        message={`Delete "${selected?.name}"?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
