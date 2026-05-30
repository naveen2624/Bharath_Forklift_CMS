'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTableData } from '@/lib/hooks';
import { PageHeader, DataTable, Pagination, SearchBar, Modal, ConfirmDialog, FormField, EmptyState } from '@/components/shared';
import toast from 'react-hot-toast';
import { Plus, Pencil, UserX, UserCheck, UserCog, Shield, Eye, Lock } from 'lucide-react';

export default function UsersPage() {
  const { profile, hasPermission } = useAuth();
  const supabase = createClient();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [permsOpen, setPermsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [logsOpen, setLogsOpen] = useState(false);

  const { data, total, page, pageSize, loading, totalPages, setPage, setPageSize, refresh } =
    useTableData('users', {
      columns: '*, roles(role_name)',
      search,
      searchColumns: ['name', 'email'],
      orderBy: 'created_at',
      softDelete: false,
    });

  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { register: roleReg, handleSubmit: roleSubmit, reset: roleReset } = useForm();

  useEffect(() => {
    supabase.from('roles').select('*').then(({ data }) => setRoles(data || []));
    supabase.from('permissions').select('*').order('module').then(({ data }) => setAllPermissions(data || []));
  }, []);

  const openCreate = () => { reset({}); setSelected(null); setFormOpen(true); };
  const openEdit = (row) => { setSelected(row); reset(row); setFormOpen(true); };

  const openRolePerms = async (role) => {
    setSelectedRole(role);
    const { data } = await supabase.from('role_permissions').select('permission_id').eq('role_id', role.id);
    setRolePermissions((data || []).map(rp => rp.permission_id));
    setPermsOpen(true);
  };

  const viewLogs = async (user) => {
    setSelected(user);
    const { data } = await supabase.from('activity_logs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
    setActivityLogs(data || []);
    setLogsOpen(true);
  };

  const onSubmit = async (formData) => {
    setSaving(true);
    if (selected) {
      // Update existing user
      const { error } = await supabase.from('users').update({
        name: formData.name,
        role_id: formData.role_id,
        phone: formData.phone,
        updated_by: profile?.id,
      }).eq('id', selected.id);
      if (error) toast.error(error.message);
      else { toast.success('User updated!'); setFormOpen(false); refresh(); }
    } else {
      // Create new user via server API route (needs service role)
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role_id: formData.role_id,
          phone: formData.phone,
        }),
      });
      const result = await res.json();
      if (!res.ok) toast.error(result.error || 'Failed to create user');
      else { toast.success('User created! They can now login.'); setFormOpen(false); refresh(); }
    }
    setSaving(false);
  };

  const toggleUserStatus = async (user) => {
    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('id', user.id);
    if (error) toast.error(error.message);
    else { toast.success(user.is_active ? 'User disabled' : 'User enabled'); refresh(); }
  };

  const saveRolePermissions = async () => {
    setSaving(true);
    // Delete existing
    await supabase.from('role_permissions').delete().eq('role_id', selectedRole.id);
    // Insert new
    if (rolePermissions.length > 0) {
      await supabase.from('role_permissions').insert(rolePermissions.map(pid => ({ role_id: selectedRole.id, permission_id: pid })));
    }
    toast.success('Permissions updated!');
    setPermsOpen(false);
    setSaving(false);
  };

  const onCreateRole = async (formData) => {
    setSaving(true);
    const { error } = await supabase.from('roles').insert({ role_name: formData.role_name, description: formData.description });
    if (error) toast.error(error.message);
    else {
      toast.success('Role created!');
      setRolesOpen(false);
      supabase.from('roles').select('*').then(({ data }) => setRoles(data || []));
    }
    setSaving(false);
  };

  const togglePermission = (permId) => {
    setRolePermissions(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  };

  const groupedPermissions = allPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module].push(perm);
    return acc;
  }, {});

  if (!hasPermission('manage_users')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Lock className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="font-semibold text-surface-700 dark:text-surface-300">Access Denied</h3>
          <p className="text-surface-400 text-sm mt-1">You don't have permission to manage users.</p>
        </div>
      </div>
    );
  }

  const columns = [
    { key: 'name', label: 'User', render: (v, row) => (
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
          <span className="text-brand-700 text-sm font-bold">{v?.charAt(0)}</span>
        </div>
        <div>
          <p className="font-medium text-surface-900 dark:text-white">{v}</p>
          <p className="text-xs text-surface-400">{row.email}</p>
        </div>
      </div>
    )},
    { key: 'roles', label: 'Role', render: v => v ? <span className="badge badge-blue capitalize">{v.role_name}</span> : '-' },
    { key: 'phone', label: 'Phone' },
    { key: 'is_active', label: 'Status', render: v => <span className={`badge ${v ? 'badge-green' : 'badge-red'}`}>{v ? 'Active' : 'Disabled'}</span> },
    { key: 'last_login', label: 'Last Login', render: v => v ? new Date(v).toLocaleDateString('en-IN') : 'Never' },
    { key: 'id', label: 'Actions', width: '130px', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => viewLogs(row)} className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg" title="Activity logs"><Eye className="w-4 h-4 text-surface-500" /></button>
        <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Edit"><Pencil className="w-4 h-4 text-blue-500" /></button>
        {row.id !== profile?.id && (
          <button onClick={() => toggleUserStatus(row)} className={`p-1.5 rounded-lg ${row.is_active ? 'hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-green-50 dark:hover:bg-green-900/20'}`} title={row.is_active ? 'Disable' : 'Enable'}>
            {row.is_active ? <UserX className="w-4 h-4 text-red-500" /> : <UserCheck className="w-4 h-4 text-green-500" />}
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="User Management" subtitle={`${total} users`}
        actions={
          <div className="flex gap-2">
            <button onClick={() => setRolesOpen(true)} className="btn-secondary"><Shield className="w-4 h-4" /> Manage Roles</button>
            <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add User</button>
          </div>
        }
      />

      {/* Roles row */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Roles & Permissions</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {roles.map(role => (
            <div key={role.id} className="flex items-center gap-2 bg-surface-50 dark:bg-surface-800 rounded-xl px-4 py-2.5 border border-surface-200 dark:border-surface-700">
              <div className="w-2 h-2 rounded-full bg-brand-500" />
              <div>
                <p className="font-medium text-sm capitalize">{role.role_name}</p>
                <p className="text-xs text-surface-400">{role.description}</p>
              </div>
              <button onClick={() => openRolePerms(role)} className="ml-2 p-1 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg" title="Edit permissions">
                <Shield className="w-3.5 h-3.5 text-brand-600" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-surface-100 dark:border-surface-700">
          <SearchBar value={search} onChange={setSearch} placeholder="Search users..." className="max-w-md" />
        </div>
        <DataTable columns={columns} data={data} loading={loading}
          emptyMessage={<EmptyState icon={UserCog} title="No users found" action={<button onClick={openCreate} className="btn-primary">Add User</button>} />}
        />
        <div className="p-4 border-t border-surface-100 dark:border-surface-700">
          <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      </div>

      {/* Create/Edit User Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={selected ? 'Edit User' : 'Create User'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Full Name" required error={errors.name?.message}>
            <input className="input" {...register('name', { required: 'Required' })} />
          </FormField>
          {!selected && (
            <>
              <FormField label="Email" required error={errors.email?.message}>
                <input type="email" className="input" {...register('email', { required: 'Required' })} />
              </FormField>
              <FormField label="Password" required error={errors.password?.message}>
                <input type="password" className="input" {...register('password', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />
              </FormField>
            </>
          )}
          <FormField label="Role" required error={errors.role_id?.message}>
            <select className="input" {...register('role_id', { required: 'Required' })}>
              <option value="">Select role</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.role_name}</option>)}
            </select>
          </FormField>
          <FormField label="Phone">
            <input className="input" {...register('phone')} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : selected ? 'Update User' : 'Create User'}</button>
          </div>
        </form>
      </Modal>

      {/* Role Permissions Modal */}
      <Modal open={permsOpen} onClose={() => setPermsOpen(false)} title={`Permissions: ${selectedRole?.role_name}`} size="lg">
        <div className="space-y-4">
          {Object.entries(groupedPermissions).map(([module, perms]) => (
            <div key={module}>
              <h4 className="font-semibold text-sm text-surface-700 dark:text-surface-300 capitalize mb-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500" /> {module.replace('_', ' ')}
              </h4>
              <div className="grid grid-cols-2 gap-2 pl-3">
                {perms.map(perm => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={rolePermissions.includes(perm.id)}
                      onChange={() => togglePermission(perm.id)}
                      className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm text-surface-600 dark:text-surface-400 group-hover:text-surface-900 dark:group-hover:text-white transition-colors">
                      {perm.permission_name.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-surface-100 dark:border-surface-700">
          <span className="text-sm text-surface-400">{rolePermissions.length} permissions selected</span>
          <div className="flex gap-3">
            <button onClick={() => setPermsOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={saveRolePermissions} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Permissions'}</button>
          </div>
        </div>
      </Modal>

      {/* Create Role Modal */}
      <Modal open={rolesOpen} onClose={() => setRolesOpen(false)} title="Create New Role" size="sm">
        <form onSubmit={roleSubmit(onCreateRole)} className="space-y-4">
          <FormField label="Role Name" required>
            <input className="input" {...roleReg('role_name', { required: 'Required' })} placeholder="e.g. manager" />
          </FormField>
          <FormField label="Description">
            <input className="input" {...roleReg('description')} placeholder="Role description" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setRolesOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Role'}</button>
          </div>
        </form>
      </Modal>

      {/* Activity Logs Modal */}
      <Modal open={logsOpen} onClose={() => setLogsOpen(false)} title={`Activity: ${selected?.name}`} size="lg">
        <div className="max-h-96 overflow-y-auto">
          {activityLogs.length === 0 ? (
            <p className="text-center text-surface-400 py-8">No activity logs</p>
          ) : (
            <div className="space-y-2">
              {activityLogs.map(log => (
                <div key={log.id} className="flex items-start gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      <span className="text-brand-600">{log.action}</span> in {log.module}
                    </p>
                    <p className="text-xs text-surface-400">{new Date(log.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
