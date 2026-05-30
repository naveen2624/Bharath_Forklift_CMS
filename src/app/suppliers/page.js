'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTableData } from '@/lib/hooks';
import { exportToExcel, EXPORT_COLUMNS } from '@/lib/excel/exporters';
import { PageHeader, DataTable, Pagination, SearchBar, Modal, ConfirmDialog, FormField, EmptyState } from '@/components/shared';
import toast from 'react-hot-toast';
import { Plus, Download, Pencil, Trash2, Eye, Building2 } from 'lucide-react';

export default function SuppliersPage() {
  const { profile, hasPermission } = useAuth();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, total, page, pageSize, loading, totalPages, setPage, setPageSize, refresh } =
    useTableData('suppliers', {
      search,
      searchColumns: ['name', 'mobile', 'email', 'supplier_code'],
      orderBy: 'name',
      orderAsc: true,
    });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const openCreate = () => { reset({}); setSelected(null); setFormOpen(true); };
  const openEdit = (row) => { setSelected(row); reset(row); setFormOpen(true); };

  const onSubmit = async (formData) => {
    setSaving(true);
    const payload = { ...formData, updated_by: profile?.id };
    let error;
    if (selected) {
      ({ error } = await supabase.from('suppliers').update(payload).eq('id', selected.id));
    } else {
      const code = `SUP${String(total + 1).padStart(5, '0')}`;
      ({ error } = await supabase.from('suppliers').insert({ ...payload, supplier_code: code, created_by: profile?.id }));
    }
    if (error) toast.error(error.message);
    else { toast.success(selected ? 'Supplier updated!' : 'Supplier created!'); setFormOpen(false); refresh(); }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from('suppliers').update({ deleted_at: new Date().toISOString(), updated_by: profile?.id }).eq('id', selected.id);
    toast.success('Supplier deleted');
    setDeleteOpen(false);
    refresh();
    setDeleting(false);
  };

  const columns = [
    { key: 'supplier_code', label: 'ID', width: '90px' },
    { key: 'name', label: 'Supplier', render: (v, row) => (
      <div>
        <p className="font-medium text-surface-900 dark:text-white">{v}</p>
        <p className="text-xs text-surface-400">{row.contact_person}</p>
      </div>
    )},
    { key: 'mobile', label: 'Mobile' },
    { key: 'email', label: 'Email' },
    { key: 'gst_number', label: 'GST' },
    { key: 'outstanding_amount', label: 'Outstanding', render: v => (
      <span className={Number(v) > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
        ₹{Number(v || 0).toLocaleString('en-IN')}
      </span>
    )},
    { key: 'id', label: 'Actions', width: '110px', render: (_, row) => (
      <div className="flex items-center gap-1">
        <button onClick={() => { setSelected(row); setViewOpen(true); }} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg"><Eye className="w-4 h-4 text-surface-500" /></button>
        {hasPermission('edit_supplier') && (
          <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"><Pencil className="w-4 h-4 text-blue-500" /></button>
        )}
        {hasPermission('delete_supplier') && (
          <button onClick={() => { setSelected(row); setDeleteOpen(true); }} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Suppliers" subtitle={`${total} total suppliers`}
        actions={
          <>
            <button onClick={() => exportToExcel(data, EXPORT_COLUMNS.suppliers, 'suppliers')} className="btn-secondary">
              <Download className="w-4 h-4" /> Excel
            </button>
            {hasPermission('create_supplier') && (
              <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Supplier</button>
            )}
          </>
        }
      />

      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700">
          <SearchBar value={search} onChange={setSearch} placeholder="Search name, mobile, email..." className="max-w-md" />
        </div>
        <DataTable columns={columns} data={data} loading={loading}
          emptyMessage={<EmptyState icon={Building2} title="No suppliers found" action={hasPermission('create_supplier') && <button onClick={openCreate} className="btn-primary">Add Supplier</button>} />}
        />
        <div className="p-4 border-t border-surface-100 dark:border-surface-700">
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={selected ? 'Edit Supplier' : 'Add Supplier'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Supplier Name" required error={errors.name?.message}>
              <input className="input" {...register('name', { required: 'Required' })} />
            </FormField>
            <FormField label="Contact Person">
              <input className="input" {...register('contact_person')} />
            </FormField>
            <FormField label="Mobile">
              <input className="input" {...register('mobile')} />
            </FormField>
            <FormField label="Email">
              <input type="email" className="input" {...register('email')} />
            </FormField>
            <FormField label="GST Number">
              <input className="input" {...register('gst_number')} />
            </FormField>
            <FormField label="Outstanding Amount (₹)">
              <input type="number" step="0.01" className="input" {...register('outstanding_amount')} />
            </FormField>
            <div className="col-span-2">
              <FormField label="Address">
                <textarea rows={2} className="input resize-none" {...register('address')} />
              </FormField>
            </div>
            <FormField label="City"><input className="input" {...register('city')} /></FormField>
            <FormField label="State"><input className="input" {...register('state')} /></FormField>
            <FormField label="Pincode"><input className="input" {...register('pincode')} /></FormField>
            <div className="col-span-2">
              <FormField label="Notes">
                <textarea rows={2} className="input resize-none" {...register('notes')} />
              </FormField>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : selected ? 'Update Supplier' : 'Create Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title="Supplier Details" size="md">
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 pb-3 border-b border-surface-100 dark:border-surface-700">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-brand-600" />
              </div>
              <div>
                <h3 className="font-bold text-surface-900 dark:text-white">{selected.name}</h3>
                <p className="text-surface-400">{selected.supplier_code}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Contact Person', selected.contact_person],
                ['Mobile', selected.mobile],
                ['Email', selected.email],
                ['GST', selected.gst_number],
                ['City', selected.city],
                ['Outstanding', `₹${Number(selected.outstanding_amount || 0).toLocaleString('en-IN')}`],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><span className="text-surface-400">{k}: </span><span className="font-medium">{v}</span></div>
              ))}
              {selected.address && <div className="col-span-2"><span className="text-surface-400">Address: </span><span>{selected.address}</span></div>}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={handleDelete}
        title="Delete Supplier" message={`Delete "${selected?.name}"?`} confirmLabel="Delete" danger loading={deleting} />
    </div>
  );
}
