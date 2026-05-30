"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData, useLookup, useCompanySettings } from "@/lib/hooks";
import { generatePurchasePDF } from "@/lib/pdf/generators";
import {
  PageHeader,
  DataTable,
  Pagination,
  SearchBar,
  Modal,
  FormField,
  StatusBadge,
  EmptyState,
} from "@/components/shared";
import toast from "react-hot-toast";
import { Plus, Eye, FileText, ShoppingCart, Trash2 } from "lucide-react";

export default function PurchasePage() {
  const { profile, hasPermission } = useAuth();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  // Cached lookups
  const { data: supplierRows } = useLookup("suppliers", "id, name");
  const { data: productRows } = useLookup(
    "products",
    "id, name, buying_price, tax_rate, stock_quantity",
  );
  const { settings: company } = useCompanySettings();
  const suppliers = supplierRows;
  const products = productRows;
  const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });

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
  } = useTableData("purchase_orders", {
    columns: "*, suppliers(name), purchase_items(*, products(name))",
    search,
    searchColumns: ["purchase_number"],
    orderBy: "created_at",
  });

  const { register, handleSubmit, reset, watch, control, setValue } = useForm({
    defaultValues: {
      items: [{ product_id: "", quantity: 1, buying_price: 0, tax_rate: 18 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchItems = watch("items");

  useEffect(() => {
    let subtotal = 0,
      taxAmt = 0;
    (watchItems || []).forEach((item) => {
      const lineTotal =
        Number(item.quantity || 0) * Number(item.buying_price || 0);
      subtotal += lineTotal;
      taxAmt += lineTotal * (Number(item.tax_rate || 0) / 100);
    });
    setTotals({ subtotal, tax: taxAmt, total: subtotal + taxAmt });
  }, [JSON.stringify(watchItems)]);

  const onProductSelect = (index, productId) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setValue(`items.${index}.buying_price`, prod.buying_price);
      setValue(`items.${index}.tax_rate`, prod.tax_rate || 18);
    }
  };

  const generateNumber = async () => {
    const prefix = company?.purchase_prefix || "PO";
    const { count } = await supabase
      .from("purchase_orders")
      .select("id", { count: "exact" });
    return `${prefix}${String((count || 0) + 1).padStart(6, "0")}`;
  };

  const onSubmit = async (formData) => {
    setSaving(true);
    const poNumber = await generateNumber();
    const itemsPayload = (formData.items || []).map((item) => {
      const qty = Number(item.quantity);
      const price = Number(item.buying_price);
      const taxRate = Number(item.tax_rate || 0);
      const lineTotal = qty * price;
      return {
        product_id: item.product_id,
        quantity: qty,
        buying_price: price,
        tax_rate: taxRate,
        tax_amount: lineTotal * (taxRate / 100),
        total: lineTotal + lineTotal * (taxRate / 100),
      };
    });

    const { data: po, error } = await supabase
      .from("purchase_orders")
      .insert({
        purchase_number: poNumber,
        supplier_id: formData.supplier_id || null,
        purchase_date:
          formData.purchase_date || new Date().toISOString().split("T")[0],
        subtotal: totals.subtotal,
        tax_amount: totals.tax,
        total_amount: totals.total,
        payment_status: formData.payment_status || "pending",
        payment_method: formData.payment_method,
        notes: formData.notes,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (!po || error) {
      toast.error(error?.message || "Failed");
      setSaving(false);
      return;
    }

    await supabase
      .from("purchase_items")
      .insert(itemsPayload.map((it) => ({ ...it, purchase_id: po.id })));

    // Update stock
    for (const item of itemsPayload) {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) {
        const newStock = Number(prod.stock_quantity || 0) + item.quantity;
        await supabase
          .from("products")
          .update({ stock_quantity: newStock, buying_price: item.buying_price })
          .eq("id", item.product_id);
        await supabase.from("stock_transactions").insert({
          product_id: item.product_id,
          quantity: item.quantity,
          previous_stock: prod.stock_quantity || 0,
          new_stock: newStock,
          transaction_type: "purchased",
          reference_type: "purchase",
          reference_id: po.id,
          buying_price: item.buying_price,
          created_by: profile?.id,
        });
      }
    }

    toast.success(`Purchase Order ${poNumber} created! Stock updated.`);
    setFormOpen(false);
    refresh();
    setSaving(false);
  };

  const printPDF = async (po) => {
    const { data } = await supabase
      .from("purchase_orders")
      .select("*, suppliers(*), purchase_items(*, products(name))")
      .eq("id", po.id)
      .single();
    const doc = generatePurchasePDF(data, company);
    doc.save(`PO_${po.purchase_number}.pdf`);
  };

  const columns = [
    {
      key: "purchase_number",
      label: "PO #",
      render: (v) => (
        <span className="font-mono font-semibold text-brand-600">{v}</span>
      ),
    },
    {
      key: "purchase_date",
      label: "Date",
      render: (v) => new Date(v).toLocaleDateString("en-IN"),
    },
    { key: "suppliers", label: "Supplier", render: (v) => v?.name || "-" },
    {
      key: "subtotal",
      label: "Subtotal",
      render: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
    },
    {
      key: "tax_amount",
      label: "Tax",
      render: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
    },
    {
      key: "total_amount",
      label: "Total",
      render: (v) => (
        <span className="font-semibold">
          ₹{Number(v).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "payment_status",
      label: "Status",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "id",
      label: "Actions",
      width: "100px",
      render: (_, row) => (
        <div className="flex gap-1">
          <button
            onClick={() => {
              setSelected(row);
              setViewOpen(true);
            }}
            className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
          >
            <Eye className="w-4 h-4 text-surface-500" />
          </button>
          <button
            onClick={() => printPDF(row)}
            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
          >
            <FileText className="w-4 h-4 text-blue-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Orders"
        subtitle={`${total} total orders`}
        actions={
          hasPermission("create_purchase") && (
            <button
              onClick={() => {
                reset({
                  items: [
                    {
                      product_id: "",
                      quantity: 1,
                      buying_price: 0,
                      tax_rate: 18,
                    },
                  ],
                  purchase_date: new Date().toISOString().split("T")[0],
                });
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> New Purchase
            </button>
          )
        }
      />

      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search purchase number..."
            className="max-w-md"
          />
        </div>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={ShoppingCart}
              title="No purchase orders"
              action={
                hasPermission("create_purchase") && (
                  <button
                    onClick={() => setFormOpen(true)}
                    className="btn-primary"
                  >
                    New Purchase
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

      {/* Create Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New Purchase Order"
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Supplier">
              <select className="input" {...register("supplier_id")}>
                <option value="">Select supplier (optional)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Purchase Date" required>
              <input
                type="date"
                className="input"
                {...register("purchase_date", { required: true })}
              />
            </FormField>
            <FormField label="Payment Status">
              <select className="input" {...register("payment_status")}>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </select>
            </FormField>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm text-surface-700 dark:text-surface-300">
                Products
              </h3>
              <button
                type="button"
                onClick={() =>
                  append({
                    product_id: "",
                    quantity: 1,
                    buying_price: 0,
                    tax_rate: 18,
                  })
                }
                className="btn-secondary text-xs py-1 px-2"
              >
                + Add Product
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fields.map((field, i) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-2 items-end bg-surface-50 dark:bg-surface-800/50 rounded-lg p-2"
                >
                  <div className="col-span-5">
                    <label className="label text-xs">Product</label>
                    <select
                      className="input text-xs"
                      {...register(`items.${i}.product_id`)}
                      onChange={(e) => onProductSelect(i, e.target.value)}
                    >
                      <option value="">Select product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="label text-xs">Qty</label>
                    <input
                      type="number"
                      step="0.001"
                      className="input text-xs"
                      {...register(`items.${i}.quantity`)}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="label text-xs">Buying Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      {...register(`items.${i}.buying_price`)}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="label text-xs">Tax%</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      {...register(`items.${i}.tax_rate`)}
                    />
                  </div>
                  <div className="col-span-1">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="w-full p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 min-w-[220px] text-sm space-y-1">
              <div className="flex justify-between text-surface-500">
                <span>Subtotal:</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-surface-500">
                <span>Tax:</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <hr className="border-surface-200 dark:border-surface-600" />
              <div className="flex justify-between font-bold text-base">
                <span>Total:</span>
                <span className="text-brand-600">
                  ₹{totals.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <FormField label="Notes">
            <textarea
              rows={2}
              className="input resize-none"
              {...register("notes")}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Creating..." : "Create Purchase Order"}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={`PO ${selected?.purchase_number}`}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-surface-400">Supplier:</span>
                <p className="font-medium">
                  {selected.suppliers?.name || "N/A"}
                </p>
              </div>
              <div>
                <span className="text-surface-400">Date:</span>
                <p className="font-medium">
                  {new Date(selected.purchase_date).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div>
                <span className="text-surface-400">Status:</span>
                <div className="mt-1">
                  <StatusBadge status={selected.payment_status} />
                </div>
              </div>
            </div>
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Tax</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {(selected.purchase_items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.products?.name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{Number(item.buying_price).toFixed(2)}</td>
                    <td>{item.tax_rate}%</td>
                    <td className="font-semibold">
                      ₹{Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-between items-center">
              <span className="text-surface-500 text-sm">
                Total:{" "}
                <strong className="text-surface-900 dark:text-white text-base">
                  ₹{Number(selected.total_amount).toLocaleString("en-IN")}
                </strong>
              </span>
              <button
                onClick={() => printPDF(selected)}
                className="btn-secondary"
              >
                <FileText className="w-4 h-4" /> Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
