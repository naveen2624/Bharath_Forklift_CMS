"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData } from "@/lib/hooks";
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
import { Plus, Pencil, Trash2, Eye, Car, AlertTriangle } from "lucide-react";

const VEHICLE_STATUSES = [
  { value: "available", label: "Available" },
  { value: "rented", label: "Rented" },
  { value: "maintenance", label: "Under Maintenance" },
  { value: "sold", label: "Sold" },
];
const FUEL_TYPES = ["diesel", "electric", "lpg", "petrol", "hybrid"];
const FORKLIFT_TYPES = [
  "counterbalance",
  "reach_truck",
  "order_picker",
  "pallet_jack",
  "telehandler",
  "rough_terrain",
  "other",
];

export default function VehiclesPage() {
  const { profile, hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDelete] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
  } = useTableData("vehicles", {
    search,
    searchColumns: ["vehicle_name", "registration_number", "vehicle_code"],
    filters: statusFilter ? { vehicle_status: statusFilter } : {},
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const openCreate = () => {
    reset({});
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (row) => {
    setSelected(row);
    reset(row);
    setFormOpen(true);
  };

  const isInsuranceExpiring = (date) => {
    if (!date) return false;
    const diff = (new Date(date) - new Date()) / 86400000;
    return diff >= 0 && diff <= 30;
  };

  const onSubmit = async (fd) => {
    setSaving(true);
    let error;
    if (selected) {
      ({ error } = await supabase
        .from("vehicles")
        .update({ ...fd, updated_by: profile?.id })
        .eq("id", selected.id));
    } else {
      const code = `VH${String(Date.now()).slice(-5)}`;
      ({ error } = await supabase
        .from("vehicles")
        .insert({ ...fd, vehicle_code: code, created_by: profile?.id }));
    }
    if (error) toast.error(error.message);
    else {
      toast.success(selected ? "Vehicle updated!" : "Vehicle added!");
      setFormOpen(false);
      refresh();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase
      .from("vehicles")
      .update({ deleted_at: new Date().toISOString(), updated_by: profile?.id })
      .eq("id", selected.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Vehicle deleted");
      setDelete(false);
      refresh();
    }
    setDeleting(false);
  };

  const sColor = (s) =>
    ({
      available: "badge-green",
      rented: "badge-blue",
      maintenance: "badge-yellow",
      sold: "badge-gray",
    })[s] || "badge-gray";

  const columns = [
    { key: "vehicle_code", label: "Code", width: "90px" },
    {
      key: "vehicle_name",
      label: "Vehicle",
      render: (v, row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0">
            <Car className="w-4 h-4 text-brand-600" />
          </div>
          <div>
            <p className="font-medium text-surface-900 dark:text-white">{v}</p>
            <p className="text-xs text-surface-400">
              {row.forklift_type?.replace("_", " ")}
            </p>
          </div>
        </div>
      ),
    },
    { key: "registration_number", label: "Reg. No." },
    {
      key: "model",
      label: "Model",
      render: (v, row) => `${v || "-"} ${row.year ? `(${row.year})` : ""}`,
    },
    { key: "capacity", label: "Capacity" },
    {
      key: "insurance_expiry",
      label: "Insurance",
      render: (v) => (
        <span
          className={
            isInsuranceExpiring(v)
              ? "text-red-500 font-medium flex items-center gap-1"
              : ""
          }
        >
          {v ? new Date(v).toLocaleDateString("en-IN") : "—"}
          {isInsuranceExpiring(v) && <AlertTriangle className="w-3.5 h-3.5" />}
        </span>
      ),
    },
    {
      key: "vehicle_status",
      label: "Status",
      render: (v) => (
        <span className={`badge ${sColor(v)} capitalize`}>
          {v?.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      width: "110px",
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
          {hasPermission("edit_vehicle") && (
            <button
              onClick={() => openEdit(row)}
              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              <Pencil className="w-4 h-4 text-blue-500" />
            </button>
          )}
          {hasPermission("delete_vehicle") && (
            <button
              onClick={() => {
                setSelected(row);
                setDelete(true);
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
        title="Vehicles"
        subtitle={`${total} vehicles`}
        actions={
          hasPermission("create_vehicle") && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Vehicle
            </button>
          )
        }
      />
      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700 flex flex-wrap gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search name, registration…"
            className="flex-1 min-w-[200px]"
          />
          <Select
            options={VEHICLE_STATUSES}
            placeholder="All Status"
            value={statusFilter}
            onChange={setStatus}
            className="w-44"
          />
        </div>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={Car}
              title="No vehicles found"
              action={
                hasPermission("create_vehicle") && (
                  <button onClick={openCreate} className="btn-primary">
                    Add Vehicle
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={selected ? "Edit Vehicle" : "Add Vehicle"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              label="Vehicle Name"
              required
              error={errors.vehicle_name?.message}
            >
              <input
                className="input"
                autoFocus
                {...register("vehicle_name", { required: "Required" })}
              />
            </FormField>
            <FormField label="Forklift Type">
              <select className="input" {...register("forklift_type")}>
                <option value="">Select type</option>
                {FORKLIFT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Registration Number">
              <input className="input" {...register("registration_number")} />
            </FormField>
            <FormField label="Model">
              <input className="input" {...register("model")} />
            </FormField>
            <FormField label="Year">
              <input
                type="number"
                className="input"
                {...register("year")}
                placeholder="e.g. 2022"
              />
            </FormField>
            <FormField label="Capacity">
              <input
                className="input"
                {...register("capacity")}
                placeholder="e.g. 3 Ton"
              />
            </FormField>
            <FormField label="Fuel Type">
              <select className="input" {...register("fuel_type")}>
                <option value="">Select</option>
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f} className="capitalize">
                    {f}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Chassis Number">
              <input className="input" {...register("chassis_number")} />
            </FormField>
            <FormField label="Insurance Expiry">
              <input
                type="date"
                className="input"
                {...register("insurance_expiry")}
              />
            </FormField>
            <FormField label="Status">
              <select className="input" {...register("vehicle_status")}>
                {VEHICLE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
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
              {saving ? "Saving…" : selected ? "Update" : "Add Vehicle"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Vehicle Details"
        size="md"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-surface-100 dark:border-surface-700">
              <div className="w-14 h-14 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <Car className="w-7 h-7 text-brand-600" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">
                  {selected.vehicle_name}
                </h3>
                <p className="text-surface-400 text-sm">
                  {selected.vehicle_code}
                </p>
                <span
                  className={`badge ${sColor(selected.vehicle_status)} capitalize`}
                >
                  {selected.vehicle_status?.replace("_", " ")}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Registration", selected.registration_number],
                ["Model", selected.model],
                ["Year", selected.year],
                ["Capacity", selected.capacity],
                ["Fuel", selected.fuel_type],
                ["Chassis", selected.chassis_number],
                [
                  "Insurance",
                  selected.insurance_expiry
                    ? new Date(selected.insurance_expiry).toLocaleDateString(
                        "en-IN",
                      )
                    : "—",
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <span className="text-surface-400">{k}: </span>
                  <span className="font-medium">{v || "—"}</span>
                </div>
              ))}
            </div>
            {selected.notes && (
              <p className="text-sm text-surface-500 italic border-t pt-3">
                {selected.notes}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDelete(false)}
        onConfirm={handleDelete}
        title="Delete Vehicle"
        message={`Delete "${selected?.vehicle_name}"?`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
