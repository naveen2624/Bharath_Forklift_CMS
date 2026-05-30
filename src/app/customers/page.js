// LOCATION: src/app/customers/page.js
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData } from "@/lib/hooks";
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
  Trash2,
  Eye,
  Users,
  Car,
  ShoppingCart,
  History,
  X,
} from "lucide-react";

const CUSTOMER_TYPES = [
  { value: "retail", label: "Retail" },
  { value: "dealer", label: "Dealer" },
  { value: "corporate", label: "Corporate" },
];

// Which "business" types this customer has
const BUSINESS_TYPES = [
  {
    value: "purchase",
    label: "Purchase Customer",
    icon: ShoppingCart,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    value: "vehicle",
    label: "Vehicle / Rental Customer",
    icon: Car,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
];

export default function CustomersPage() {
  const { profile, hasPermission } = useAuth();

  const [search, setSearch] = useState("");
  const [typeFilter, setType] = useState("");
  const [bizFilter, setBiz] = useState(""); // 'purchase' | 'vehicle' | ''
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDel] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [histTab, setHistTab] = useState("purchase"); // 'purchase' | 'vehicle'
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [histData, setHistData] = useState({ invoices: [], challans: [] });
  const [histLoading, setHistLoading] = useState(false);

  const filters = {};
  if (typeFilter) filters.customer_type = typeFilter;
  if (bizFilter === "purchase") filters.is_purchase_customer = true;
  if (bizFilter === "vehicle") filters.is_vehicle_customer = true;

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
  } = useTableData("customers", {
    search,
    searchColumns: ["name", "mobile", "email", "customer_code"],
    filters,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm();
  const watchPurchase = watch("is_purchase_customer");
  const watchVehicle = watch("is_vehicle_customer");

  const openCreate = () => {
    reset({ is_purchase_customer: true, is_vehicle_customer: false });
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (row) => {
    setSelected(row);
    reset(row);
    setFormOpen(true);
  };

  const openHistory = async (row) => {
    setSelected(row);
    setHistLoading(true);
    setHistData({ invoices: [], challans: [] });
    setHistOpen(true);

    const [invRes, challanRes] = await Promise.all([
      supabase
        .from("invoices")
        .select(
          "invoice_number, invoice_date, total_amount, paid_amount, pending_amount, status",
        )
        .eq("customer_id", row.id)
        .is("deleted_at", null)
        .order("invoice_date", { ascending: false })
        .limit(50),
      supabase
        .from("delivery_challans")
        .select(
          "challan_number, challan_date, challan_type, start_date, end_date, rent_amount, contract_amount, status, vehicles(vehicle_name, registration_number)",
        )
        .eq("customer_id", row.id)
        .is("deleted_at", null)
        .order("challan_date", { ascending: false })
        .limit(50),
    ]);

    setHistData({
      invoices: invRes.data || [],
      challans: challanRes.data || [],
    });
    // Set default tab based on customer type
    if (row.is_vehicle_customer && !row.is_purchase_customer)
      setHistTab("vehicle");
    else setHistTab("purchase");
    setHistLoading(false);
  };

  const onSubmit = async (fd) => {
    setSaving(true);
    // Ensure at least one business type selected
    if (!fd.is_purchase_customer && !fd.is_vehicle_customer) {
      toast.error("Select at least one customer type (Purchase or Vehicle)");
      setSaving(false);
      return;
    }
    const payload = {
      name: fd.name,
      mobile: fd.mobile || null,
      phone: fd.phone || null,
      email: fd.email || null,
      address: fd.address || null,
      city: fd.city || null,
      state: fd.state || null,
      pincode: fd.pincode || null,
      gst_number: fd.gst_number || null,
      customer_type: fd.customer_type || "retail",
      credit_limit: Number(fd.credit_limit) || 0,
      notes: fd.notes || null,
      is_purchase_customer: !!fd.is_purchase_customer,
      is_vehicle_customer: !!fd.is_vehicle_customer,
      updated_by: profile?.id,
    };

    let error;
    if (selected) {
      ({ error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", selected.id));
    } else {
      const code = `CUS${String(total + 1).padStart(5, "0")}`;
      ({ error } = await supabase
        .from("customers")
        .insert({ ...payload, customer_code: code, created_by: profile?.id }));
    }

    if (error) toast.error(error.message);
    else {
      toast.success(selected ? "Customer updated!" : "Customer created!");
      setFormOpen(false);
      refresh();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("customers")
      .update({ deleted_at: new Date().toISOString(), updated_by: profile?.id })
      .eq("id", selected.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Customer deleted");
      setDel(false);
      refresh();
    }
    setDeleting(false);
  };

  const bizBadge = (row) => (
    <div className="flex gap-1 flex-wrap">
      {row.is_purchase_customer && (
        <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1">
          <ShoppingCart className="w-3 h-3" /> Purchase
        </span>
      )}
      {row.is_vehicle_customer && (
        <span className="badge bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1">
          <Car className="w-3 h-3" /> Vehicle
        </span>
      )}
    </div>
  );

  const columns = [
    { key: "customer_code", label: "ID", width: "90px" },
    {
      key: "name",
      label: "Name",
      render: (v, row) => (
        <div>
          <p className="font-medium text-surface-900 dark:text-white">{v}</p>
          <p className="text-xs text-surface-400">{row.mobile}</p>
        </div>
      ),
    },
    { key: "email", label: "Email", render: (v) => v || "—" },
    {
      key: "customer_type",
      label: "Category",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: "is_purchase_customer",
      label: "Business Type",
      render: (_, row) => bizBadge(row),
    },
    {
      key: "credit_limit",
      label: "Credit Limit",
      render: (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`,
    },
    {
      key: "current_credit",
      label: "Outstanding",
      render: (v) => (
        <span
          className={
            Number(v) > 0 ? "text-red-600 font-semibold" : "text-green-600"
          }
        >
          ₹{Number(v || 0).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      width: "130px",
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openHistory(row)}
            title="View History"
            className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg"
          >
            <History className="w-4 h-4 text-purple-500" />
          </button>
          <button
            onClick={() => {
              setSelected(row);
              setViewOpen(true);
            }}
            title="View"
            className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"
          >
            <Eye className="w-4 h-4 text-surface-500" />
          </button>
          {hasPermission("edit_customer") && (
            <button
              onClick={() => openEdit(row)}
              title="Edit"
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              <Pencil className="w-4 h-4 text-blue-500" />
            </button>
          )}
          {hasPermission("delete_customer") && (
            <button
              onClick={() => {
                setSelected(row);
                setDel(true);
              }}
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
        title="Customers"
        subtitle={`${total} total customers`}
        actions={
          <>
            <button
              onClick={() =>
                exportToExcel(data, EXPORT_COLUMNS.customers, "customers")
              }
              className="btn-secondary"
            >
              <Download className="w-4 h-4" /> Excel
            </button>
            {hasPermission("create_customer") && (
              <button onClick={openCreate} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Customer
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
            placeholder="Search name, mobile, email…"
            className="flex-1 min-w-[200px]"
          />
          <Select
            options={CUSTOMER_TYPES}
            placeholder="All Categories"
            value={typeFilter}
            onChange={setType}
            className="w-40"
          />
          <Select
            options={[
              { value: "purchase", label: "Purchase Customers" },
              { value: "vehicle", label: "Vehicle Customers" },
            ]}
            placeholder="All Types"
            value={bizFilter}
            onChange={setBiz}
            className="w-48"
          />
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={Users}
              title="No customers found"
              description="Add your first customer to get started"
              action={
                hasPermission("create_customer") && (
                  <button onClick={openCreate} className="btn-primary">
                    Add Customer
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

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={selected ? "Edit Customer" : "Add Customer"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Business type selector */}
          <div>
            <label className="label">
              Customer Business Type <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              {BUSINESS_TYPES.map((bt) => {
                const Icon = bt.icon;
                const fieldName =
                  bt.value === "purchase"
                    ? "is_purchase_customer"
                    : "is_vehicle_customer";
                const checked =
                  bt.value === "purchase" ? watchPurchase : watchVehicle;
                return (
                  <label
                    key={bt.value}
                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all flex-1
                      ${
                        checked
                          ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20"
                          : "border-surface-200 dark:border-surface-700 hover:border-surface-300"
                      }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      {...register(fieldName)}
                    />
                    <Icon
                      className={`w-5 h-5 ${checked ? "text-brand-600" : "text-surface-400"}`}
                    />
                    <div>
                      <p
                        className={`text-sm font-semibold ${checked ? "text-brand-700 dark:text-brand-400" : "text-surface-700 dark:text-surface-300"}`}
                      >
                        {bt.label}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-surface-400 mt-1">
              A customer can be both types.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Customer Name"
              required
              error={errors.name?.message}
            >
              <input
                className="input"
                autoFocus
                {...register("name", { required: "Name is required" })}
              />
            </FormField>
            <FormField label="Mobile">
              <input className="input" {...register("mobile")} />
            </FormField>
            <FormField label="Email">
              <input type="email" className="input" {...register("email")} />
            </FormField>
            <FormField label="Phone">
              <input className="input" {...register("phone")} />
            </FormField>
            <FormField label="Customer Category">
              <select className="input" {...register("customer_type")}>
                <option value="">Select category</option>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="GST Number">
              <input className="input" {...register("gst_number")} />
            </FormField>
            <FormField label="Credit Limit (₹)">
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                {...register("credit_limit")}
              />
            </FormField>
            <div className="col-span-2">
              <FormField label="Address">
                <textarea
                  rows={2}
                  className="input resize-none"
                  {...register("address")}
                />
              </FormField>
            </div>
            <FormField label="City">
              <input className="input" {...register("city")} />
            </FormField>
            <FormField label="State">
              <input className="input" {...register("state")} />
            </FormField>
            <FormField label="Pincode">
              <input className="input" {...register("pincode")} />
            </FormField>
            <div className="col-span-2">
              <FormField label="Notes">
                <textarea
                  rows={2}
                  className="input resize-none"
                  {...register("notes")}
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
                  ? "Update Customer"
                  : "Create Customer"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Customer Details"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-surface-100 dark:border-surface-700">
              <div className="w-14 h-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <span className="text-brand-700 font-bold text-2xl">
                  {selected.name?.charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">
                  {selected.name}
                </h3>
                <p className="text-surface-400 text-sm">
                  {selected.customer_code}
                </p>
                <div className="flex gap-1 mt-1">
                  <StatusBadge status={selected.customer_type} />
                  {bizBadge(selected)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Mobile", selected.mobile],
                ["Email", selected.email],
                ["GST", selected.gst_number],
                ["City", selected.city],
                [
                  "Credit Limit",
                  `₹${Number(selected.credit_limit || 0).toLocaleString("en-IN")}`,
                ],
                [
                  "Outstanding",
                  `₹${Number(selected.current_credit || 0).toLocaleString("en-IN")}`,
                ],
              ]
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <span className="text-surface-400">{k}: </span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              {selected.address && (
                <div className="col-span-2">
                  <span className="text-surface-400">Address: </span>
                  <span>
                    {selected.address}
                    {selected.city ? `, ${selected.city}` : ""}
                    {selected.state ? `, ${selected.state}` : ""}{" "}
                    {selected.pincode}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setViewOpen(false);
                  openHistory(selected);
                }}
                className="btn-secondary"
              >
                <History className="w-4 h-4" /> View History
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── History Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={histOpen}
        onClose={() => setHistOpen(false)}
        title={`History — ${selected?.name}`}
        size="xl"
      >
        {/* Tab switcher — only show tabs relevant to this customer */}
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1 mb-4">
          {selected?.is_purchase_customer && (
            <button
              onClick={() => setHistTab("purchase")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                ${histTab === "purchase" ? "bg-white dark:bg-surface-700 text-brand-600 shadow-sm" : "text-surface-500"}`}
            >
              <ShoppingCart className="w-4 h-4" /> Purchase / Invoice History
            </button>
          )}
          {selected?.is_vehicle_customer && (
            <button
              onClick={() => setHistTab("vehicle")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all
                ${histTab === "vehicle" ? "bg-white dark:bg-surface-700 text-brand-600 shadow-sm" : "text-surface-500"}`}
            >
              <Car className="w-4 h-4" /> Vehicle / Rental History
            </button>
          )}
        </div>

        {histLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Purchase / Invoice history */}
            {histTab === "purchase" && (
              <div>
                {histData.invoices.length === 0 ? (
                  <p className="text-center text-surface-400 py-8">
                    No invoice history found
                  </p>
                ) : (
                  <div className="table-container">
                    <table className="table text-sm">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Paid</th>
                          <th>Pending</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {histData.invoices.map((inv) => (
                          <tr key={inv.invoice_number}>
                            <td className="font-mono font-semibold text-brand-600">
                              {inv.invoice_number}
                            </td>
                            <td>
                              {new Date(inv.invoice_date).toLocaleDateString(
                                "en-IN",
                              )}
                            </td>
                            <td className="font-semibold">
                              ₹
                              {Number(inv.total_amount).toLocaleString("en-IN")}
                            </td>
                            <td className="text-green-600">
                              ₹{Number(inv.paid_amount).toLocaleString("en-IN")}
                            </td>
                            <td
                              className={
                                Number(inv.pending_amount) > 0
                                  ? "text-red-600 font-semibold"
                                  : "text-green-600"
                              }
                            >
                              ₹
                              {Number(inv.pending_amount).toLocaleString(
                                "en-IN",
                              )}
                            </td>
                            <td>
                              <StatusBadge status={inv.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-surface-50 dark:bg-surface-800 font-bold">
                          <td
                            colSpan={2}
                            className="px-4 py-2 text-surface-600"
                          >
                            Total ({histData.invoices.length} invoices)
                          </td>
                          <td className="px-4 py-2">
                            ₹
                            {histData.invoices
                              .reduce((s, i) => s + Number(i.total_amount), 0)
                              .toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-2 text-green-600">
                            ₹
                            {histData.invoices
                              .reduce((s, i) => s + Number(i.paid_amount), 0)
                              .toLocaleString("en-IN")}
                          </td>
                          <td className="px-4 py-2 text-red-600">
                            ₹
                            {histData.invoices
                              .reduce((s, i) => s + Number(i.pending_amount), 0)
                              .toLocaleString("en-IN")}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Vehicle / Rental history */}
            {histTab === "vehicle" && (
              <div>
                {histData.challans.length === 0 ? (
                  <p className="text-center text-surface-400 py-8">
                    No vehicle/rental history found
                  </p>
                ) : (
                  <>
                    {/* Current active rentals highlighted */}
                    {histData.challans.filter((c) => c.status === "active")
                      .length > 0 && (
                      <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                        <p className="text-green-700 dark:text-green-400 font-semibold text-sm mb-2 flex items-center gap-1">
                          <Car className="w-4 h-4" /> Currently Active
                        </p>
                        {histData.challans
                          .filter((c) => c.status === "active")
                          .map((c) => (
                            <div key={c.challan_number} className="text-sm">
                              <span className="font-semibold">
                                {c.vehicles?.vehicle_name}
                              </span>
                              <span className="text-surface-500 ml-2">
                                ({c.vehicles?.registration_number})
                              </span>
                              <span className="ml-2 text-green-600">
                                {c.challan_type === "rental"
                                  ? `₹${Number(c.rent_amount || 0).toLocaleString("en-IN")}/period`
                                  : `Contract ₹${Number(c.contract_amount || 0).toLocaleString("en-IN")}`}
                              </span>
                              {c.end_date && (
                                <span className="ml-2 text-surface-400">
                                  until{" "}
                                  {new Date(c.end_date).toLocaleDateString(
                                    "en-IN",
                                  )}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    )}

                    <div className="table-container">
                      <table className="table text-sm">
                        <thead>
                          <tr>
                            <th>Challan #</th>
                            <th>Vehicle</th>
                            <th>Type</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Amount</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {histData.challans.map((c) => (
                            <tr key={c.challan_number}>
                              <td className="font-mono font-semibold text-brand-600">
                                {c.challan_number}
                              </td>
                              <td>
                                <div className="font-medium">
                                  {c.vehicles?.vehicle_name || "—"}
                                </div>
                                <div className="text-xs text-surface-400">
                                  {c.vehicles?.registration_number}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`badge ${c.challan_type === "rental" ? "badge-blue" : "badge-orange"}`}
                                >
                                  {c.challan_type}
                                </span>
                              </td>
                              <td>
                                {c.start_date
                                  ? new Date(c.start_date).toLocaleDateString(
                                      "en-IN",
                                    )
                                  : "—"}
                              </td>
                              <td>
                                {c.end_date
                                  ? new Date(c.end_date).toLocaleDateString(
                                      "en-IN",
                                    )
                                  : "—"}
                              </td>
                              <td className="font-semibold">
                                ₹
                                {Number(
                                  c.challan_type === "rental"
                                    ? c.rent_amount
                                    : c.contract_amount || 0,
                                ).toLocaleString("en-IN")}
                              </td>
                              <td>
                                <StatusBadge status={c.status} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDel(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message={`Delete "${selected?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
