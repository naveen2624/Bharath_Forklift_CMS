"use client";

import { useState, useEffect, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  Check,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ─── PermissionGuard ───────────────────────────────────────────────────────────
export function PermissionGuard({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? children : fallback;
}

// ─── PageHeader ────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && (
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "brand",
  trend,
  loading,
}) {
  const colorMap = {
    brand:
      "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400",
    green:
      "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    yellow:
      "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400",
    red: "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };
  return (
    <div className="stat-card">
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-3 w-20" />
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-surface-500 dark:text-surface-400 font-medium">
              {title}
            </p>
            <p className="text-2xl font-display font-bold mt-1 text-surface-900 dark:text-white">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-surface-400 mt-1">{subtitle}</p>
            )}
            {trend !== undefined && (
              <p
                className={`text-xs mt-1 font-medium ${trend >= 0 ? "text-green-600" : "text-red-500"}`}
              >
                {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last month
              </p>
            )}
          </div>
          {Icon && (
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}
            >
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DataTable ─────────────────────────────────────────────────────────────────
export function DataTable({
  columns,
  data,
  loading,
  onRowClick,
  emptyMessage = "No records found",
}) {
  if (loading)
    return (
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                <td colSpan={columns.length}>
                  <div className="skeleton h-5 w-full rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-center py-12 text-surface-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.render ? c.render(row[c.key], row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <div className="flex items-center gap-2 text-sm text-surface-500">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="border border-surface-200 dark:border-surface-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-surface-800 focus:outline-none focus:border-brand-500"
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="ml-2">
          {Math.min((page - 1) * pageSize + 1, total)}–
          {Math.min(page * pageSize, total)} of {total}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pg = i + 1;
          if (totalPages > 5) {
            if (page <= 3) pg = i + 1;
            else if (page >= totalPages - 2) pg = totalPages - 4 + i;
            else pg = page - 2 + i;
          }
          return (
            <button
              key={pg}
              onClick={() => onPageChange(pg)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors
                ${page === pg ? "bg-brand-600 text-white" : "hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-600 dark:text-surface-400"}`}
            >
              {pg}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-8"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = "md" }) {
  const sizeMap = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
    full: "max-w-7xl",
  };
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full ${sizeMap[size]} max-h-[90vh] flex flex-col animate-fade-in`}
      >
        <div className="flex items-center justify-between p-5 border-b border-surface-100 dark:border-surface-700">
          <h2 className="font-display font-bold text-lg text-surface-900 dark:text-white">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger = false,
  loading,
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-surface-900 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${danger ? "bg-red-100 dark:bg-red-900/30" : "bg-brand-100 dark:bg-brand-900/30"}`}
        >
          <AlertTriangle
            className={`w-6 h-6 ${danger ? "text-red-600" : "text-brand-600"}`}
          />
        </div>
        <h3 className="font-display font-bold text-lg text-surface-900 dark:text-white mb-2">
          {title}
        </h3>
        <p className="text-surface-500 dark:text-surface-400 text-sm mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`${danger ? "btn-danger" : "btn-primary"} flex items-center gap-2`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Badge components ─────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const map = {
    paid: "badge-green",
    partial: "badge-yellow",
    pending: "badge-red",
    draft: "badge-gray",
    sent: "badge-blue",
    converted: "badge-green",
    expired: "badge-red",
    available: "badge-green",
    rented: "badge-blue",
    maintenance: "badge-yellow",
    sold: "badge-gray",
    active: "badge-green",
    completed: "badge-gray",
    cancelled: "badge-red",
    in_stock: "badge-green",
    low_stock: "badge-yellow",
    out_of_stock: "badge-red",
    retail: "badge-blue",
    dealer: "badge-orange",
    corporate: "badge-purple",
  };
  return (
    <span className={map[status] || "badge-gray"}>
      {status?.replace("_", " ")}
    </span>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────
export function FormField({ label, error, required, children }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({
  options = [],
  placeholder = "Select...",
  value,
  onChange,
  className = "",
  ...props
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      className={`input ${className}`}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
          <Icon className="w-8 h-8 text-surface-400" />
        </div>
      )}
      <h3 className="font-semibold text-surface-700 dark:text-surface-300 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-surface-400 text-sm mb-4 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}

// ─── LoadingSpinner ───────────────────────────────────────────────────────────
export function LoadingSpinner({ size = "md" }) {
  const sizes = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className={`${sizes[size]} animate-spin text-brand-600`} />
    </div>
  );
}
