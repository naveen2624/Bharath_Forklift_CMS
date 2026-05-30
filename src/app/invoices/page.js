"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData, useLookup, useCompanySettings } from "@/lib/hooks";
import { generateInvoicePDF } from "@/lib/pdf/generators";
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
  StatusBadge,
  EmptyState,
} from "@/components/shared";
import toast from "react-hot-toast";
import {
  Plus,
  Download,
  Pencil,
  Eye,
  FileText,
  Printer,
  CreditCard,
  Trash2,
  Receipt,
} from "lucide-react";

const PAYMENT_METHODS = [
  "cash",
  "upi",
  "card",
  "net_banking",
  "credit",
  "other",
];

export default function InvoicesPage() {
  const { profile, hasPermission } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  });

  // Cached lookups — one fetch, never repeated
  const { data: customerRows } = useLookup("customers", "id, name, mobile");
  const { data: productRows } = useLookup(
    "products",
    "id, name, selling_price, tax_rate, stock_quantity",
  );
  const { settings: company } = useCompanySettings();

  const customers = customerRows.map((c) => ({
    value: c.id,
    label: `${c.name} — ${c.mobile}`,
  }));
  const products = productRows;

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
  } = useTableData("invoices", {
    columns: "*, customers(name, mobile), invoice_items(*, products(name))",
    search,
    searchColumns: ["invoice_number"],
    filters: statusFilter ? { status: statusFilter } : {},
    orderBy: "created_at",
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      items: [
        {
          product_id: "",
          quantity: 1,
          unit_price: 0,
          tax_rate: 18,
          discount_percent: 0,
        },
      ],
      discount_percent: 0,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const {
    register: pReg,
    handleSubmit: pSubmit,
    reset: pReset,
    watch: pWatch,
  } = useForm();

  const watchItems = watch("items");
  const watchDiscount = watch("discount_percent");

  // Recalculate totals
  useEffect(() => {
    let subtotal = 0;
    (watchItems || []).forEach((item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      const taxRate = Number(item.tax_rate || 0);
      const discPct = Number(item.discount_percent || 0);
      const lineTotal = qty * price;
      const discAmt = lineTotal * (discPct / 100);
      const taxableAmt = lineTotal - discAmt;
      const taxAmt = taxableAmt * (taxRate / 100);
      subtotal += lineTotal;
    });
    const discPct = Number(watchDiscount || 0);
    const discAmt = subtotal * (discPct / 100);
    const afterDisc = subtotal - discAmt;
    // Simplified: aggregate tax from items
    let taxAmt = 0;
    (watchItems || []).forEach((item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unit_price || 0);
      const taxRate = Number(item.tax_rate || 0);
      const disc = Number(item.discount_percent || 0);
      const lineNet = qty * price * (1 - disc / 100) * (1 - discPct / 100);
      taxAmt += lineNet * (taxRate / 100);
    });
    setTotals({
      subtotal,
      discount: discAmt,
      tax: taxAmt,
      total: afterDisc + taxAmt,
    });
  }, [JSON.stringify(watchItems), watchDiscount]);

  const onProductSelect = (index, productId) => {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setValue(`items.${index}.unit_price`, prod.selling_price);
      setValue(`items.${index}.tax_rate`, prod.tax_rate || 18);
    }
  };

  const generateNumber = async () => {
    const prefix = company?.invoice_prefix || "INV";
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact" });
    return `${prefix}${String((count || 0) + 1).padStart(6, "0")}`;
  };

  const onSubmit = async (formData) => {
    setSaving(true);
    const invoiceNumber = await generateNumber();
    const itemsPayload = (formData.items || []).map((item) => {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      const taxRate = Number(item.tax_rate || 0);
      const discPct = Number(item.discount_percent || 0);
      const lineTotal = qty * price;
      const discAmt =
        lineTotal * (discPct / 100) +
        lineTotal * (Number(formData.discount_percent || 0) / 100);
      const taxAmt = (lineTotal - discAmt) * (taxRate / 100);
      const prod = products.find((p) => p.id === item.product_id);
      return {
        product_id: item.product_id,
        product_name: prod?.name || "",
        quantity: qty,
        unit_price: price,
        tax_rate: taxRate,
        tax_amount: taxAmt,
        discount_percent: discPct,
        discount_amount: discAmt,
        total: lineTotal - discAmt + taxAmt,
      };
    });

    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: formData.customer_id,
        invoice_date:
          formData.invoice_date || new Date().toISOString().split("T")[0],
        due_date: formData.due_date,
        subtotal: totals.subtotal,
        discount_percent: Number(formData.discount_percent || 0),
        discount_amount: totals.discount,
        tax_amount: totals.tax,
        total_amount: totals.total,
        paid_amount: 0,
        status: "pending",
        notes: formData.notes,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (!inv || error) {
      toast.error(error?.message || "Failed");
      setSaving(false);
      return;
    }

    // Insert items
    await supabase
      .from("invoice_items")
      .insert(itemsPayload.map((it) => ({ ...it, invoice_id: inv.id })));

    // Reduce stock
    for (const item of itemsPayload) {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) {
        const newStock = Number(prod.stock_quantity) - item.quantity;
        await supabase
          .from("products")
          .update({ stock_quantity: newStock })
          .eq("id", item.product_id);
        await supabase.from("stock_transactions").insert({
          product_id: item.product_id,
          quantity: -item.quantity,
          previous_stock: prod.stock_quantity,
          new_stock: newStock,
          transaction_type: "sold",
          reference_type: "invoice",
          reference_id: inv.id,
          created_by: profile?.id,
        });
      }
    }

    toast.success(`Invoice ${invoiceNumber} created!`);
    setFormOpen(false);
    refresh();
    setSaving(false);
  };

  const handlePayment = async (payData) => {
    setSaving(true);
    const amt = Number(payData.amount);
    const newPaid = Number(selected.paid_amount) + amt;
    const remaining = Number(selected.total_amount) - newPaid;
    const status = remaining <= 0 ? "paid" : "partial";

    await supabase.from("payments").insert({
      invoice_id: selected.id,
      amount: amt,
      payment_method: payData.payment_method,
      payment_note:
        payData.payment_method === "other"
          ? payData.payment_note
          : payData.payment_method,
      reference_number: payData.reference_number,
      created_by: profile?.id,
    });

    await supabase
      .from("invoices")
      .update({
        paid_amount: newPaid,
        status,
        updated_by: profile?.id,
      })
      .eq("id", selected.id);

    toast.success("Payment recorded!");
    setPaymentOpen(false);
    refresh();
    setSaving(false);
  };

  const printPDF = async (invoice) => {
    const { data } = await supabase
      .from("invoices")
      .select("*, customers(*), invoice_items(*, products(name))")
      .eq("id", invoice.id)
      .single();
    const doc = generateInvoicePDF(data, company);
    doc.save(`Invoice_${invoice.invoice_number}.pdf`);
  };

  const columns = [
    {
      key: "invoice_number",
      label: "Invoice #",
      render: (v) => (
        <span className="font-mono font-semibold text-brand-600">{v}</span>
      ),
    },
    {
      key: "invoice_date",
      label: "Date",
      render: (v) => new Date(v).toLocaleDateString("en-IN"),
    },
    { key: "customers", label: "Customer", render: (v) => v?.name || "-" },
    {
      key: "total_amount",
      label: "Amount",
      render: (v) => (
        <span className="font-semibold">
          ₹{Number(v).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "paid_amount",
      label: "Paid",
      render: (v) => `₹${Number(v).toLocaleString("en-IN")}`,
    },
    {
      key: "pending_amount",
      label: "Pending",
      render: (v) => (
        <span
          className={
            Number(v) > 0 ? "text-red-600 font-semibold" : "text-green-600"
          }
        >
          ₹{Number(v).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "id",
      label: "Actions",
      width: "150px",
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setSelected(row);
              setViewOpen(true);
            }}
            className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
          >
            <Eye className="w-4 h-4 text-surface-500" />
          </button>
          {row.status !== "paid" && hasPermission("edit_invoice") && (
            <button
              onClick={() => {
                setSelected(row);
                pReset({ amount: row.pending_amount, payment_method: "cash" });
                setPaymentOpen(true);
              }}
              className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
              title="Add payment"
            >
              <CreditCard className="w-4 h-4 text-green-500" />
            </button>
          )}
          <button
            onClick={() => printPDF(row)}
            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            title="Download PDF"
          >
            <FileText className="w-4 h-4 text-blue-500" />
          </button>
        </div>
      ),
    },
  ];

  const paymentMethod = pWatch("payment_method");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle={`${total} total invoices`}
        actions={
          <>
            <button
              onClick={() =>
                exportToExcel(data, EXPORT_COLUMNS.invoices, "invoices")
              }
              className="btn-secondary"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            {hasPermission("create_invoice") && (
              <button
                onClick={() => {
                  reset({
                    items: [
                      {
                        product_id: "",
                        quantity: 1,
                        unit_price: 0,
                        tax_rate: 18,
                        discount_percent: 0,
                      },
                    ],
                    discount_percent: 0,
                    invoice_date: new Date().toISOString().split("T")[0],
                  });
                  setFormOpen(true);
                }}
                className="btn-primary"
              >
                <Plus className="w-4 h-4" /> Create Invoice
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
            placeholder="Search invoice number..."
            className="flex-1 min-w-[200px]"
          />
          <Select
            options={[
              { value: "paid", label: "Paid" },
              { value: "partial", label: "Partial" },
              { value: "pending", label: "Pending" },
              { value: "cancelled", label: "Cancelled" },
            ]}
            placeholder="All Status"
            value={statusFilter}
            onChange={setStatusFilter}
            className="w-36"
          />
        </div>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={Receipt}
              title="No invoices"
              description="Create your first invoice"
              action={
                hasPermission("create_invoice") && (
                  <button
                    onClick={() => setFormOpen(true)}
                    className="btn-primary"
                  >
                    Create Invoice
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

      {/* Create Invoice Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Create Invoice"
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <FormField
              label="Customer"
              required
              error={errors.customer_id?.message}
            >
              <select
                className="input"
                {...register("customer_id", { required: "Required" })}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Invoice Date" required>
              <input
                type="date"
                className="input"
                {...register("invoice_date", { required: "Required" })}
              />
            </FormField>
            <FormField label="Due Date">
              <input type="date" className="input" {...register("due_date")} />
            </FormField>
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm text-surface-700 dark:text-surface-300">
                Items
              </h3>
              <button
                type="button"
                onClick={() =>
                  append({
                    product_id: "",
                    quantity: 1,
                    unit_price: 0,
                    tax_rate: 18,
                    discount_percent: 0,
                  })
                }
                className="btn-secondary text-xs py-1 px-2"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fields.map((field, i) => (
                <div
                  key={field.id}
                  className="grid grid-cols-12 gap-2 items-end bg-surface-50 dark:bg-surface-800/50 rounded-lg p-2"
                >
                  <div className="col-span-4">
                    <label className="label text-xs">Product</label>
                    <select
                      className="input text-xs"
                      {...register(`items.${i}.product_id`, { required: true })}
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
                      {...register(`items.${i}.quantity`, { min: 0.001 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label text-xs">Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      {...register(`items.${i}.unit_price`)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label text-xs">Tax %</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      {...register(`items.${i}.tax_rate`)}
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="label text-xs">Disc%</label>
                    <input
                      type="number"
                      step="0.01"
                      className="input text-xs"
                      {...register(`items.${i}.discount_percent`)}
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

          {/* Totals */}
          <div className="flex gap-4 items-end justify-end">
            <FormField label="Overall Discount %">
              <input
                type="number"
                step="0.01"
                className="input w-28"
                {...register("discount_percent")}
              />
            </FormField>
            <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 min-w-[220px] text-sm space-y-1">
              <div className="flex justify-between text-surface-500">
                <span>Subtotal:</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-surface-500">
                  <span>Discount:</span>
                  <span className="text-red-500">
                    -₹{totals.discount.toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-surface-500">
                <span>Tax:</span>
                <span>₹{totals.tax.toFixed(2)}</span>
              </div>
              <hr className="border-surface-200 dark:border-surface-600" />
              <div className="flex justify-between font-bold text-surface-900 dark:text-white text-base">
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
              {saving ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Record Payment"
        size="sm"
      >
        {selected && (
          <form onSubmit={pSubmit(handlePayment)} className="space-y-4">
            <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-3 text-sm">
              <p className="text-surface-500">
                Invoice: <strong>{selected.invoice_number}</strong>
              </p>
              <p className="text-surface-500 mt-1">
                Pending:{" "}
                <strong className="text-red-600">
                  ₹{Number(selected.pending_amount).toLocaleString("en-IN")}
                </strong>
              </p>
            </div>
            <FormField label="Amount (₹)" required>
              <input
                type="number"
                step="0.01"
                className="input"
                {...pReg("amount", {
                  required: "Required",
                  max: {
                    value: selected.pending_amount,
                    message: "Exceeds pending",
                  },
                })}
              />
            </FormField>
            <FormField label="Payment Method" required>
              <select
                className="input"
                {...pReg("payment_method", { required: "Required" })}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m} className="capitalize">
                    {m.replace("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>
            {paymentMethod === "other" && (
              <FormField label="Specify Payment Method">
                <input
                  className="input"
                  {...pReg("payment_note")}
                  placeholder="e.g. Cheque"
                />
              </FormField>
            )}
            <FormField label="Reference Number">
              <input
                className="input"
                {...pReg("reference_number")}
                placeholder="Transaction ID / Cheque No"
              />
            </FormField>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPaymentOpen(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* View Invoice Modal */}
      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={`Invoice ${selected?.invoice_number}`}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-surface-400">Customer:</span>
                <p className="font-medium">{selected.customers?.name}</p>
              </div>
              <div>
                <span className="text-surface-400">Date:</span>
                <p className="font-medium">
                  {new Date(selected.invoice_date).toLocaleDateString("en-IN")}
                </p>
              </div>
              <div>
                <span className="text-surface-400">Status:</span>
                <div className="mt-1">
                  <StatusBadge status={selected.status} />
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
                {(selected.invoice_items || []).map((item, i) => (
                  <tr key={i}>
                    <td>{item.product_name}</td>
                    <td>{item.quantity}</td>
                    <td>₹{Number(item.unit_price).toFixed(2)}</td>
                    <td>{item.tax_rate}%</td>
                    <td className="font-semibold">
                      ₹{Number(item.total).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <div className="text-sm space-y-1 min-w-[200px]">
                <div className="flex justify-between">
                  <span className="text-surface-400">Subtotal:</span>
                  <span>₹{Number(selected.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-400">Tax:</span>
                  <span>₹{Number(selected.tax_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>Total:</span>
                  <span>₹{Number(selected.total_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Paid:</span>
                  <span>₹{Number(selected.paid_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-red-500 font-semibold">
                  <span>Pending:</span>
                  <span>₹{Number(selected.pending_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
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
