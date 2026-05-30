// LOCATION: src/app/profile/page.js
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader, FormField } from "@/components/shared";
import toast from "react-hot-toast";
import { User, Lock, Camera, Loader2, Mail, Phone, Shield } from "lucide-react";

export default function ProfilePage() {
  const { profile, role, refreshProfile, updatePassword } = useAuth();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    values: { name: profile?.name || "", phone: profile?.phone || "" },
  });

  const {
    register: pReg,
    handleSubmit: pSubmit,
    reset: pReset,
    watch,
    formState: { errors: pErrors },
  } = useForm();

  const newPassword = watch("new_password");

  const onProfileSubmit = async (data) => {
    setSavingProfile(true);
    const { error } = await supabase
      .from("users")
      .update({ name: data.name, phone: data.phone, updated_by: profile?.id })
      .eq("id", profile?.id);

    if (error) toast.error(error.message);
    else {
      toast.success("Profile updated!");
      refreshProfile();
    }
    setSavingProfile(false);
  };

  const onPasswordSubmit = async (data) => {
    setSavingPassword(true);
    const { error } = await updatePassword(data.new_password);
    if (error) toast.error(error.message);
    else {
      toast.success("Password changed successfully!");
      pReset();
    }
    setSavingPassword(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${profile?.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("profiles")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("profiles").getPublicUrl(path);
    await supabase
      .from("users")
      .update({ profile_image: publicUrl })
      .eq("id", profile?.id);
    toast.success("Profile picture updated!");
    refreshProfile();
    setUploading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader title="My Profile" subtitle="Manage your account settings" />

      {/* ── Avatar + name card ─────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center overflow-hidden">
              {profile?.profile_image ? (
                <img
                  src={profile.profile_image}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-brand-700 dark:text-brand-400 text-3xl font-bold">
                  {profile?.name?.charAt(0) || "U"}
                </span>
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-brand-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-700 transition-colors shadow-md">
              {uploadingAvatar ? (
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Info */}
          <div className="min-w-0">
            <h3 className="font-display font-bold text-xl text-surface-900 dark:text-white truncate">
              {profile?.name || "—"}
            </h3>
            {/* Show the actual email from auth, not a hardcoded domain */}
            <div className="flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
              <span className="text-surface-500 text-sm truncate">
                {profile?.email || "—"}
              </span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                <span className="text-surface-500 text-sm">
                  {profile.phone}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
              <span className="badge badge-blue capitalize text-xs">
                {role?.role_name || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Personal info form ─────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-surface-100 dark:border-surface-700">
          <User className="w-5 h-5 text-brand-600" />
          <h3 className="font-display font-semibold text-surface-900 dark:text-white">
            Personal Information
          </h3>
        </div>
        <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Full Name" required error={errors.name?.message}>
              <input
                className="input"
                {...register("name", { required: "Required" })}
              />
            </FormField>
            <FormField label="Phone">
              <input
                className="input"
                {...register("phone")}
                placeholder="+91 98765 43210"
              />
            </FormField>
          </div>

          {/* Email — read-only, shows actual email from profile */}
          <div>
            <label className="label flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-surface-400" /> Email Address
            </label>
            <div className="input bg-surface-50 dark:bg-surface-800/50 cursor-not-allowed text-surface-500 flex items-center">
              {profile?.email || "—"}
            </div>
            <p className="text-xs text-surface-400 mt-1">
              Email address cannot be changed here. Contact your administrator.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="btn-primary"
            >
              {savingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Change password ────────────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-surface-100 dark:border-surface-700">
          <Lock className="w-5 h-5 text-brand-600" />
          <h3 className="font-display font-semibold text-surface-900 dark:text-white">
            Change Password
          </h3>
        </div>
        <form onSubmit={pSubmit(onPasswordSubmit)} className="space-y-4">
          <FormField
            label="New Password"
            required
            error={pErrors.new_password?.message}
          >
            <input
              type="password"
              className="input"
              placeholder="Minimum 8 characters"
              {...pReg("new_password", {
                required: "Required",
                minLength: { value: 8, message: "Minimum 8 characters" },
              })}
            />
          </FormField>
          <FormField
            label="Confirm New Password"
            required
            error={pErrors.confirm_password?.message}
          >
            <input
              type="password"
              className="input"
              placeholder="Re-enter new password"
              {...pReg("confirm_password", {
                required: "Required",
                validate: (v) => v === newPassword || "Passwords do not match",
              })}
            />
          </FormField>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="btn-primary"
            >
              {savingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating…
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ── Account info ───────────────────────────────────────────────────── */}
      <div className="card p-6">
        <h3 className="font-display font-semibold text-surface-900 dark:text-white mb-4">
          Account Information
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["User ID", profile?.id ? profile.id.slice(0, 8) + "…" : "—"],
            ["Role", role?.role_name],
            ["Status", profile?.is_active ? "Active" : "Disabled"],
            [
              "Last Login",
              profile?.last_login
                ? new Date(profile.last_login).toLocaleString("en-IN")
                : "Never",
            ],
            [
              "Member Since",
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-IN")
                : "—",
            ],
          ].map(([k, v]) => (
            <div
              key={k}
              className="bg-surface-50 dark:bg-surface-800 rounded-lg p-3"
            >
              <p className="text-surface-400 text-xs mb-0.5">{k}</p>
              <p className="font-medium capitalize truncate">{v || "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
