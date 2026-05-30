// LOCATION: src/app/delivery-challans/page.js
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData, useLookup, useCompanySettings } from "@/lib/hooks";
import { generateChallanPDF } from "@/lib/pdf/generators";
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
import { Plus, Eye, FileText, Pencil, Trash2, Truck } from "lucide-react";

export default function DeliveryChallansPage() {
  const { profile, hasPermission } = useAuth();
  const { settings: company } = useCompanySettings();

  const [search, setSearch] = useState("");
  const [typeFilter, setType] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDelete] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cached lookups — fetched once, shared across all renders
  const { data: customers } = useLookup("customers", "id, name, mobile");
  const { data: vehicles } = useLookup(
    "vehicles",
    "id, vehicle_name, registration_number, vehicle_status",
  );

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
  } = useTableData("delivery_challans", {
    columns: "*, customers(name), vehicles(vehicle_name, registration_number)",
    search,
    searchColumns: ["challan_number"],
    filters: typeFilter ? { challan_type: typeFilter } : {},
    orderBy: "created_at",
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      challan_type: "rental",
      challan_date: new Date().toISOString().split("T")[0],
      status: "active",
    },
  });
  const challanType = watch("challan_type");

  const generateNumber = async () => {
    const prefix = company?.challan_prefix || "DC";
    const { count } = await supabase
      .from("delivery_challans")
      .select("id", { count: "exact", head: true });
    return `${prefix}${String((count || 0) + 1).padStart(6, "0")}`;
  };

  const openCreate = () => {
    reset({
      challan_type: "rental",
      challan_date: new Date().toISOString().split("T")[0],
      status: "active",
    });
    setSelected(null);
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setSelected(row);
    reset({
      customer_id: row.customer_id,
      vehicle_id: row.vehicle_id,
      challan_type: row.challan_type,
      challan_date: row.challan_date,
      start_date: row.start_date,
      end_date: row.end_date,
      rent_amount: row.rent_amount,
      security_deposit: row.security_deposit,
      payment_date: row.payment_date,
      contract_amount: row.contract_amount,
      payment_schedule: row.payment_schedule,
      contract_notes: row.contract_notes,
      status: row.status,
      notes: row.notes,
    });
    setFormOpen(true);
  };

  const onSubmit = async (fd) => {
    setSaving(true);
    let error;
    if (selected) {
      ({ error } = await supabase
        .from("delivery_challans")
        .update({ ...fd, updated_by: profile?.id })
        .eq("id", selected.id));
    } else {
      const challanNumber = await generateNumber();
      ({ error } = await supabase.from("delivery_challans").insert({
        ...fd,
        challan_number: challanNumber,
        created_by: profile?.id,
      }));
    }
    if (error) toast.error(error.message);
    else {
      toast.success(selected ? "Challan updated!" : "Challan created!");
      setFormOpen(false);
      refresh();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await supabase
      .from("delivery_challans")
      .update({ deleted_at: new Date().toISOString(), updated_by: profile?.id })
      .eq("id", selected.id);
    toast.success("Challan deleted");
    setDelete(false);
    refresh();
    setDeleting(false);
  };

  const printPDF = async (challan) => {
    const { data: full } = await supabase
      .from("delivery_challans")
      .select("*, customers(*), vehicles(*)")
      .eq("id", challan.id)
      .single();
    generateChallanPDF(full, company).save(
      `Challan_${challan.challan_number}.pdf`,
    );
  };

  const isExpiring = (endDate) => {
    if (!endDate) return false;
    const diff = (new Date(endDate) - new Date()) / 86400000;
    return diff >= 0 && diff <= 7;
  };

  const columns = [
    {
      key: "challan_number",
      label: "Challan #",
      render: (v) => (
        <span className="font-mono font-semibold text-brand-600">{v}</span>
      ),
    },
    {
      key: "challan_date",
      label: "Date",
      render: (v) => new Date(v).toLocaleDateString("en-IN"),
    },
    { key: "customers", label: "Customer", render: (v) => v?.name || "—" },
    {
      key: "vehicles",
      label: "Vehicle",
      render: (v) =>
        v ? (
          <div>
            <p className="font-medium">{v.vehicle_name}</p>
            <p className="text-xs text-surface-400">{v.registration_number}</p>
          </div>
        ) : (
          "—"
        ),
    },
    {
      key: "challan_type",
      label: "Type",
      render: (v) => (
        <span
          className={`badge ${v === "rental" ? "badge-blue" : "badge-orange"}`}
        >
          {v}
        </span>
      ),
    },
    {
      key: "end_date",
      label: "End Date",
      render: (v) => (
        <span className={isExpiring(v) ? "text-red-500 font-medium" : ""}>
          {v ? new Date(v).toLocaleDateString("en-IN") : "—"}
          {isExpiring(v) && " ⚠️"}
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
      width: "130px",
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
          {hasPermission("edit_challan") && (
            <button
              onClick={() => openEdit(row)}
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              <Pencil className="w-4 h-4 text-blue-500" />
            </button>
          )}
          <button
            onClick={() => {
              setSelected(row);
              setDelete(true);
            }}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Delivery Challans"
        subtitle={`${total} challans`}
        actions={
          hasPermission("create_challan") && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> New Challan
            </button>
          )
        }
      />

      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700 flex flex-wrap gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search challan number…"
            className="flex-1 min-w-[200px]"
          />
          <Select
            options={[
              { value: "rental", label: "Rental" },
              { value: "contract", label: "Contract" },
            ]}
            placeholder="All Types"
            value={typeFilter}
            onChange={setType}
            className="w-36"
          />
        </div>

        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={Truck}
              title="No challans found"
              action={
                hasPermission("create_challan") && (
                  <button onClick={openCreate} className="btn-primary">
                    New Challan
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
        title={selected ? "Edit Challan" : "New Delivery Challan"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Customer — native select with loaded data */}
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
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.mobile ? ` — ${c.mobile}` : ""}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Vehicle — native select with loaded data */}
            <FormField
              label="Vehicle"
              required
              error={errors.vehicle_id?.message}
            >
              <select
                className="input"
                {...register("vehicle_id", { required: "Required" })}
              >
                <option value="">Select vehicle</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicle_name}
                    {v.registration_number ? ` (${v.registration_number})` : ""}
                    {v.vehicle_status !== "available"
                      ? ` — ${v.vehicle_status}`
                      : ""}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Challan Type" required>
              <select
                className="input"
                {...register("challan_type", { required: true })}
              >
                <option value="rental">Rental</option>
                <option value="contract">Contract</option>
              </select>
            </FormField>

            <FormField label="Challan Date" required>
              <input
                type="date"
                className="input"
                {...register("challan_date", { required: true })}
              />
            </FormField>
          </div>

          {/* Rental fields */}
          {challanType === "rental" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
              <p className="col-span-2 text-sm font-semibold text-blue-700 dark:text-blue-400">
                Rental Details
              </p>
              <FormField label="Start Date">
                <input
                  type="date"
                  className="input"
                  {...register("start_date")}
                />
              </FormField>
              <FormField label="End Date">
                <input
                  type="date"
                  className="input"
                  {...register("end_date")}
                />
              </FormField>
              <FormField label="Rent Amount (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  {...register("rent_amount")}
                />
              </FormField>
              <FormField label="Security Deposit (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  {...register("security_deposit")}
                />
              </FormField>
              <FormField label="Payment Date">
                <input
                  type="date"
                  className="input"
                  {...register("payment_date")}
                />
              </FormField>
            </div>
          )}

          {/* Contract fields */}
          {challanType === "contract" && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800">
              <p className="col-span-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                Contract Details
              </p>
              <FormField label="Contract Amount (₹)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  {...register("contract_amount")}
                />
              </FormField>
              <FormField label="Payment Schedule">
                <select className="input" {...register("payment_schedule")}>
                  <option value="">Select</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="one_time">One Time</option>
                </select>
              </FormField>
              <FormField label="Start Date">
                <input
                  type="date"
                  className="input"
                  {...register("start_date")}
                />
              </FormField>
              <FormField label="End Date">
                <input
                  type="date"
                  className="input"
                  {...register("end_date")}
                />
              </FormField>
              <div className="col-span-2">
                <FormField label="Contract Notes">
                  <textarea
                    rows={2}
                    className="input resize-none"
                    {...register("contract_notes")}
                  />
                </FormField>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Status">
              <select className="input" {...register("status")}>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </FormField>
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
              {saving
                ? "Saving…"
                : selected
                  ? "Update Challan"
                  : "Create Challan"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── View Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={`Challan ${selected?.challan_number}`}
        size="md"
      >
        {selected && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-surface-400">Customer:</span>
                <p className="font-medium">{selected.customers?.name}</p>
              </div>
              <div>
                <span className="text-surface-400">Vehicle:</span>
                <p className="font-medium">{selected.vehicles?.vehicle_name}</p>
              </div>
              <div>
                <span className="text-surface-400">Reg. No:</span>
                <p className="font-medium">
                  {selected.vehicles?.registration_number || "—"}
                </p>
              </div>
              <div>
                <span className="text-surface-400">Type:</span>
                <p className="font-medium capitalize">
                  {selected.challan_type}
                </p>
              </div>
              <div>
                <span className="text-surface-400">Status:</span>
                <div className="mt-1">
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              {selected.start_date && (
                <div>
                  <span className="text-surface-400">Start:</span>
                  <p className="font-medium">
                    {new Date(selected.start_date).toLocaleDateString("en-IN")}
                  </p>
                </div>
              )}
              {selected.end_date && (
                <div>
                  <span className="text-surface-400">End:</span>
                  <p
                    className={`font-medium ${isExpiring(selected.end_date) ? "text-red-500" : ""}`}
                  >
                    {new Date(selected.end_date).toLocaleDateString("en-IN")}
                    {isExpiring(selected.end_date) && " ⚠️"}
                  </p>
                </div>
              )}
              {selected.rent_amount && (
                <div>
                  <span className="text-surface-400">Rent:</span>
                  <p className="font-medium">
                    ₹{Number(selected.rent_amount).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
              {selected.security_deposit && (
                <div>
                  <span className="text-surface-400">Security:</span>
                  <p className="font-medium">
                    ₹{Number(selected.security_deposit).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
              {selected.contract_amount && (
                <div>
                  <span className="text-surface-400">Contract:</span>
                  <p className="font-medium">
                    ₹{Number(selected.contract_amount).toLocaleString("en-IN")}
                  </p>
                </div>
              )}
              {selected.payment_schedule && (
                <div>
                  <span className="text-surface-400">Schedule:</span>
                  <p className="font-medium capitalize">
                    {selected.payment_schedule}
                  </p>
                </div>
              )}
            </div>
            {selected.notes && (
              <p className="border-t pt-3 text-surface-500 italic">
                {selected.notes}
              </p>
            )}
            <div className="flex justify-end">
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

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDelete(false)}
        onConfirm={handleDelete}
        title="Delete Challan"
        message={`Delete challan "${selected?.challan_number}"?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
