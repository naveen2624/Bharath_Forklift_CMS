'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, FormField } from '@/components/shared';
import toast from 'react-hot-toast';
import { Building2, Receipt, Settings2, Loader2, Upload } from 'lucide-react';

const TABS = [
  { id: 'company', label: 'Company Info', icon: Building2 },
  { id: 'invoice', label: 'Invoice Settings', icon: Receipt },
  { id: 'tax', label: 'Tax & Currency', icon: Settings2 },
];

export default function SettingsPage() {
  const { profile, hasPermission } = useAuth();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('company');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [settingsId, setSettingsId] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    supabase.from('company_settings').select('*').single().then(({ data }) => {
      if (data) {
        setSettingsId(data.id);
        reset(data);
      }
    });
  }, []);

  if (!hasPermission('manage_settings')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Settings2 className="w-12 h-12 text-surface-300 mx-auto mb-3" />
          <h3 className="font-semibold">Access Denied</h3>
          <p className="text-surface-400 text-sm mt-1">You don't have permission to manage settings.</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data) => {
    setSaving(true);
    let error;
    if (settingsId) {
      ({ error } = await supabase.from('company_settings').update({ ...data, updated_at: new Date().toISOString() }).eq('id', settingsId));
    } else {
      const { data: ins, error: e } = await supabase.from('company_settings').insert(data).select().single();
      error = e;
      if (ins) setSettingsId(ins.id);
    }
    if (error) toast.error(error.message);
    else toast.success('Settings saved!');
    setSaving(false);
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { error } = await supabase.storage.from('company').upload('logo.png', file, { upsert: true });
    if (error) { toast.error(error.message); setUploadingLogo(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('company').getPublicUrl('logo.png');
    if (settingsId) await supabase.from('company_settings').update({ logo_url: publicUrl }).eq('id', settingsId);
    toast.success('Logo uploaded!');
    setUploadingLogo(false);
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader title="Settings" subtitle="Configure your business settings" />

      <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${activeTab === tab.id ? 'bg-white dark:bg-surface-700 text-brand-600 shadow-sm' : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'}`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Company Info Tab */}
        {activeTab === 'company' && (
          <div className="card p-6 space-y-5">
            {/* Logo upload */}
            <div>
              <label className="label">Company Logo</label>
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <div className="w-24 h-16 rounded-xl bg-surface-100 dark:bg-surface-800 border-2 border-dashed border-surface-300 dark:border-surface-600 flex items-center justify-center hover:border-brand-400 transition-colors">
                  {uploadingLogo ? <Loader2 className="w-5 h-5 animate-spin text-brand-600" /> : <Upload className="w-5 h-5 text-surface-400" />}
                </div>
                <span className="text-sm text-surface-500">Click to upload logo</span>
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Company Name" required error={errors.company_name?.message}>
                <input className="input" {...register('company_name', { required: 'Required' })} />
              </FormField>
              <FormField label="GST Number">
                <input className="input" {...register('gst_number')} placeholder="33XXXXX0000X1ZX" />
              </FormField>
              <div className="col-span-2">
                <FormField label="Address">
                  <textarea rows={2} className="input resize-none" {...register('address')} />
                </FormField>
              </div>
              <FormField label="City">
                <input className="input" {...register('city')} />
              </FormField>
              <FormField label="State">
                <input className="input" {...register('state')} />
              </FormField>
              <FormField label="Pincode">
                <input className="input" {...register('pincode')} />
              </FormField>
              <FormField label="Contact Number">
                <input className="input" {...register('contact_number')} />
              </FormField>
              <FormField label="Email">
                <input type="email" className="input" {...register('email')} />
              </FormField>
              <FormField label="Website">
                <input className="input" {...register('website')} placeholder="https://" />
              </FormField>
            </div>
          </div>
        )}

        {/* Invoice Settings Tab */}
        {activeTab === 'invoice' && (
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Invoice Prefix">
                <input className="input" {...register('invoice_prefix')} placeholder="INV" />
              </FormField>
              <FormField label="Quotation Prefix">
                <input className="input" {...register('quotation_prefix')} placeholder="QT" />
              </FormField>
              <FormField label="Delivery Challan Prefix">
                <input className="input" {...register('challan_prefix')} placeholder="DC" />
              </FormField>
              <FormField label="Purchase Order Prefix">
                <input className="input" {...register('purchase_prefix')} placeholder="PO" />
              </FormField>
            </div>
            <FormField label="Invoice Terms & Conditions">
              <textarea rows={3} className="input resize-none" {...register('invoice_terms')} placeholder="Payment due within 30 days..." />
            </FormField>
            <FormField label="Invoice Footer">
              <textarea rows={2} className="input resize-none" {...register('invoice_footer')} placeholder="Thank you for your business!" />
            </FormField>
          </div>
        )}

        {/* Tax & Currency Tab */}
        {activeTab === 'tax' && (
          <div className="card p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Default Tax Rate (%)">
                <input type="number" step="0.01" className="input" {...register('default_tax_rate')} />
              </FormField>
              <FormField label="Currency Code">
                <select className="input" {...register('currency')}>
                  <option value="INR">INR — Indian Rupee</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </FormField>
              <FormField label="Currency Symbol">
                <input className="input" {...register('currency_symbol')} placeholder="₹" />
              </FormField>
            </div>
            <div className="bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-800 rounded-xl p-4">
              <p className="text-sm text-brand-800 dark:text-brand-300 font-medium">GST Note</p>
              <p className="text-xs text-brand-600 dark:text-brand-400 mt-1">
                Tax rates can also be set per product and per invoice line item. The default tax rate here applies when no specific rate is set.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
