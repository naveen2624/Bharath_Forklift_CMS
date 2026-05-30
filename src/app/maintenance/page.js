"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTableData, useLookup } from "@/lib/hooks";
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
import { Plus, Pencil, Trash2, Eye, Wrench, AlertTriangle } from "lucide-react";

export default function MaintenancePage() {
  const { profile, hasPermission } = useAuth();
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicle] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDelete] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Cached lookup — fetched once
  const { data: vehicles } = useLookup(
    "vehicles",
    "id, vehicle_name, registration_number",
  );
  const vehicleOptions = vehicles.map((v) => ({
    value: v.id,
    label: `${v.vehicle_name} (${v.registration_number || "N/A"})`,
  }));

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
  } = useTableData("maintenance_records", {
    columns: "*, vehicles(vehicle_name, registration_number)",
    search,
    searchColumns: ["maintenance_number", "problem"],
    filters: vehicleFilter ? { vehicle_id: vehicleFilter } : {},
    orderBy: "maintenance_date",
    orderAsc: false,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const openCreate = () => {
    reset({
      maintenance_date: new Date().toISOString().split("T")[0],
      status: "completed",
    });
    setSelected(null);
    setFormOpen(true);
  };
  const openEdit = (row) => {
    setSelected(row);
    reset(row);
    setFormOpen(true);
  };

  const generateNumber = async () => {
    const { count } = await supabase
      .from("maintenance_records")
      .select("id", { count: "exact", head: true });
    return `MNT${String((count || 0) + 1).padStart(5, "0")}`;
  };

  const onSubmit = async (fd) => {
    setSaving(true);
    let error;
    if (selected) {
      ({ error } = await supabase
        .from("maintenance_records")
        .update({ ...fd, updated_by: profile?.id })
        .eq("id", selected.id));
    } else {
      const num = await generateNumber();
      ({ error } = await supabase
        .from("maintenance_records")
        .insert({ ...fd, maintenance_number: num, created_by: profile?.id }));
    }
    if (!error) {
      // Sync vehicle status
      if (fd.vehicle_id) {
        const vehicleStatus =
          fd.status === "in_progress"
            ? "maintenance"
            : fd.status === "completed"
              ? "available"
              : null;
        if (vehicleStatus)
          await supabase
            .from("vehicles")
            .update({ vehicle_status: vehicleStatus })
            .eq("id", fd.vehicle_id);
      }
      toast.success(selected ? "Record updated!" : "Maintenance record added!");
      setFormOpen(false);
      refresh();
    } else {
      toast.error(error.message);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await supabase
      .from("maintenance_records")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", selected.id);
    toast.success("Record deleted");
    setDelete(false);
    refresh();
    setDeleting(false);
  };

  const isServiceDueSoon = (date) => {
    if (!date) return false;
    const diff = (new Date(date) - new Date()) / 86400000;
    return diff >= 0 && diff <= 14;
  };

  const sColor = (s) =>
    ({
      scheduled: "badge-blue",
      in_progress: "badge-yellow",
      completed: "badge-green",
    })[s] || "badge-gray";

  const columns = [
    {
      key: "maintenance_number",
      label: "ID",
      width: "100px",
      render: (v) => <span className="font-mono text-xs">{v}</span>,
    },
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
      key: "maintenance_date",
      label: "Date",
      render: (v) => new Date(v).toLocaleDateString("en-IN"),
    },
    {
      key: "problem",
      label: "Problem",
      render: (v) => <span className="line-clamp-1 max-w-xs">{v || "—"}</span>,
    },
    {
      key: "cost",
      label: "Cost",
      render: (v) => `₹${Number(v || 0).toLocaleString("en-IN")}`,
    },
    {
      key: "next_service_date",
      label: "Next Service",
      render: (v) => (
        <div className="flex items-center gap-1">
          <span
            className={isServiceDueSoon(v) ? "text-orange-500 font-medium" : ""}
          >
            {v ? new Date(v).toLocaleDateString("en-IN") : "—"}
          </span>
          {isServiceDueSoon(v) && (
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
          )}
        </div>
      ),
    },
    {
      key: "status",
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
          {hasPermission("edit_maintenance") && (
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
        title="Maintenance"
        subtitle={`${total} records`}
        actions={
          hasPermission("create_maintenance") && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Record
            </button>
          )
        }
      />
      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700 flex flex-wrap gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search vehicle, problem…"
            className="flex-1 min-w-[200px]"
          />
          <Select
            options={vehicleOptions}
            placeholder="All Vehicles"
            value={vehicleFilter}
            onChange={setVehicle}
            className="w-52"
          />
        </div>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          emptyMessage={
            <EmptyState
              icon={Wrench}
              title="No maintenance records"
              action={
                hasPermission("create_maintenance") && (
                  <button onClick={openCreate} className="btn-primary">
                    Add Record
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
        title={selected ? "Edit Maintenance" : "Add Maintenance Record"}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                    {v.vehicle_name} ({v.registration_number || "N/A"})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Maintenance Date"
              required
              error={errors.maintenance_date?.message}
            >
              <input
                type="date"
                className="input"
                {...register("maintenance_date", { required: "Required" })}
              />
            </FormField>
            <div className="col-span-2">
              <FormField label="Problem">
                <textarea
                  rows={2}
                  className="input resize-none"
                  {...register("problem")}
                  placeholder="Describe the issue…"
                />
              </FormField>
            </div>
            <div className="col-span-2">
              <FormField label="Parts Replaced">
                <textarea
                  rows={2}
                  className="input resize-none"
                  {...register("parts_replaced")}
                />
              </FormField>
            </div>
            <FormField label="Cost (₹)">
              <input
                type="number"
                step="0.01"
                className="input"
                {...register("cost")}
              />
            </FormField>
            <FormField label="Next Service Date">
              <input
                type="date"
                className="input"
                {...register("next_service_date")}
              />
            </FormField>
            <FormField label="Status">
              <select className="input" {...register("status")}>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </FormField>
            <div className="col-span-2">
              <FormField label="Service Notes">
                <textarea
                  rows={2}
                  className="input resize-none"
                  {...register("service_notes")}
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
              {saving ? "Saving…" : selected ? "Update" : "Add Record"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Maintenance Details"
        size="md"
      >
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-surface-400">Vehicle:</span>
                <p className="font-medium">{selected.vehicles?.vehicle_name}</p>
              </div>
              <div>
                <span className="text-surface-400">Date:</span>
                <p className="font-medium">
                  {new Date(selected.maintenance_date).toLocaleDateString(
                    "en-IN",
                  )}
                </p>
              </div>
              <div>
                <span className="text-surface-400">Cost:</span>
                <p className="font-medium">
                  ₹{Number(selected.cost || 0).toLocaleString("en-IN")}
                </p>
              </div>
              <div>
                <span className="text-surface-400">Status:</span>
                <div className="mt-1">
                  <span
                    className={`badge ${sColor(selected.status)} capitalize`}
                  >
                    {selected.status?.replace("_", " ")}
                  </span>
                </div>
              </div>
              {selected.next_service_date && (
                <div>
                  <span className="text-surface-400">Next Service:</span>
                  <p
                    className={`font-medium ${isServiceDueSoon(selected.next_service_date) ? "text-orange-500" : ""}`}
                  >
                    {new Date(selected.next_service_date).toLocaleDateString(
                      "en-IN",
                    )}
                  </p>
                </div>
              )}
            </div>
            {selected.problem && (
              <div className="border-t pt-3">
                <p className="text-surface-400 font-medium mb-1">Problem:</p>
                <p>{selected.problem}</p>
              </div>
            )}
            {selected.parts_replaced && (
              <div>
                <p className="text-surface-400 font-medium mb-1">
                  Parts Replaced:
                </p>
                <p>{selected.parts_replaced}</p>
              </div>
            )}
            {selected.service_notes && (
              <div>
                <p className="text-surface-400 font-medium mb-1">Notes:</p>
                <p>{selected.service_notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDelete(false)}
        onConfirm={handleDelete}
        title="Delete Record"
        message="Delete this maintenance record?"
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </div>
  );
}
