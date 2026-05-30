"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  ShoppingCart,
  FileText,
  Receipt,
  Car,
  ClipboardList,
  Wrench,
  BarChart3,
  UserCog,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
  X,
  Zap,
  Search,
  Building2,
  ChevronDown,
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "view_dashboard",
  },
  {
    href: "/customers",
    label: "Customers",
    icon: Users,
    permission: "view_customer",
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: Building2,
    permission: "view_supplier",
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    permission: "view_product",
  },
  {
    href: "/purchase",
    label: "Purchase",
    icon: ShoppingCart,
    permission: "view_purchase",
  },
  {
    href: "/quotations",
    label: "Quotations",
    icon: FileText,
    permission: "view_quotation",
  },
  {
    href: "/invoices",
    label: "Invoices",
    icon: Receipt,
    permission: "view_invoice",
  },
  {
    href: "/vehicles",
    label: "Vehicles",
    icon: Car,
    permission: "view_vehicle",
  },
  {
    href: "/delivery-challans",
    label: "Delivery Challans",
    icon: Truck,
    permission: "view_challan",
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    icon: Wrench,
    permission: "view_maintenance",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    permission: "view_reports",
  },
  {
    href: "/users",
    label: "User Management",
    icon: UserCog,
    permission: "manage_users",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    permission: "manage_settings",
  },
];

export default function DashboardShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { profile, role, loading, hasPermission, signOut } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const close = () => {
      setNotifOpen(false);
      setUserMenu(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const visibleNavItems = NAV_ITEMS.filter(
    (item) => role?.role_name === "admin" || hasPermission(item.permission),
  );

  /* ── Loading screen ─────────────────────────────────────────────────── */
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-3">
          <video
            src="/logo/BF_Logo_Animation.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-40 h-40 object-contain"
          />
          <p className="text-surface-400 text-sm animate-pulse">
            Loading system…
          </p>
        </div>
      </div>
    );

  /* ── Sidebar content ────────────────────────────────────────────────── */
  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-surface-200 dark:border-surface-700 ${collapsed ? "justify-center" : ""}`}
      >
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-display font-bold text-sm text-surface-900 dark:text-white leading-tight">
              Bharath
            </div>
            <div className="font-display font-bold text-sm text-brand-600 leading-tight">
              Forklift
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all
                ${
                  active
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white"
                }
                ${collapsed ? "justify-center" : ""}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium truncate">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-surface-200 dark:border-surface-700 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-brand-700 dark:text-brand-400 text-sm font-bold">
                {profile?.name?.charAt(0) || "U"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-surface-900 dark:text-white truncate">
                {profile?.name || "—"}
              </div>
              <div className="text-xs text-surface-400 capitalize">
                {role?.role_name || "…"}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
              <span className="text-brand-700 dark:text-brand-400 text-sm font-bold">
                {profile?.name?.charAt(0) || "U"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Main layout ────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-surface-900
                        border-r border-surface-200 dark:border-surface-700
                        transition-all duration-300 flex-shrink-0 shadow-sidebar relative
                        ${collapsed ? "w-16" : "w-64"}`}
      >
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -translate-y-1/2 -right-3
                     w-6 h-10 bg-white dark:bg-surface-900
                     border border-surface-200 dark:border-surface-700
                     rounded-r-lg flex items-center justify-center
                     text-surface-400 hover:text-surface-700 dark:hover:text-surface-200
                     transition-colors shadow-sm z-10"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3" />
          ) : (
            <ChevronLeft className="w-3 h-3" />
          )}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white dark:bg-surface-900 shadow-xl z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header
          className="h-16 bg-white dark:bg-surface-900
                           border-b border-surface-200 dark:border-surface-700
                           flex items-center gap-4 px-4 lg:px-6 flex-shrink-0"
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden btn-ghost p-1.5"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search bar */}
          <div className="flex-1 max-w-md hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search anything…"
                className="w-full pl-9 pr-4 py-2 text-sm bg-surface-50 dark:bg-surface-800
                           border border-surface-200 dark:border-surface-700 rounded-lg
                           focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="btn-ghost p-2 rounded-lg"
              >
                {theme === "dark" ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
            )}

            {/* Notifications */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setNotifOpen((o) => !o)}
                className="btn-ghost p-2 rounded-lg relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 card shadow-card-hover z-50 p-4 animate-fade-in">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    <button onClick={() => setNotifOpen(false)}>
                      <X className="w-4 h-4 text-surface-400" />
                    </button>
                  </div>
                  <p className="text-surface-400 text-sm text-center py-4">
                    No new notifications
                  </p>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setUserMenu((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                           hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                  <span className="text-brand-700 dark:text-brand-400 text-xs font-bold">
                    {profile?.name?.charAt(0) || "U"}
                  </span>
                </div>
                <span className="text-sm font-medium hidden sm:block">
                  {profile?.name || "—"}
                </span>
                <ChevronDown className="w-4 h-4 text-surface-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 card shadow-card-hover z-50 p-1 animate-fade-in">
                  <Link
                    href="/profile"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    <User className="w-4 h-4" /> My Profile
                  </Link>
                  <Link
                    href="/settings"
                    onClick={() => setUserMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                  <hr className="my-1 border-surface-100 dark:border-surface-700" />
                  <button
                    onClick={signOut}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg
                               hover:bg-red-50 dark:hover:bg-red-900/20
                               text-red-600 dark:text-red-400 transition-colors w-full"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
