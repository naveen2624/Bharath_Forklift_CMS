"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData, useLookup, useCompanySettings } from "@/lib/hooks";
import { generateQuotationPDF } from "@/lib/pdf/generators";
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
  FileText,
  Eye,
  Pencil,
  Trash2,
  Copy,
  ArrowRight,
} from "lucide-react";

export default function QuotationsPage() {
  const { profile, hasPermission } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Cached lookups
  const { data: customerRows } = useLookup("customers", "id, name, mobile");
  const { data: productRows } = useLookup(
    "products",
    "id, name, selling_price, tax_rate",
  );
  const { settings: company } = useCompanySettings();
  const customers = customerRows.map((c) => ({
    value: c.id,
    label: `${c.name} — ${c.mobile}`,
  }));
  const products = productRows;
  const [totals, setTotals] = useState({
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  });

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
  } = useTableData("quotations", {
    columns: "*, customers(name, mobile)",
    search,
    searchColumns: ["quotation_number"],
    filters: statusFilter ? { status: statusFilter } : {},
    orderBy: "created_at",
  });

  const { register, handleSubmit, reset, watch, control, setValue } = useForm({
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

  const watchItems = watch("items");
  const watchDiscount = watch("discount_percent");

  useEffect(() => {
    let subtotal = 0,
      taxAmt = 0;
    const discPct = Number(watchDiscount || 0);
    (watchItems || []).forEach((item) => {
      const lineTotal =
        Number(item.quantity || 0) * Number(item.unit_price || 0);
      const lineDisc = lineTotal * (Number(item.discount_percent || 0) / 100);
      const lineNet = (lineTotal - lineDisc) * (1 - discPct / 100);
      subtotal += lineTotal;
      taxAmt += lineNet * (Number(item.tax_rate || 0) / 100);
    });
    const discAmt = subtotal * (discPct / 100);
    setTotals({
      subtotal,
      discount: discAmt,
      tax: taxAmt,
      total: subtotal - discAmt + taxAmt,
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
    const prefix = company?.quotation_prefix || "QT";
    const { count } = await supabase
      .from("quotations")
      .select("id", { count: "exact" });
    return `${prefix}${String((count || 0) + 1).padStart(6, "0")}`;
  };

  const onSubmit = async (formData) => {
    setSaving(true);
    const quotationNumber = await generateNumber();
    const itemsPayload = (formData.items || []).map((item) => {
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      const taxRate = Number(item.tax_rate || 0);
      const discPct = Number(item.discount_percent || 0);
      const discGlobal = Number(formData.discount_percent || 0);
      const lineTotal = qty * price;
      const discAmt =
        lineTotal * (discPct / 100) + lineTotal * (discGlobal / 100);
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

    const { data: qt, error } = await supabase
      .from("quotations")
      .insert({
        quotation_number: quotationNumber,
        customer_id: formData.customer_id,
        quotation_date:
          formData.quotation_date || new Date().toISOString().split("T")[0],
        valid_until: formData.valid_until,
        subtotal: totals.subtotal,
        discount_percent: Number(formData.discount_percent || 0),
        discount_amount: totals.discount,
        tax_amount: totals.tax,
        total_amount: totals.total,
        status: "draft",
        notes: formData.notes,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (!qt || error) {
      toast.error(error?.message || "Failed");
      setSaving(false);
      return;
    }
    await supabase
      .from("quotation_items")
      .insert(itemsPayload.map((it) => ({ ...it, quotation_id: qt.id })));
    toast.success(`Quotation ${quotationNumber} created!`);
    setFormOpen(false);
    refresh();
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await supabase
      .from("quotations")
      .update({ deleted_at: new Date().toISOString(), updated_by: profile?.id })
      .eq("id", selected.id);
    toast.success("Quotation deleted");
    setDeleteOpen(false);
    refresh();
    setDeleting(false);
  };

  const handleDuplicate = async (row) => {
    const { data: qt } = await supabase
      .from("quotations")
      .select("*, quotation_items(*)")
      .eq("id", row.id)
      .single();
    if (!qt) return;
    const newNumber = await generateNumber();
    const { data: newQt } = await supabase
      .from("quotations")
      .insert({
        ...qt,
        id: undefined,
        quotation_number: newNumber,
        quotation_date: new Date().toISOString().split("T")[0],
        status: "draft",
        created_by: profile?.id,
        created_at: undefined,
        updated_at: undefined,
      })
      .select()
      .single();
    if (newQt) {
      await supabase
        .from("quotation_items")
        .insert(
          (qt.quotation_items || []).map((it) => ({
            ...it,
            id: undefined,
            quotation_id: newQt.id,
          })),
        );
      toast.success("Quotation duplicated!");
      refresh();
    }
  };

  const handleConvertToInvoice = async () => {
    setSaving(true);
    const { data: qt } = await supabase
      .from("quotations")
      .select("*, quotation_items(*), customers(*)")
      .eq("id", selected.id)
      .single();
    const prefix = company?.invoice_prefix || "INV";
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact" });
    const invoiceNumber = `${prefix}${String((count || 0) + 1).padStart(6, "0")}`;

    const { data: inv } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        customer_id: qt.customer_id,
        quotation_id: qt.id,
        invoice_date: new Date().toISOString().split("T")[0],
        subtotal: qt.subtotal,
        discount_percent: qt.discount_percent,
        discount_amount: qt.discount_amount,
        tax_amount: qt.tax_amount,
        total_amount: qt.total_amount,
        paid_amount: 0,
        status: "pending",
        created_by: profile?.id,
      })
      .select()
      .single();

    if (inv) {
      await supabase
        .from("invoice_items")
        .insert(
          (qt.quotation_items || []).map((it) => ({
            ...it,
            id: undefined,
            invoice_id: inv.id,
            quotation_id: undefined,
          })),
        );
      await supabase
        .from("quotations")
        .update({ status: "converted", converted_to_invoice: inv.id })
        .eq("id", qt.id);
      toast.success(`Converted to Invoice ${invoiceNumber}`);
      setConvertOpen(false);
      refresh();
    }
    setSaving(false);
  };

  const printPDF = async (q) => {
    const { data } = await supabase
      .from("quotations")
      .select("*, customers(*), quotation_items(*,products(name))")
      .eq("id", q.id)
      .single();
    const doc = generateQuotationPDF(data, company);
    doc.save(`Quotation_${q.quotation_number}.pdf`);
  };

  const columns = [
    {
      key: "quotation_number",
      label: "Quotation #",
      render: (v) => (
        <span className="font-mono font-semibold text-brand-600">{v}</span>
      ),
    },
    {
      key: "quotation_date",
      label: "Date",
      render: (v) => new Date(v).toLocaleDateString("en-IN"),
    },
    {
      key: "valid_until",
      label: "Valid Until",
      render: (v) => (v ? new Date(v).toLocaleDateString("en-IN") : "-"),
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
      key: "status",
      label: "Status",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "id",
      label: "Actions",
      width: "160px",
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
          <button
            onClick={() => printPDF(row)}
            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            title="PDF"
          >
            <FileText className="w-4 h-4 text-blue-500" />
          </button>
          <button
            onClick={() => handleDuplicate(row)}
            className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
            title="Duplicate"
          >
            <Copy className="w-4 h-4 text-surface-400" />
          </button>
          {row.status !== "converted" && hasPermission("create_invoice") && (
            <button
              onClick={() => {
                setSelected(row);
                setConvertOpen(true);
              }}
              className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
              title="Convert to Invoice"
            >
              <ArrowRight className="w-4 h-4 text-green-500" />
            </button>
          )}
          {hasPermission("delete_quotation") && (
            <button
              onClick={() => {
                setSelected(row);
                setDeleteOpen(true);
              }}
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
        title="Quotations"
        subtitle={`${total} total quotations`}
        actions={
          hasPermission("create_quotation") && (
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
                  quotation_date: new Date().toISOString().split("T")[0],
                });
                setFormOpen(true);
              }}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> New Quotation
            </button>
          )
        }
      />

      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700 flex flex-wrap gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search quotation number..."
            className="flex-1 min-w-[200px]"
          />
          <Select
            options={[
              { value: "draft", label: "Draft" },
              { value: "sent", label: "Sent" },
              { value: "converted", label: "Converted" },
              { value: "expired", label: "Expired" },
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
              icon={FileText}
              title="No quotations yet"
              action={
                hasPermission("create_quotation") && (
                  <button
                    onClick={() => setFormOpen(true)}
                    className="btn-primary"
                  >
                    New Quotation
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

      {/* Create Quotation Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="New Quotation"
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Customer" required>
              <select
                className="input"
                {...register("customer_id", { required: true })}
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Date" required>
              <input
                type="date"
                className="input"
                {...register("quotation_date", { required: true })}
              />
            </FormField>
            <FormField label="Valid Until">
              <input
                type="date"
                className="input"
                {...register("valid_until")}
              />
            </FormField>
          </div>

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

          <div className="flex justify-end gap-4">
            <FormField label="Overall Discount %">
              <input
                type="number"
                step="0.01"
                className="input w-28"
                {...register("discount_percent")}
              />
            </FormField>
            <div className="bg-surface-50 dark:bg-surface-800 rounded-xl p-4 text-sm space-y-1 min-w-[200px]">
              <div className="flex justify-between text-surface-500">
                <span>Subtotal:</span>
                <span>₹{totals.subtotal.toFixed(2)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Discount:</span>
                  <span>-₹{totals.discount.toFixed(2)}</span>
                </div>
              )}
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
              {saving ? "Creating..." : "Create Quotation"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConfirm={handleConvertToInvoice}
        title="Convert to Invoice"
        message={`Convert quotation "${selected?.quotation_number}" to an invoice? Stock will be reduced.`}
        confirmLabel="Convert"
        loading={saving}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Quotation"
        message={`Delete "${selected?.quotation_number}"?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
